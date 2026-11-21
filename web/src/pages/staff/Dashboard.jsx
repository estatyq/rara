import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Search, UserPlus, MessageSquare, ArrowRight, Activity,
  FileSpreadsheet, HeartPulse, Stethoscope, CheckCircle2, Phone
} from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export default function StaffDashboard() {
  const { t, lang } = useLanguage();
  const { user, isAdmin } = useAuth();
  const [patients, setPatients] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Reply to service request modal
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyForm, setReplyForm] = useState({
    status: 'CONFIRMED',
    pharmacistReply: '',
    notifyWhatsApp: true,
  });

  // New patient form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    studyCode: '',
    pharmacistId: '',
    diagnosis: '',
    allergies: '',
    estimatedDueDate: '',
    studyGroup: 'INTERVENTION',
    riskFactors: '',
    baselineSystolic: '',
    baselineDiastolic: '',
    consentAccepted: false,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const params = { q: searchQuery };
      if (mineOnly) params.mine = '1';
      const [pRes, srRes, stRes] = await Promise.all([
        api.getPatients(params),
        api.getServiceRequests(mineOnly ? { mine: '1' } : {}).catch(() => ({ requests: [] })),
        api.getStaffList().catch(() => ({ users: [] })),
      ]);
      setPatients(pRes.patients || []);
      setServiceRequests(srRes.requests || []);
      setStaffList((stRes.users || []).filter((u) => u.role === 'PHARMACIST'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, mineOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.password || (!formData.phone && !formData.email)) {
      setFormError('Lengkapi nama, password, dan kontak (HP atau Email)');
      return;
    }
    if (!formData.consentAccepted) {
      setFormError('Konfirmasi bahwa pasien telah memberikan persetujuan');
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
      setFormError(err.message || 'Gagal mendaftarkan pasien');
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
      alert(err.message || 'Gagal memperbarui permintaan layanan');
    }
  };

  // Calculate summary metrics
  const totalPatients = patients.length;
  const ratesWithVal = patients.filter((p) => p.adherence30 !== null && p.adherence30 !== undefined);
  const avgAdherence = ratesWithVal.length
    ? Math.round(ratesWithVal.reduce((acc, p) => acc + p.adherence30, 0) / ratesWithVal.length)
    : null;
  const totalUnread = patients.reduce((acc, p) => acc + (p.unread || 0), 0);
  const bpWithVal = patients.filter((p) => p.bloodPressureControlRate !== null && p.bloodPressureControlRate !== undefined);
  const avgBpControl = bpWithVal.length
    ? Math.round(bpWithVal.reduce((acc, p) => acc + p.bloodPressureControlRate, 0) / bpWithVal.length)
    : null;

  const pendingServiceRequests = serviceRequests.filter((r) => r.status === 'PENDING' || r.status === 'CONFIRMED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.staff.dashboardTitle}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t.staff.dashboardSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-800 hover:bg-indigo-100 shadow-sm transition"
            >
              <span>{lang === 'id' ? 'Panel Administrator' : 'Admin Portal'}</span>
            </Link>
          )}

          <Link
            to="/staff/export"
            className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t.staff.exportTitle}</span>
          </Link>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 rounded-xl text-xs font-bold text-white shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.staff.newPatient}</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {lang === 'id' ? 'Tekanan Terkontrol' : 'BP Controlled'}
            </span>
            <span className="text-2xl font-extrabold text-rose-600 leading-none mt-1">
              {avgBpControl !== null ? `${avgBpControl}%` : '—'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {mineOnly
                ? (lang === 'id' ? 'Pasien Saya' : 'My Patients')
                : (lang === 'id' ? 'Total Pasien' : 'Total Patients')}
            </span>
            <span className="text-2xl font-extrabold text-slate-900 leading-none mt-1">
              {totalPatients}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {lang === 'id' ? 'Rata-rata Kepatuhan (30h)' : 'Avg Adherence (30d)'}
            </span>
            <span className="text-2xl font-extrabold text-emerald-600 leading-none mt-1">
              {avgAdherence !== null ? `${avgAdherence}%` : '—'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {lang === 'id' ? 'Pesan & Layanan Aktif' : 'Unread & Active Services'}
            </span>
            <span className="text-2xl font-extrabold text-amber-600 leading-none mt-1">
              {totalUnread + pendingServiceRequests.length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar: My Assigned Patients vs All Patients + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs self-start">
          <button
            onClick={() => setMineOnly(false)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              !mineOnly ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'id' ? 'Semua Pasien' : 'All Patients'}
          </button>
          <button
            onClick={() => setMineOnly(true)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              mineOnly ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'id' ? 'Pasien Tanggung Jawab Saya' : 'My Assigned Patients'}
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.staff.searchPatient}
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
          />
        </div>
      </div>

      {/* Patient Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
            {t.common.loading}
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">
              {lang === 'id' ? 'Belum ada pasien terdaftar pada filter ini.' : 'No patients found for this filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4">{t.staff.studyCode}</th>
                  <th className="px-5 py-4">{t.staff.name}</th>
                  <th className="px-5 py-4">{lang === 'id' ? 'Apoteker PJ' : 'Pharmacist'}</th>
                  <th className="px-5 py-4">{t.staff.diagnosis}</th>
                  <th className="px-5 py-4">{t.staff.activeMeds}</th>
                  <th className="px-5 py-4">{t.staff.adherence7d}</th>
                  <th className="px-5 py-4">{t.staff.adherence30d}</th>
                  <th className="px-5 py-4">{lang === 'id' ? 'Tekanan Darah' : 'Blood Pressure'}</th>
                  <th className="px-5 py-4 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => {
                  const adh7 = p.adherence7;
                  const adh30 = p.adherence30;

                  const adhBadge = (rate) => {
                    if (rate === null || rate === undefined) return <span className="text-slate-400">—</span>;
                    const r = Math.round(rate);
                    let color = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    if (r < 60) color = 'bg-rose-50 text-rose-800 border-rose-200';
                    else if (r < 80) color = 'bg-amber-50 text-amber-800 border-amber-200';
                    return (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${color}`}>
                        {r}%
                      </span>
                    );
                  };

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                          {p.studyCode || 'P-???'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          {p.user.name}
                          {p.unread > 0 && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Pesan baru" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{p.user.phone || p.user.email}</div>
                      </td>
                      <td className="px-5 py-4 text-xs text-teal-800 font-medium">
                        {p.pharmacist?.name || '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-700 text-xs max-w-[200px] truncate">
                        {p.diagnosis || '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-700">{p.activeMedications || 0}</span>
                      </td>
                      <td className="px-5 py-4">{adhBadge(adh7)}</td>
                      <td className="px-5 py-4">{adhBadge(adh30)}</td>
                      <td className="px-5 py-4">
                        {p.latestBloodPressure ? (
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              p.latestBloodPressure.category === 'NORMAL' ? 'bg-emerald-500'
                                : p.latestBloodPressure.category === 'LOW' ? 'bg-sky-500'
                                  : p.latestBloodPressure.category === 'ELEVATED' ? 'bg-amber-500'
                                    : 'bg-rose-500'
                            }`} />
                            <span className="font-semibold text-slate-700">
                              {p.latestBloodPressure.systolic}/{p.latestBloodPressure.diastolic}
                            </span>
                            <span className="text-[10px] text-slate-400">mmHg</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/staff/patients/${p.id}`}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold transition"
                        >
                          <span>{lang === 'id' ? 'Kelola & PTO' : 'Manage & PTO'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incoming Pharmacy Service Requests Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              {lang === 'id'
                ? 'Permintaan Layanan Farmasi Pasien'
                : 'Patient Pharmacy Service Requests'}
            </h2>
          </div>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
            {serviceRequests.length} {lang === 'id' ? 'Permintaan' : 'Requests'}
          </span>
        </div>

        {serviceRequests.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            {lang === 'id' ? 'Belum ada permintaan layanan farmasi.' : 'No service requests yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {serviceRequests.slice(0, 6).map((sr) => (
              <div key={sr.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {lang === 'id' ? sr.service?.nameId : sr.service?.nameEn}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      sr.status === 'CONFIRMED' ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : sr.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {sr.status}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-teal-800">
                    {sr.patient?.user?.name} ({sr.patient?.user?.phone || sr.patient?.user?.email})
                  </p>
                  {sr.complaint && (
                    <p className="text-xs text-slate-600 mt-1">"{sr.complaint}"</p>
                  )}
                  {sr.pharmacistReply && (
                    <p className="text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded-lg mt-1">
                      <strong>Balasan:</strong> {sr.pharmacistReply}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                  <Link
                    to={`/staff/patients/${sr.patientId}?tab=followups`}
                    className="text-xs font-bold text-teal-700 hover:underline"
                  >
                    {lang === 'id' ? 'Buka Rekam Pasien →' : 'Open Patient Record →'}
                  </Link>
                  <button
                    onClick={() => {
                      setReplyTarget(sr);
                      setReplyForm({
                        status: sr.status === 'PENDING' ? 'CONFIRMED' : 'COMPLETED',
                        pharmacistReply: sr.pharmacistReply || '',
                        notifyWhatsApp: true,
                      });
                    }}
                    className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition"
                  >
                    {lang === 'id' ? 'Tindak Lanjuti' : 'Respond'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Service Request Reply Modal */}
      {replyTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              {lang === 'id' ? 'Tindak Lanjuti Permintaan Layanan' : 'Respond to Service Request'}
            </h3>
            <p className="text-xs text-slate-600">
              <strong>{replyTarget.patient?.user?.name}</strong> — {replyTarget.service?.nameId}
            </p>
            <form onSubmit={handleUpdateServiceRequest} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Status</label>
                <select
                  value={replyForm.status}
                  onChange={(e) => setReplyForm({ ...replyForm, status: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="CONFIRMED">CONFIRMED (Dikonfirmasi)</option>
                  <option value="COMPLETED">COMPLETED (Selesai Dilayani)</option>
                  <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {lang === 'id' ? 'Catatan / Instruksi Apoteker' : 'Pharmacist Response'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={replyForm.pharmacistReply}
                  onChange={(e) => setReplyForm({ ...replyForm, pharmacistReply: e.target.value })}
                  placeholder="Tuliskan jadwal konfirmasi atau arahan farmakoterapi..."
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={replyForm.notifyWhatsApp}
                  onChange={(e) => setReplyForm({ ...replyForm, notifyWhatsApp: e.target.checked })}
                  className="rounded border-slate-300 text-teal-600"
                />
                <span>{lang === 'id' ? 'Kirim notifikasi otomatis ke WhatsApp pasien' : 'Send WhatsApp notification to patient'}</span>
              </label>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-slate-900">
              {t.staff.newPatient}
            </h2>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePatient} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Nama Pasien</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Aisyah Rahmadani"
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Kode Studi</label>
                  <input
                    type="text"
                    value={formData.studyCode}
                    onChange={(e) => setFormData({ ...formData, studyCode: e.target.value })}
                    placeholder="P-002"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Password Awal</label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="pasien123"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Nomor HP (WhatsApp)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="081234567890"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Apoteker PJ</label>
                  <select
                    value={formData.pharmacistId}
                    onChange={(e) => setFormData({ ...formData, pharmacistId: e.target.value })}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="">{user.name}</option>
                    {staffList.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Diagnosis / Kondisi Medis</label>
                <input
                  type="text"
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  placeholder="Hipertensi kehamilan / Preeklampsia"
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Perkiraan Lahir (HPL)</label>
                  <input
                    type="date"
                    value={formData.estimatedDueDate}
                    onChange={(e) => setFormData({ ...formData, estimatedDueDate: e.target.value })}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Kelompok Studi</label>
                  <select
                    value={formData.studyGroup}
                    onChange={(e) => setFormData({ ...formData, studyGroup: e.target.value })}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="INTERVENTION">Intervensi</option>
                    <option value="CONTROL">Kontrol</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Faktor Risiko Preeklampsia</label>
                <textarea
                  rows="2"
                  value={formData.riskFactors}
                  onChange={(e) => setFormData({ ...formData, riskFactors: e.target.value })}
                  placeholder="Riwayat preeklampsia, hipertensi kronis, dll."
                  className="mt-1 w-full resize-none p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">TD Sistolik Awal</label>
                  <input
                    type="number"
                    min="60"
                    max="260"
                    value={formData.baselineSystolic}
                    onChange={(e) => setFormData({ ...formData, baselineSystolic: e.target.value })}
                    placeholder="120"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">TD Diastolik Awal</label>
                  <input
                    type="number"
                    min="30"
                    max="160"
                    value={formData.baselineDiastolic}
                    onChange={(e) => setFormData({ ...formData, baselineDiastolic: e.target.value })}
                    placeholder="80"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50/60 p-3 text-[11px] leading-relaxed text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.consentAccepted}
                  onChange={(e) => setFormData({ ...formData, consentAccepted: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>Pasien telah menerima informasi layanan dan menyetujui pemrosesan data klinis untuk pemantauan farmakoterapi.</span>
              </label>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {formLoading ? t.common.loading : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
