import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, CalendarClock, CheckCircle2, Clock, Droplet,
  Heart, HeartPulse, Info, Plus, ShieldAlert, Sparkles, Trash2, Check
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import { dateTimeInputInZone, localDateTimeToISO } from '../../utils/date';

const bpCopy = {
  id: {
    latest: 'Terakhir',
    average: 'Rata-rata',
    control: 'Terkontrol',
    controlHint: '<140/90 mmHg',
    formHint: 'Duduk tenang 5 menit sebelum mengukur. Gunakan lengan yang sama.',
    systolic: 'Sistolik',
    diastolic: 'Diastolik',
    pulse: 'Denyut nadi (opsional)',
    measuredAt: 'Tanggal & waktu',
    note: 'Catatan / keluhan (opsional)',
    empty: 'Belum ada pengukuran tekanan darah.',
    trend: 'Grafik Riwayat Tekanan Darah',
    normal: 'Normal',
    elevated: 'Sedikit tinggi',
    high: 'Tinggi',
    critical: 'Kritis',
    low: 'Rendah',
    sourceSelf: 'Mandiri',
    sourceClinic: 'Klinik',
    criticalTitle: 'Tekanan darah sangat tinggi (Kritis)',
    criticalText: 'Segera hubungi fasilitas kesehatan terdekat atau apoteker Anda. Jangan menunggu bila disertai sakit kepala berat atau pandangan kabur.',
    highTitle: 'Tekanan darah tinggi — perlu ditinjau',
    highText: 'Istirahat tenang, ukur ulang 15 menit lagi, dan konsultasikan dengan dokter atau apoteker Anda.',
    lowTitle: 'Tekanan darah rendah',
    lowText: 'Istirahat dan hubungi tenaga kesehatan bila merasa pusing berat atau lemas.',
    safety: 'Catatan ini membantu pemantauan bersama apoteker dan bukan pengganti pemeriksaan dokter.',
    error: 'Pengukuran belum dapat disimpan.',
  },
  en: {
    latest: 'Latest',
    average: 'Average',
    control: 'Controlled',
    controlHint: '<140/90 mmHg',
    formHint: 'Rest quietly for 5 minutes before measuring. Use the same arm consistently.',
    systolic: 'Systolic',
    diastolic: 'Diastolic',
    pulse: 'Pulse (optional)',
    measuredAt: 'Date & time',
    note: 'Note / symptoms (optional)',
    empty: 'No blood pressure readings yet.',
    trend: 'Blood Pressure Progress Chart',
    normal: 'Normal',
    elevated: 'Elevated',
    high: 'High',
    critical: 'Critical',
    low: 'Low',
    sourceSelf: 'Self',
    sourceClinic: 'Clinic',
    criticalTitle: 'Very high blood pressure (Critical)',
    criticalText: 'Contact a healthcare facility or clinical pharmacist immediately. Do not wait if accompanied by severe headache or vision changes.',
    highTitle: 'Elevated / high blood pressure',
    highText: 'Rest quietly, re-measure in 15 minutes, and consult your doctor or pharmacist.',
    lowTitle: 'Low blood pressure',
    lowText: 'Rest and contact a clinician if you feel dizzy, weak, or faint.',
    safety: 'This log supports clinical monitoring and does not replace medical diagnosis.',
    error: 'Unable to save reading.',
  },
};

const categoryStyle = {
  NORMAL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ELEVATED: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
  LOW: 'bg-sky-50 text-sky-700 border-sky-200',
};

const PARAM_DEFAULTS = {
  WEIGHT: { unit: 'kg', placeholder: '64.5' },
  HEART_RATE: { unit: 'bpm', placeholder: '78' },
  SPO2: { unit: '%', placeholder: '98' },
  TEMPERATURE: { unit: '°C', placeholder: '36.6' },
  FETAL_MOVEMENT: { unit: 'kicks/2h', placeholder: '12' },
  EDEMA: { unit: 'grade', placeholder: '1' },
  URINE_PROTEIN: { unit: '+', placeholder: '0' },
};

function PressureChart({ logs, title, timeZone, dateLocale }) {
  const points = [...logs].sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)).slice(-14);
  if (points.length < 2) return null;

  const width = 640;
  const height = 190;
  const pad = { top: 16, right: 16, bottom: 26, left: 38 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const minY = 50;
  const maxY = 180;
  const x = (i) => pad.left + (plotW * i) / Math.max(points.length - 1, 1);
  const y = (v) => pad.top + ((maxY - Math.min(maxY, Math.max(minY, v))) / (maxY - minY)) * plotH;
  const path = (key) => points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p[key])}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[460px] w-full" role="img" aria-label={title}>
        {[60, 90, 120, 150, 180].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} y1={y(tick)} x2={width - pad.right} y2={y(tick)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#64748b">{tick}</text>
          </g>
        ))}
        <line x1={pad.left} y1={y(140)} x2={width - pad.right} y2={y(140)} stroke="#fb923c" strokeDasharray="5 4" strokeWidth="1.3" />
        <line x1={pad.left} y1={y(90)} x2={width - pad.right} y2={y(90)} stroke="#38bdf8" strokeDasharray="5 4" strokeWidth="1.3" />
        <path d={path('systolic')} fill="none" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path('diastolic')} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(p.systolic)} r="4" fill="#0d9488" stroke="#fff" strokeWidth="1.5" />
            <circle cx={x(i)} cy={y(p.diastolic)} r="3.5" fill="#0284c7" stroke="#fff" strokeWidth="1.5" />
            {(i === 0 || i === points.length - 1 || i % 2 === 0) && (
              <text x={x(i)} y={height - 6} textAnchor="middle" fontSize="9.5" fill="#64748b">
                {new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: '2-digit', timeZone }).format(new Date(p.measuredAt))}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function ParamMiniChart({ logs, unit, timeZone, dateLocale }) {
  const points = [...logs].sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)).slice(-12);
  if (points.length < 2) return null;
  const vals = points.map((p) => p.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const span = Math.max(maxVal - minVal, 1);
  const minY = minVal - span * 0.2;
  const maxY = maxVal + span * 0.2;

  const width = 560;
  const height = 160;
  const pad = { top: 16, right: 20, bottom: 26, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (i) => pad.left + (plotW * i) / Math.max(points.length - 1, 1);
  const y = (v) => pad.top + ((maxY - v) / (maxY - minY)) * plotH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.value)}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[420px] w-full">
        {[minVal, (minVal + maxVal) / 2, maxVal].map((tick, idx) => (
          <g key={idx}>
            <line x1={pad.left} y1={y(tick)} x2={width - pad.right} y2={y(tick)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#64748b">
              {tick.toFixed(1)}
            </text>
          </g>
        ))}
        <path d={line} fill="none" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(p.value)} r="4" fill="#0d9488" stroke="#fff" strokeWidth="1.5" />
            <text x={x(i)} y={height - 6} textAnchor="middle" fontSize="9.5" fill="#64748b">
              {new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: '2-digit', timeZone }).format(new Date(p.measuredAt))}
            </text>
          </g>
        ))}
        <text x={width - pad.right} y={12} textAnchor="end" fontSize="10" fill="#0f766e" fontWeight="bold">
          {unit}
        </text>
      </svg>
    </div>
  );
}

export default function PatientBloodPressure() {
  const { user } = useAuth();
  const { lang, t, dateLocale } = useLanguage();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const tz = user.timezone || 'Asia/Jakarta';
  const text = bpCopy[lang] || bpCopy.id;
  const activeTab = searchParams.get('tab') || 'bp';

  const setTab = (tab) => {
    setSearchParams(tab === 'bp' ? {} : { tab });
  };

  // BP State
  const [bpLogs, setBpLogs] = useState([]);
  const [bpSummary, setBpSummary] = useState(null);
  const [bpForm, setBpForm] = useState({
    systolic: '',
    diastolic: '',
    pulse: '',
    measuredAt: dateTimeInputInZone(new Date(), tz),
    note: '',
  });
  const [savingBp, setSavingBp] = useState(false);
  const [bpError, setBpError] = useState('');

  // Other Health Params State
  const [paramLogs, setParamLogs] = useState([]);
  const [selectedParamType, setSelectedParamType] = useState('WEIGHT');
  const [paramForm, setParamForm] = useState({
    type: 'WEIGHT',
    value: '',
    note: '',
    measuredAt: dateTimeInputInZone(new Date(), tz),
  });
  const [savingParam, setSavingParam] = useState(false);

  // Check-Up Reminders State
  const [checkups, setCheckups] = useState([]);
  const [checkupForm, setCheckupForm] = useState({
    title: '',
    type: 'CHECKUP',
    scheduledAt: dateTimeInputInZone(new Date(Date.now() + 3 * 86400000), tz),
    location: '',
    notes: '',
  });
  const [savingCheckup, setSavingCheckup] = useState(false);

  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [bpRes, hpRes, ckRes] = await Promise.all([
        api.getBloodPressures('me', 30, 60),
        api.getHealthParameters('me', { days: 90 }).catch(() => ({ logs: [] })),
        api.getCheckups('me').catch(() => ({ reminders: [] })),
      ]);
      setBpLogs(bpRes.logs || []);
      setBpSummary(bpRes.summary || null);
      setParamLogs(hpRes.logs || []);
      setCheckups(ckRes.reminders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!socket) return;
    socket.on('blood-pressure:changed', loadAll);
    socket.on('health-parameter:changed', loadAll);
    socket.on('checkup:changed', loadAll);
    return () => {
      socket.off('blood-pressure:changed', loadAll);
      socket.off('health-parameter:changed', loadAll);
      socket.off('checkup:changed', loadAll);
    };
  }, [socket, loadAll]);

  const handleSaveBp = async (e) => {
    e.preventDefault();
    setBpError('');
    setSavingBp(true);
    try {
      await api.recordBloodPressure('me', {
        systolic: Number(bpForm.systolic),
        diastolic: Number(bpForm.diastolic),
        pulse: bpForm.pulse ? Number(bpForm.pulse) : null,
        measuredAt: bpForm.measuredAt ? localDateTimeToISO(bpForm.measuredAt, tz) : undefined,
        note: bpForm.note.trim() || null,
      });
      setBpForm({
        systolic: '',
        diastolic: '',
        pulse: '',
        measuredAt: dateTimeInputInZone(new Date(), tz),
        note: '',
      });
      await loadAll();
    } catch (err) {
      setBpError(err.message || text.error);
    } finally {
      setSavingBp(false);
    }
  };

  const handleSaveParam = async (e) => {
    e.preventDefault();
    if (!paramForm.value) return;
    setSavingParam(true);
    try {
      await api.recordHealthParameter('me', {
        type: paramForm.type,
        value: Number(paramForm.value),
        unit: PARAM_DEFAULTS[paramForm.type]?.unit || '',
        note: paramForm.note.trim() || null,
        measuredAt: paramForm.measuredAt ? localDateTimeToISO(paramForm.measuredAt, tz) : undefined,
      });
      setSelectedParamType(paramForm.type);
      setParamForm((prev) => ({
        ...prev,
        value: '',
        note: '',
        measuredAt: dateTimeInputInZone(new Date(), tz),
      }));
      await loadAll();
    } catch (err) {
      alert(err.message || text.error);
    } finally {
      setSavingParam(false);
    }
  };

  const handleCreateCheckup = async (e) => {
    e.preventDefault();
    if (!checkupForm.title.trim()) return;
    setSavingCheckup(true);
    try {
      await api.createCheckup('me', {
        title: checkupForm.title.trim(),
        type: checkupForm.type,
        scheduledAt: localDateTimeToISO(checkupForm.scheduledAt, tz),
        location: checkupForm.location.trim() || null,
        notes: checkupForm.notes.trim() || null,
      });
      setCheckupForm({
        title: '',
        type: 'CHECKUP',
        scheduledAt: dateTimeInputInZone(new Date(Date.now() + 7 * 86400000), tz),
        location: '',
        notes: '',
      });
      await loadAll();
    } catch (err) {
      alert(err.message || text.error);
    } finally {
      setSavingCheckup(false);
    }
  };

  const handleCompleteCheckup = async (id) => {
    await api.updateCheckup(id, { status: 'COMPLETED' });
    await loadAll();
  };

  const handleDeleteCheckup = async (id) => {
    await api.deleteCheckup(id);
    await loadAll();
  };

  const latestBp = bpSummary?.latest;
  const filteredParams = paramLogs.filter((p) => p.type === selectedParamType);

  const tabs = [
    { id: 'bp', label: t.health.tabBp, icon: HeartPulse },
    { id: 'glucose', label: t.health.tabGlucose, icon: Droplet, badge: 'Soon' },
    { id: 'params', label: t.health.tabParams, icon: Activity },
    { id: 'checkups', label: t.health.tabCheckups, icon: CalendarClock, count: checkups.filter((c) => c.status === 'UPCOMING').length },
  ];

  const formatDate = (iso) =>
    new Intl.DateTimeFormat(dateLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz,
    }).format(new Date(iso));

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-14 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.health.pageTitle}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t.health.pageSubtitle}</p>
      </div>

      {/* Section B Feature Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap border transition ${
                active
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-white text-slate-600 border-teal-100 hover:bg-teal-50 hover:text-teal-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                  {tab.badge}
                </span>
              )}
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/25 text-white' : 'bg-teal-100 text-teal-800'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: BLOOD PRESSURE (DoseLynx Screen 4) ================= */}
      {activeTab === 'bp' && (
        <div className="space-y-6">
          {/* Safety Triage Banner */}
          {latestBp?.category === 'CRITICAL' && (
            <div className="rounded-3xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3 text-rose-900">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-extrabold text-sm">{text.criticalTitle}</h3>
                <p className="text-xs mt-1 leading-relaxed">{text.criticalText}</p>
              </div>
            </div>
          )}
          {latestBp?.category === 'HIGH' && (
            <div className="rounded-3xl bg-orange-50 border border-orange-200 p-4 flex items-start gap-3 text-orange-900">
              <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-extrabold text-sm">{text.highTitle}</h3>
                <p className="text-xs mt-1 leading-relaxed">{text.highText}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Friendly DoseLynx Screen 4 Input Card */}
            <form
              onSubmit={handleSaveBp}
              className="lg:col-span-5 bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-5"
            >
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                  <HeartPulse className="w-8 h-8" />
                </div>
                <h2 className="text-base font-extrabold text-slate-900">{t.health.bpPrompt}</h2>
                <p className="text-xs text-slate-500 mt-1">{text.formHint}</p>
              </div>

              {bpError && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                  {bpError}
                </div>
              )}

              {/* Big Pill Input: Systolic */}
              <div className="rounded-2xl bg-[#EEF6FD] border border-sky-100 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-white text-sky-600 flex items-center justify-center shadow-xs shrink-0">
                    <Droplet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-sky-700">
                      {text.systolic}
                    </label>
                    <input
                      type="number"
                      required
                      min="60"
                      max="260"
                      placeholder="120"
                      value={bpForm.systolic}
                      onChange={(e) => setBpForm((p) => ({ ...p, systolic: e.target.value }))}
                      className="w-full bg-transparent text-2xl font-extrabold text-slate-900 placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-500 shrink-0">mmHg</span>
              </div>

              {/* Big Pill Input: Diastolic */}
              <div className="rounded-2xl bg-[#FEF2F2] border border-rose-100 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-white text-rose-500 flex items-center justify-center shadow-xs shrink-0">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-700">
                      {text.diastolic}
                    </label>
                    <input
                      type="number"
                      required
                      min="30"
                      max="160"
                      placeholder="80"
                      value={bpForm.diastolic}
                      onChange={(e) => setBpForm((p) => ({ ...p, diastolic: e.target.value }))}
                      className="w-full bg-transparent text-2xl font-extrabold text-slate-900 placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-500 shrink-0">mmHg</span>
              </div>

              {/* Optional Pulse, Time, Note */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{text.pulse}</label>
                  <input
                    type="number"
                    min="30"
                    max="220"
                    placeholder="76"
                    value={bpForm.pulse}
                    onChange={(e) => setBpForm((p) => ({ ...p, pulse: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F6FBFA] border border-teal-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{text.measuredAt}</label>
                  <input
                    type="datetime-local"
                    value={bpForm.measuredAt}
                    onChange={(e) => setBpForm((p) => ({ ...p, measuredAt: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6FBFA] border border-teal-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">{text.note}</label>
                <input
                  type="text"
                  value={bpForm.note}
                  onChange={(e) => setBpForm((p) => ({ ...p, note: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6FBFA] border border-teal-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingBp}
                className="w-full py-3.5 px-5 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 transition disabled:opacity-50"
              >
                {savingBp ? t.common.saving : t.health.bpSave}
              </button>

              <p className="text-[11px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-teal-500" />
                <span>{text.safety}</span>
              </p>
            </form>

            {/* Right: Summary KPIs, Progress Chart, History */}
            <div className="lg:col-span-7 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-teal-100/80 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">{text.latest}</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">
                    {latestBp ? `${latestBp.systolic}/${latestBp.diastolic}` : '—'}
                  </div>
                  {latestBp && (
                    <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${categoryStyle[latestBp.category]}`}>
                      {text[latestBp.category.toLowerCase()] || latestBp.category}
                    </span>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-4 border border-teal-100/80 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">{text.average}</span>
                  <div className="text-xl font-extrabold text-teal-700 mt-1">
                    {bpSummary?.average ? `${bpSummary.average.systolic}/${bpSummary.average.diastolic}` : '—'}
                  </div>
                  <span className="text-[10px] text-slate-400">mmHg</span>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-teal-100/80 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">{text.control}</span>
                  <div className="text-xl font-extrabold text-emerald-600 mt-1">
                    {bpSummary?.controlRate !== null && bpSummary?.controlRate !== undefined ? `${bpSummary.controlRate}%` : '—'}
                  </div>
                  <span className="text-[10px] text-slate-400">{text.controlHint}</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-teal-100/80 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-extrabold text-slate-900">{text.trend}</h3>
                  <div className="flex items-center gap-3 text-[11px] font-semibold">
                    <span className="flex items-center gap-1 text-teal-700"><span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> {text.systolic}</span>
                    <span className="flex items-center gap-1 text-sky-700"><span className="w-2.5 h-2.5 rounded-full bg-sky-600" /> {text.diastolic}</span>
                  </div>
                </div>
                {bpLogs.length >= 2 ? (
                  <PressureChart logs={bpLogs} title={text.trend} timeZone={tz} dateLocale={dateLocale} />
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">{text.empty}</p>
                )}
              </div>

              <div className="bg-white rounded-3xl p-5 border border-teal-100/80 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3">{t.health.bpHistory}</h3>
                {bpLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">{text.empty}</p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
                    {bpLogs.map((log) => (
                      <div key={log.id} className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {log.systolic}/{log.diastolic} mmHg
                            </span>
                            {log.pulse && <span className="text-xs text-slate-500">• {log.pulse} bpm</span>}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${categoryStyle[log.category]}`}>
                              {text[log.category.toLowerCase()] || log.category}
                            </span>
                          </div>
                          {log.note && <p className="text-xs text-slate-500 mt-0.5">{log.note}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.measuredAt)}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {log.source === 'CLINIC' ? text.sourceClinic : text.sourceSelf}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: BLOOD GLUCOSE (UNDER DEVELOPMENT) ================= */}
      {activeTab === 'glucose' && (
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-teal-100 shadow-sm max-w-3xl mx-auto text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <Droplet className="w-8 h-8" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              {t.health.glucoseBadge}
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-3">{t.health.glucoseTitle}</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-xl mx-auto leading-relaxed">
              {t.health.glucoseDesc}
            </p>
          </div>

          <div className="bg-[#F4FAF9] rounded-2xl p-5 border border-teal-100 text-left max-w-lg mx-auto">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-teal-800 mb-3">
              {t.health.glucosePlannedTitle}
            </h3>
            <ul className="space-y-2.5">
              {t.health.glucoseItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs font-medium text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ================= TAB 3: OTHER RELEVANT HEALTH PARAMETERS ================= */}
      {activeTab === 'params' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveParam}
            className="lg:col-span-5 bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-4"
          >
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{t.health.paramsTitle}</h2>
              <p className="text-xs text-slate-500 mt-1">{t.health.paramsSubtitle}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'id' ? 'Jenis Parameter' : 'Parameter Type'}
              </label>
              <select
                value={paramForm.type}
                onChange={(e) => {
                  setParamForm((p) => ({ ...p, type: e.target.value }));
                  setSelectedParamType(e.target.value);
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {Object.keys(PARAM_DEFAULTS).map((key) => (
                  <option key={key} value={key}>
                    {t.health.paramTypes[key]} ({PARAM_DEFAULTS[key].unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'id' ? 'Nilai' : 'Value'} ({PARAM_DEFAULTS[paramForm.type]?.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder={PARAM_DEFAULTS[paramForm.type]?.placeholder}
                  value={paramForm.value}
                  onChange={(e) => setParamForm((p) => ({ ...p, value: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{text.measuredAt}</label>
                <input
                  type="datetime-local"
                  value={paramForm.measuredAt}
                  onChange={(e) => setParamForm((p) => ({ ...p, measuredAt: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{text.note}</label>
              <input
                type="text"
                value={paramForm.note}
                onChange={(e) => setParamForm((p) => ({ ...p, note: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingParam}
              className="w-full py-3 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm transition disabled:opacity-50"
            >
              {savingParam ? t.common.saving : t.health.addParam}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-5">
            {/* Parameter Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {Object.keys(PARAM_DEFAULTS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedParamType(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    selectedParamType === key
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-teal-100 hover:bg-teal-50'
                  }`}
                >
                  {t.health.paramTypes[key]}
                </button>
              ))}
            </div>

            {/* Progress Chart */}
            <div className="bg-white rounded-3xl p-5 border border-teal-100/80 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 mb-3">
                {t.health.paramChartTitle}: {t.health.paramTypes[selectedParamType]}
              </h3>
              {filteredParams.length >= 2 ? (
                <ParamMiniChart
                  logs={filteredParams}
                  unit={PARAM_DEFAULTS[selectedParamType]?.unit}
                  timeZone={tz}
                  dateLocale={dateLocale}
                />
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">
                  {lang === 'id'
                    ? 'Tambahkan minimal 2 catatan untuk menampilkan grafik perkembangan.'
                    : 'Record at least 2 entries to view your progress chart.'}
                </p>
              )}
            </div>

            {/* Parameter History */}
            <div className="bg-white rounded-3xl p-5 border border-teal-100/80 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 mb-3">{t.health.paramHistory}</h3>
              {paramLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">{t.health.noParams}</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {paramLogs.map((log) => (
                    <div key={log.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full mr-2">
                          {t.health.paramTypes[log.type] || log.type}
                        </span>
                        <span className="font-extrabold text-slate-900 text-sm">
                          {log.value} {log.unit}
                        </span>
                        {log.note && <p className="text-xs text-slate-500 mt-0.5">{log.note}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400">{formatDate(log.measuredAt)}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.deleteHealthParameter(log.id);
                            await loadAll();
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: FOLLOW-UP & CHECK-UP REMINDERS ================= */}
      {activeTab === 'checkups' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCreateCheckup}
            className="lg:col-span-5 bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-4"
          >
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{t.health.addCheckup}</h2>
              <p className="text-xs text-slate-500 mt-1">{t.health.checkupsSubtitle}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.health.checkupTitleLabel}</label>
              <input
                type="text"
                required
                placeholder={t.health.checkupTitlePlaceholder}
                value={checkupForm.title}
                onChange={(e) => setCheckupForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.health.checkupTypeLabel}</label>
                <select
                  value={checkupForm.type}
                  onChange={(e) => setCheckupForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {Object.keys(t.health.checkupTypes).map((k) => (
                    <option key={k} value={k}>{t.health.checkupTypes[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.health.checkupDateLabel}</label>
                <input
                  type="datetime-local"
                  required
                  value={checkupForm.scheduledAt}
                  onChange={(e) => setCheckupForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.health.checkupLocationLabel}</label>
              <input
                type="text"
                value={checkupForm.location}
                onChange={(e) => setCheckupForm((p) => ({ ...p, location: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.health.checkupNotesLabel}</label>
              <textarea
                rows={2}
                value={checkupForm.notes}
                onChange={(e) => setCheckupForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingCheckup}
              className="w-full py-3 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{savingCheckup ? t.common.saving : t.health.addCheckup}</span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-teal-100/80 shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">{t.health.checkupsTitle}</h3>
            {checkups.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">{t.health.noCheckups}</p>
            ) : (
              <div className="space-y-3">
                {checkups.map((item) => {
                  const isDone = item.status === 'COMPLETED';
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDone ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-[#F6FBFA] border-teal-100'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-800'
                          }`}>
                            {t.health.checkupTypes[item.type] || item.type}
                          </span>
                          <span className="text-xs font-bold text-teal-700">
                            {formatDate(item.scheduledAt)}
                          </span>
                        </div>
                        <h4 className={`font-extrabold text-sm mt-1 ${isDone ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {item.title}
                        </h4>
                        {item.location && <p className="text-xs text-slate-600 mt-0.5">📍 {item.location}</p>}
                        {item.notes && <p className="text-xs text-slate-500 mt-1">{item.notes}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isDone && (
                          <button
                            type="button"
                            onClick={() => handleCompleteCheckup(item.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{t.health.markDone}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCheckup(item.id)}
                          className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
