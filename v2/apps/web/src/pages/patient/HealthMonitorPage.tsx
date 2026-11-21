import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, CalendarClock, Check, Droplet, Heart, HeartPulse, Info, Plus, ShieldAlert, Sparkles
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { api } from '../../lib/api';

export default function HealthMonitorPage() {
  const { t, i18n } = useTranslation(['health', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'bp';
  const qc = useQueryClient();
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'id-ID';

  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [note, setNote] = useState('');

  const [paramType, setParamType] = useState('WEIGHT');
  const [paramVal, setParamVal] = useState('');
  const [checkupTitle, setCheckupTitle] = useState('');
  const [checkupDate, setCheckupDate] = useState(() => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16));

  const { data: bpData } = useQuery({ queryKey: ['bp'], queryFn: () => api.getBloodPressures('me', 30) });
  const { data: paramData } = useQuery({ queryKey: ['params'], queryFn: () => api.getHealthParameters('me') });
  const { data: checkupData } = useQuery({ queryKey: ['checkups'], queryFn: () => api.getCheckups('me') });

  const bpMut = useMutation({
    mutationFn: () =>
      api.recordBloodPressure('me', {
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        pulse: pulse ? Number(pulse) : null,
        note: note || null,
      }),
    onSuccess: () => {
      setSystolic('');
      setDiastolic('');
      setPulse('');
      setNote('');
      void qc.invalidateQueries({ queryKey: ['bp'] });
      toast.success(t('health:saveData'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paramMut = useMutation({
    mutationFn: () =>
      api.recordHealthParameter('me', {
        type: paramType,
        value: Number(paramVal),
        unit: paramType === 'WEIGHT' ? 'kg' : paramType === 'SPO2' ? '%' : paramType === 'TEMPERATURE' ? '°C' : 'bpm',
      }),
    onSuccess: () => {
      setParamVal('');
      void qc.invalidateQueries({ queryKey: ['params'] });
      toast.success(t('health:addParam'));
    },
  });

  const checkupMut = useMutation({
    mutationFn: () =>
      api.createCheckup('me', {
        title: checkupTitle,
        type: 'CHECKUP',
        scheduledAt: new Date(checkupDate).toISOString(),
      }),
    onSuccess: () => {
      setCheckupTitle('');
      void qc.invalidateQueries({ queryKey: ['checkups'] });
      toast.success(t('health:addCheckup'));
    },
  });

  const chartData = [...(bpData?.logs ?? [])]
    .reverse()
    .slice(-14)
    .map((l) => ({
      date: new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: '2-digit' }).format(new Date(l.measuredAt)),
      systolic: l.systolic,
      diastolic: l.diastolic,
    }));

  const submitBp = (e: FormEvent) => {
    e.preventDefault();
    bpMut.mutate();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{t('health:title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('health:subtitle')}</p>
      </div>

      {/* 4 Tabs covering Section B completely */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'bp', label: t('health:tabBp'), icon: HeartPulse },
          { id: 'glucose', label: t('health:tabGlucose'), icon: Droplet, badge: 'Soon' },
          { id: 'params', label: t('health:tabParams'), icon: Activity },
          { id: 'checkups', label: t('health:tabCheckups'), icon: CalendarClock },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSearchParams(item.id === 'bp' ? {} : { tab: item.id })}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap border transition ${
                active ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-slate-600 border-teal-100 hover:bg-teal-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">{item.badge}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'bp' && (
        <div className="space-y-5">
          {bpData?.summary.latest?.category === 'CRITICAL' && (
            <div className="rounded-3xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3 text-rose-900">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-extrabold text-sm">{t('health:criticalBannerTitle')}</h3>
                <p className="text-xs mt-1">{t('health:criticalBannerBody')}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Large DoseMate Screen 4 Pill Inputs */}
            <form onSubmit={submitBp} className="lg:col-span-5 bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                  <HeartPulse className="w-8 h-8" />
                </div>
                <h2 className="text-base font-extrabold text-slate-900">{t('health:bpPrompt')}</h2>
              </div>

              <div className="rounded-2xl bg-[#EEF6FD] border border-sky-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 rounded-full bg-white text-sky-600 flex items-center justify-center shadow-xs">
                    <Droplet className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase text-sky-700">{t('health:systolic')}</label>
                    <input
                      type="number"
                      required
                      min={60}
                      max={260}
                      placeholder="120"
                      value={systolic}
                      onChange={(e) => setSystolic(e.target.value)}
                      className="w-full bg-transparent text-2xl font-extrabold text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-500">mmHg</span>
              </div>

              <div className="rounded-2xl bg-[#FEF2F2] border border-rose-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 rounded-full bg-white text-rose-500 flex items-center justify-center shadow-xs">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase text-rose-700">{t('health:diastolic')}</label>
                    <input
                      type="number"
                      required
                      min={30}
                      max={160}
                      placeholder="80"
                      value={diastolic}
                      onChange={(e) => setDiastolic(e.target.value)}
                      className="w-full bg-transparent text-2xl font-extrabold text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-500">mmHg</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder={t('health:pulse')}
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#F6FBFA] border border-teal-100 text-xs"
                />
                <input
                  type="text"
                  placeholder="Note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#F6FBFA] border border-teal-100 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={bpMut.isPending}
                className="w-full py-3.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 transition disabled:opacity-50"
              >
                {bpMut.isPending ? t('common:saving') : t('health:saveData')}
              </button>

              {/* App Store & Non-SaMD Required Clinical Guideline Citation */}
              {bpData?.citation && (
                <p className="text-[11px] text-slate-400 flex items-start gap-1.5 leading-relaxed pt-1">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-teal-500" />
                  <span>{bpData.citation}</span>
                </p>
              )}
            </form>

            {/* Recharts Interactive BP Trend Chart + History */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 mb-4">{t('health:bpHistory')}</h3>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[50, 180]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="systolic" name={t('health:systolic')} stroke="#0D9488" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="diastolic" name={t('health:diastolic')} stroke="#0284C7" strokeWidth={2.5} dot={{ r: 3.5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'glucose' && (
        <div className="bg-white rounded-3xl p-8 border border-teal-100 shadow-sm max-w-2xl mx-auto text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <Droplet className="w-8 h-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold">
            <Sparkles className="w-3.5 h-3.5" />
            {t('health:glucoseBadge')}
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900">{t('health:glucoseTitle')}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{t('health:glucoseDesc')}</p>
        </div>
      )}

      {tab === 'params' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              paramMut.mutate();
            }}
            className="lg:col-span-5 bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-4"
          >
            <h2 className="text-base font-extrabold text-slate-900">{t('health:paramsTitle')}</h2>
            <select value={paramType} onChange={(e) => setParamType(e.target.value)} className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm font-semibold">
              <option value="WEIGHT">Weight (kg)</option>
              <option value="HEART_RATE">Heart Rate (bpm)</option>
              <option value="SPO2">SpO₂ (%)</option>
              <option value="TEMPERATURE">Temperature (°C)</option>
            </select>
            <input type="number" step="0.1" required value={paramVal} onChange={(e) => setParamVal(e.target.value)} placeholder="64.5" className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm font-bold" />
            <button type="submit" className="w-full py-3 rounded-full bg-teal-600 text-white font-bold text-sm">{t('health:addParam')}</button>
          </form>
          <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-teal-100 shadow-sm divide-y divide-slate-100">
            {(paramData?.logs ?? []).map((p) => (
              <div key={p.id} className="py-3 flex justify-between text-sm">
                <span className="font-bold text-slate-800">{p.type}: <span className="text-teal-700">{p.value} {p.unit}</span></span>
                <span className="text-xs text-slate-400">{new Date(p.measuredAt).toLocaleDateString(dateLocale)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'checkups' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              checkupMut.mutate();
            }}
            className="lg:col-span-5 bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-4"
          >
            <h2 className="text-base font-extrabold text-slate-900">{t('health:addCheckup')}</h2>
            <input required value={checkupTitle} onChange={(e) => setCheckupTitle(e.target.value)} placeholder="ANC / PTO Check-Up" className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm" />
            <input type="datetime-local" required value={checkupDate} onChange={(e) => setCheckupDate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-xs" />
            <button type="submit" className="w-full py-3 rounded-full bg-teal-600 text-white font-bold text-sm flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> {t('health:addCheckup')}
            </button>
          </form>
          <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-teal-100 shadow-sm space-y-3">
            {(checkupData?.reminders ?? []).map((c) => (
              <div key={c.id} className="p-4 rounded-2xl bg-[#F6FBFA] border border-teal-100 flex items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-sm text-slate-900">{c.title}</div>
                  <div className="text-xs text-teal-700 font-semibold mt-0.5">{new Date(c.scheduledAt).toLocaleString(dateLocale)}</div>
                </div>
                {c.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.updateCheckup(c.id, { status: 'COMPLETED' });
                      void qc.invalidateQueries({ queryKey: ['checkups'] });
                    }}
                    className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> {t('health:markDone')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
