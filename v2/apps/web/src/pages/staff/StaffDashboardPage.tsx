import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, BarChart3, CheckCircle2, Clock, Download, HeartPulse,
  MessageSquare, Pill, QrCode, Search, UserCheck, Users
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { api } from '../../lib/api';

export default function StaffDashboardPage() {
  const { t, i18n } = useTranslation(['staff', 'common', 'nav']);
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || 'overview';
  const qc = useQueryClient();

  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [search, setSearch] = useState('');
  const [anonymize, setAnonymize] = useState(true);
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'id-ID';

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary', trendDays],
    queryFn: () => api.getDashboardSummary(trendDays),
  });

  const { data: tenantRes } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: () => api.getCurrentTenant(),
  });

  const { data: patientsRes } = useQuery({
    queryKey: ['patients-list', search],
    queryFn: () => api.getPatients(search),
  });

  const ackMut = useMutation({
    mutationFn: (bpId: string) => api.acknowledgeCriticalBp(bpId),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success(`Acknowledged in ${res.responseSeconds}s (SLA logged)`);
    },
  });

  const trendData = (summary?.trend ?? []).map((pt) => ({
    date: new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'numeric' }).format(new Date(`${pt.date}T00:00:00`)),
    adherence: pt.adherenceRate,
    bpControl: pt.bpControlRate,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('staff:dashboardTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('staff:dashboardSubtitle')}</p>
        </div>

        {/* Pharmacy QR Invite Code Pill */}
        {tenantRes?.tenant && (
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-teal-100 shadow-xs">
            <QrCode className="w-5 h-5 text-teal-600" />
            <div className="leading-tight">
              <div className="text-[10px] font-bold uppercase text-slate-400">{t('staff:qrInviteTitle')}</div>
              <div className="text-sm font-mono font-extrabold text-teal-800">{tenantRes.tenant.inviteCode}</div>
            </div>
          </div>
        )}
      </div>

      {/* 4 KPI Cards matching DoseLynx Dashboard Web Farmasis Mockup */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{t('staff:kpiTotal')}</p>
            <div className="text-3xl font-extrabold text-slate-900">{summary?.kpis.totalPatients ?? 0}</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{t('staff:kpiActive')}</p>
            <div className="text-3xl font-extrabold text-slate-900">{summary?.kpis.activePatients ?? 0}</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{t('staff:kpiFollowUp')}</p>
            <div className="text-3xl font-extrabold text-rose-600">{summary?.kpis.needsFollowUp ?? 0}</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{t('staff:kpiAdherence')}</p>
            <div className="text-3xl font-extrabold text-teal-700">
              {summary?.kpis.avgAdherence30d !== null && summary?.kpis.avgAdherence30d !== undefined
                ? `${summary.kpis.avgAdherence30d}%`
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Clinical Insights Row (Patients at Risk | Recharts Dual Chart | Recent Activity) */}
      {(view === 'overview' || view === 'monitoring') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Patients at Risk */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-teal-100 shadow-xs flex flex-col">
            <h2 className="text-sm font-extrabold text-slate-900 mb-4">{t('staff:atRiskTitle')}</h2>
            <div className="space-y-2.5 flex-1">
              {(summary?.atRiskPatients ?? []).length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">{t('staff:atRiskEmpty')}</p>
              ) : (
                summary!.atRiskPatients.map((rp) => (
                  <div key={rp.patientId} className="p-3 rounded-2xl bg-[#FFF8F8] border border-rose-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                        {rp.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">{rp.name}</div>
                        <div className="text-[11px] font-semibold text-rose-600 mt-0.5">
                          {rp.adherence30 !== null ? `${rp.adherence30}%` : '—'}
                          {rp.latestBp ? ` • TD ${rp.latestBp.systolic}/${rp.latestBp.diastolic}` : ''}
                        </div>
                      </div>
                    </div>
                    {rp.latestBp?.alertStatus === 'PENDING_ACK' && (
                      <button
                        type="button"
                        onClick={() => ackMut.mutate(rp.latestBp!.id)}
                        className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-bold shrink-0 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Ack
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Interactive Recharts Dual-Line Chart */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-teal-100 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold text-slate-900">{t('staff:chartTitle')}</h2>
              <select
                value={trendDays}
                onChange={(e) => setTrendDays(Number(e.target.value) as 7 | 30)}
                className="text-xs font-bold bg-[#F4FAF9] border border-teal-100 rounded-xl px-2.5 py-1.5"
              >
                <option value={7}>{t('staff:last7Days')}</option>
                <option value={30}>{t('staff:last30Days')}</option>
              </select>
            </div>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="adherence" name={t('staff:chartAdherence')} stroke="#10B981" strokeWidth={2.5} dot={{ r: 3.5 }} connectNulls />
                  <Line type="monotone" dataKey="bpControl" name={t('staff:chartBp')} stroke="#0284C7" strokeWidth={2.5} dot={{ r: 3.5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="lg:col-span-3 bg-white rounded-3xl p-5 border border-teal-100 shadow-xs flex flex-col">
            <h2 className="text-sm font-extrabold text-slate-900 mb-4">{t('staff:recentActivityTitle')}</h2>
            <div className="space-y-3 overflow-y-auto max-h-56">
              {(summary?.recentActivity ?? []).map((act) => {
                const Icon = act.kind === 'DOSE' ? Pill : act.kind === 'BP' ? HeartPulse : MessageSquare;
                return (
                  <div key={act.id} className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{act.patientName}</div>
                      <div className="text-[11px] text-slate-500 truncate">{act.detail}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Intl.DateTimeFormat(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(act.timestamp))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tenant-Isolated Patient Table */}
      {(view === 'overview' || view === 'patients') && (
        <div className="bg-white rounded-3xl border border-teal-100 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-slate-900">{t('nav:patients')}</h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common:search')}
                className="w-full pl-10 pr-4 py-2 bg-[#F6FBFA] border border-teal-100 rounded-2xl text-xs"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FCFB] border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">{t('staff:colCode')}</th>
                  <th className="px-5 py-3">{t('staff:colPatient')}</th>
                  <th className="px-5 py-3">{t('staff:colDiagnosis')}</th>
                  <th className="px-5 py-3 text-center">{t('staff:colAdherence30d')}</th>
                  <th className="px-5 py-3">{t('staff:colLatestBp')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(patientsRes?.patients ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-[#F7FCFB]">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-500">{p.studyCode || '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-extrabold text-slate-900">{p.user.name}</div>
                      <div className="text-[11px] text-slate-400">{p.user.phone || p.user.email}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">{p.diagnosis || '—'}</td>
                    <td className="px-5 py-3.5 text-center font-extrabold">
                      <span className={`px-2.5 py-0.5 rounded-full ${
                        (p.adherence30 ?? 100) >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {p.adherence30 !== null ? `${p.adherence30}%` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold">
                      {p.latestBloodPressure ? `${p.latestBloodPressure.systolic}/${p.latestBloodPressure.diastolic} mmHg` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bioethics Streaming CSV Export */}
      {(view === 'overview' || view === 'reports') && (
        <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">{t('staff:exportTitle')}</h2>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 mt-1 cursor-pointer">
              <input type="checkbox" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} />
              <span>{t('staff:anonymizeLabel')}</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void api.downloadExport('patients', anonymize)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5" /> patients.csv
            </button>
            <button
              type="button"
              onClick={() => void api.downloadExport('blood-pressure', anonymize)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5" /> blood-pressure.csv
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
