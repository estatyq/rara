import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Users, Search, UserPlus, MessageSquare, ArrowRight, Activity,
  FileSpreadsheet, HeartPulse, Stethoscope, AlertCircle, BarChart3,
  UserCheck, Pill, Clock, X
} from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';

function DualTrendChart({ trend, t, dateLocale }) {
  if (!trend?.length) return null;
  const width = 460;
  const height = 185;
  const pad = { top: 18, right: 16, bottom: 26, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const x = (i) => pad.left + (plotW * i) / Math.max(trend.length - 1, 1);
  const y = (pct) => pad.top + ((100 - Math.min(100, Math.max(0, pct))) / 100) * plotH;

  const buildPath = (key) => {
    let d = '';
    trend.forEach((pt, i) => {
      if (pt[key] === null || pt[key] === undefined) return;
      d += `${d ? ' L ' : 'M '}${x(i)} ${y(pt[key])}`;
    });
    return d;
  };

  const adhPath = buildPath('adherenceRate');
  const bpPath = buildPath('bpControlRate');
  const stepLabel = Math.max(1, Math.ceil(trend.length / 7));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[320px]">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} y1={y(tick)} x2={width - pad.right} y2={y(tick)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.left - 7} y={y(tick) + 3.5} textAnchor="end" fontSize="9.5" fill="#94a3b8">
              {tick}%
            </text>
          </g>
        ))}

        {adhPath && (
          <path d={adhPath} fill="none" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {bpPath && (
          <path d={bpPath} fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {trend.map((pt, i) => (
          <g key={pt.date}>
            {pt.adherenceRate !== null && pt.adherenceRate !== undefined && (
              <circle cx={x(i)} cy={y(pt.adherenceRate)} r="3.5" fill="#10b981" stroke="#fff" strokeWidth="1.4" />
            )}
            {pt.bpControlRate !== null && pt.bpControlRate !== undefined && (
              <circle cx={x(i)} cy={y(pt.bpControlRate)} r="3.5" fill="#0284c7" stroke="#fff" strokeWidth="1.4" />
            )}
            {(i % stepLabel === 0 || i === trend.length - 1) && (
              <text x={x(i)} y={height - 6} textAnchor="middle" fontSize="9.5" fill="#64748b">
                {new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'numeric' }).format(new Date(`${pt.date}T00:00:00`))}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function StaffDashboard() {
  const { t, lang, dateLocale } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || 'overview';

  const [summary, setSummary] = useState(null);
  const [trendDays, setTrendDays] = useState(7);
  const [patients, setPatients] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [replyTarget, setReplyTarget] = useState(null);
  const [replyForm, setReplyForm] = useState({
    status: 'CONFIRMED',
    pharmacistReply: '',
    notifyWhatsApp: true,
  });

  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', password: '', studyCode: '', pharmacistId: '',
    diagnosis: '', allergies: '', estimatedDueDate: '', studyGroup: 'INTERVENTION',
    riskFactors: '', baselineSystolic: '', baselineDiastolic: '', consentAccepted: false,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const params = { q: searchQuery };
      if (mineOnly) params.mine = '1';
      const [sumRes, pRes, srRes, stRes] = await Promise.all([
        api.getDashboardSummary({ days: String(trendDays), ...(mineOnly ? { mine: '1' } : {}) }).catch(() => null),
        api.getPatients(params),
        api.getServiceRequests(mineOnly ? { mine: '1' } : {}).catch(() => ({ requests: [] })),
        api.getStaffList().catch(() => ({ users: [] })),
      ]);
      setSummary(sumRes);
      setPatients(pRes.patients || []);
      setServiceRequests(srRes.requests || []);
      setStaffList((stRes.users || []).filter((u) => u.role === 'PHARMACIST'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, mineOnly, trendDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.password || (!formData.phone && !formData.email)) {
      setFormError(t.auth.errFillRequired);
      return;
    }
    if (!formData.consentAccepted) {
      setFormError(t.auth.errConsentRequired);
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      await api.createPatient({
        ...formData,
        pharmacistId: formData.pharmacistId || user.id,
        consentAccepted: true,
      });
      setShowAddModal(false);
      setFormData({
        name: '', phone: '', email: '', password: '', studyCode: '', pharmacistId: '',
        diagnosis: '', allergies: '', estimatedDueDate: '', studyGroup: 'INTERVENTION',
        riskFactors: '', baselineSystolic: '', baselineDiastolic: '', consentAccepted: false,
      });
      await loadData();
    } catch (err) {
      setFormError(err.message || t.auth.errRegisterFailed);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateServiceRequest = async (e) => {
    e.preventDefault();
    if (!replyTarget) return;
    try {
      await api.updateServiceRequest(replyTarget.id, replyForm);
      setReplyTarget(null);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const kpis = summary?.kpis || {
    totalPatients: patients.length,
    activePatients: patients.length,
    needsFollowUp: serviceRequests.filter((r) => r.status === 'PENDING').length,
    avgAdherence30d: null,
  };

  const activityMeta = (act) => {
    if (act.kind === 'DOSE') return { icon: Pill, label: t.staff.actDose, cls: 'bg-emerald-50 text-emerald-700' };
    if (act.kind === 'BP') return { icon: HeartPulse, label: t.staff.actBp, cls: 'bg-rose-50 text-rose-600' };
    if (act.kind === 'HEALTH_PARAM') return { icon: Activity, label: t.staff.actParam, cls: 'bg-sky-50 text-sky-700' };
    return { icon: MessageSquare, label: t.staff.actMsg, cls: 'bg-teal-50 text-teal-700' };
  };

  const fmtTime = (iso) =>
    new Intl.DateTimeFormat(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

  const showOverview = view === 'overview';
  const showPatients = view === 'overview' || view === 'patients';
  const showServices = view === 'overview' || view === 'monitoring';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Title & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {view === 'patients'
              ? t.staff.patientList
              : view === 'monitoring'
              ? t.nav.monitoring
              : t.staff.dashboardTitle}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.staff.dashboardSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/staff/export"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-teal-100 text-slate-700 hover:bg-teal-50 text-xs font-bold shadow-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600" />
            <span>{t.nav.researchExport}</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.staff.newPatient}</span>
          </button>
        </div>
      </div>

      {/* ================= OVERVIEW KPIs & 3-COLUMN WIDGETS (DoseLynx Mockup) ================= */}
      {showOverview && (
        <>
          {/* 4 KPI Cards matching DoseLynx Dashboard Web Farmasis */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-teal-100/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">{t.staff.kpiTotalPatients}</p>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-0.5">{kpis.totalPatients}</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-teal-100/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">{t.staff.kpiActivePatients}</p>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-0.5">{kpis.activePatients}</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-teal-100/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">{t.staff.kpiNeedsFollowUp}</p>
                <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 mt-0.5">{kpis.needsFollowUp}</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-teal-100/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">{t.staff.kpiAvgAdherence}</p>
                <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-0.5">
                  {kpis.avgAdherence30d !== null && kpis.avgAdherence30d !== undefined ? `${kpis.avgAdherence30d}%` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* 3-Column Clinical Insights Row (At-Risk | Dual Trend Chart | Recent Activity) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* 1. Patients at Risk */}
            <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-teal-100/80 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-extrabold text-slate-900">{t.staff.atRiskTitle}</h2>
                <Link to="/staff?view=patients" className="text-xs font-bold text-teal-700 hover:underline">
                  {t.common.viewAll} →
                </Link>
              </div>
              {!summary?.atRiskPatients?.length ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-8">
                  {t.staff.atRiskEmpty}
                </div>
              ) : (
                <div className="space-y-2.5 flex-1">
                  {summary.atRiskPatients.slice(0, 4).map((rp) => (
                    <Link
                      key={rp.id}
                      to={`/staff/patients/${rp.id}`}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-[#FFF8F8] hover:bg-rose-50 border border-rose-100 transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                        {rp.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-xs truncate">{rp.name}</div>
                        <div className="text-[11px] font-semibold text-rose-600 mt-0.5 flex flex-wrap gap-x-2">
                          {rp.adherence30 !== null && rp.adherence30 !== undefined && (
                            <span>{lang === 'id' ? 'Kepatuhan' : 'Adherence'} {rp.adherence30}%</span>
                          )}
                          {rp.latestBp && (
                            <span>• {lang === 'id' ? 'TD' : 'BP'} {rp.latestBp.systolic}/{rp.latestBp.diastolic}</span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Dual-Line Adherence & BP Control Trend Chart */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-teal-100/80 shadow-xs flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-extrabold text-slate-900">{t.staff.chartTitle}</h2>
                <select
                  value={trendDays}
                  onChange={(e) => setTrendDays(Number(e.target.value))}
                  className="text-xs font-bold text-slate-700 bg-[#F4FAF9] border border-teal-100 rounded-xl px-2.5 py-1.5 focus:outline-none"
                >
                  <option value={7}>{t.staff.last7Days}</option>
                  <option value={30}>{t.staff.last30Days}</option>
                </select>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-bold mb-2">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  {t.staff.chartAdherence}
                </span>
                <span className="flex items-center gap-1.5 text-sky-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  {t.staff.chartBpControl}
                </span>
              </div>
              <div className="flex-1 flex items-center">
                <DualTrendChart trend={summary?.trend || []} t={t} dateLocale={dateLocale} />
              </div>
            </div>

            {/* 3. Recent Activity Feed */}
            <div className="lg:col-span-3 bg-white rounded-3xl p-5 border border-teal-100/80 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-extrabold text-slate-900">{t.staff.recentActivityTitle}</h2>
                <Link to="/staff/inbox" className="text-xs font-bold text-teal-700 hover:underline">
                  {t.common.viewAll} →
                </Link>
              </div>
              {!summary?.recentActivity?.length ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-8">
                  {t.staff.recentActivityEmpty}
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto max-h-64 pr-1">
                  {summary.recentActivity.slice(0, 6).map((act) => {
                    const meta = activityMeta(act);
                    const Icon = meta.icon;
                    return (
                      <Link
                        key={act.id}
                        to={`/staff/patients/${act.patientId}`}
                        className="flex items-start gap-2.5 group"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${meta.cls}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-teal-700 truncate">
                            {act.patientName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {meta.label} • {act.detail}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {fmtTime(act.timestamp)}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ================= PATIENT LIST TABLE ================= */}
      {showPatients && (
        <div className="bg-white rounded-3xl border border-teal-100/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex bg-[#F4FAF9] p-1 rounded-2xl border border-teal-100 self-start">
              <button
                type="button"
                onClick={() => setMineOnly(false)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${!mineOnly ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600'}`}
              >
                {lang === 'id' ? 'Semua Pasien' : 'All Patients'}
              </button>
              <button
                type="button"
                onClick={() => setMineOnly(true)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${mineOnly ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600'}`}
              >
                {lang === 'id' ? 'Pasien Saya' : 'My Patients'}
              </button>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.staff.searchPatient}
                className="w-full pl-10 pr-4 py-2 bg-[#F6FBFA] border border-teal-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-slate-500 text-sm">{t.common.loading}</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FCFB] border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-3.5">{t.staff.studyCode}</th>
                    <th className="px-5 py-3.5">{t.staff.name}</th>
                    <th className="px-5 py-3.5">{t.staff.diagnosis}</th>
                    <th className="px-5 py-3.5 text-center">{t.staff.activeMeds}</th>
                    <th className="px-5 py-3.5 text-center">{t.staff.adherence30d}</th>
                    <th className="px-5 py-3.5">{t.health.tabBp}</th>
                    <th className="px-5 py-3.5 text-right">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patients.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F7FCFB] transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-600">
                        {p.studyCode || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-extrabold text-slate-900">{p.user?.name}</div>
                        <div className="text-[11px] text-slate-500">{p.user?.phone || p.user?.email}</div>
                      </td>
                      <td className="px-5 py-3.5 max-w-xs truncate text-slate-600">{p.diagnosis || '—'}</td>
                      <td className="px-5 py-3.5 text-center font-bold text-slate-800">{p.activeMedications}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-extrabold text-[11px] ${
                          p.adherence30 === null || p.adherence30 === undefined
                            ? 'bg-slate-100 text-slate-500'
                            : p.adherence30 >= 80
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {p.adherence30 !== null && p.adherence30 !== undefined ? `${p.adherence30}%` : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {p.latestBloodPressure ? (
                          <span className={
                            p.latestBloodPressure.category === 'CRITICAL' || p.latestBloodPressure.category === 'HIGH'
                              ? 'text-rose-600'
                              : 'text-emerald-700'
                          }>
                            {p.latestBloodPressure.systolic}/{p.latestBloodPressure.diastolic} mmHg
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/staff/patients/${p.id}`}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-teal-50 hover:bg-teal-600 text-teal-800 hover:text-white font-bold text-xs transition"
                        >
                          <span>{lang === 'id' ? 'Kelola & PTO' : 'Manage & PTO'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ================= PHARMACEUTICAL CARE SERVICE REQUESTS ================= */}
      {showServices && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-teal-100/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-600" />
              <span>{lang === 'id' ? 'Permintaan Layanan Farmasi & Follow-Up' : 'Pharmaceutical Care Requests'}</span>
            </h2>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
              {serviceRequests.length} {lang === 'id' ? 'Permintaan' : 'Requests'}
            </span>
          </div>

          {serviceRequests.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              {lang === 'id' ? 'Belum ada permintaan layanan.' : 'No service requests yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {serviceRequests.map((req) => (
                <div key={req.id} className="rounded-2xl p-4 border border-teal-100 bg-[#F9FCFB] flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900">
                        {lang === 'en' ? req.service?.nameEn : req.service?.nameId}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        req.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : req.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-teal-800 mt-1">
                      {req.patient?.user?.name} ({req.patient?.user?.phone || req.patient?.user?.email})
                    </p>
                    {req.complaint && <p className="text-xs text-slate-600 mt-1.5 italic">"{req.complaint}"</p>}
                    {req.pharmacistReply && (
                      <div className="mt-2 p-2.5 rounded-xl bg-white border border-teal-100 text-xs text-slate-700">
                        <strong>{lang === 'id' ? 'Balasan:' : 'Reply:'}</strong> {req.pharmacistReply}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-teal-100/70">
                    <Link
                      to={`/staff/patients/${req.patientId}`}
                      className="text-xs font-bold text-teal-700 hover:underline"
                    >
                      {lang === 'id' ? 'Buka Rekam Pasien →' : 'Open Patient Record →'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTarget(req);
                        setReplyForm({
                          status: req.status === 'PENDING' ? 'CONFIRMED' : req.status,
                          pharmacistReply: req.pharmacistReply || '',
                          notifyWhatsApp: true,
                        });
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition"
                    >
                      {lang === 'id' ? 'Tindak Lanjuti' : 'Follow Up'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enroll New Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-teal-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900">{t.staff.newPatient}</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 rounded-xl hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePatient} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.auth.fullName} *</label>
                  <input required value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.staff.studyCode}</label>
                  <input placeholder="P-005" value={formData.studyCode} onChange={(e) => setFormData((p) => ({ ...p, studyCode: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.auth.phone}</label>
                  <input value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.auth.password} *</label>
                  <input type="password" required minLength={6} value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{lang === 'id' ? 'Apoteker PJ' : 'Assigned Pharmacist'}</label>
                  <select value={formData.pharmacistId} onChange={(e) => setFormData((p) => ({ ...p, pharmacistId: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    <option value="">{user.name}</option>
                    {staffList.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.staff.diagnosis}</label>
                <input value={formData.diagnosis} onChange={(e) => setFormData((p) => ({ ...p, diagnosis: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              </div>
              <label className="flex items-start gap-2 rounded-xl bg-teal-50/70 p-3 text-xs text-slate-700">
                <input type="checkbox" checked={formData.consentAccepted} onChange={(e) => setFormData((p) => ({ ...p, consentAccepted: e.target.checked }))} className="mt-0.5" />
                <span>{t.auth.consentText}</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600">{t.common.cancel}</button>
                <button type="submit" disabled={formLoading} className="px-5 py-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50">
                  {formLoading ? t.common.saving : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reply to Service Request Modal */}
      {replyTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleUpdateServiceRequest} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-teal-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {lang === 'id' ? 'Tindak Lanjut Layanan' : 'Update Service Request'}
              </h3>
              <button type="button" onClick={() => setReplyTarget(null)} className="p-1.5 rounded-xl hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.common.status}</label>
              <select value={replyForm.status} onChange={(e) => setReplyForm((p) => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'id' ? 'Balasan / Instruksi Apoteker' : 'Pharmacist Reply'}
              </label>
              <textarea rows={3} value={replyForm.pharmacistReply} onChange={(e) => setReplyForm((p) => ({ ...p, pharmacistReply: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={replyForm.notifyWhatsApp} onChange={(e) => setReplyForm((p) => ({ ...p, notifyWhatsApp: e.target.checked }))} />
              <span>{lang === 'id' ? 'Kirim notifikasi ke WhatsApp pasien' : 'Notify patient via WhatsApp'}</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReplyTarget(null)} className="px-4 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600">{t.common.cancel}</button>
              <button type="submit" className="px-5 py-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">{t.common.save}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
