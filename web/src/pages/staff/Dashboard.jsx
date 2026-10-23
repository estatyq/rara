import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, UserPlus, MessageSquare, ArrowRight, Activity, AlertCircle, FileSpreadsheet, Check } from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function StaffDashboard() {
  const { t } = useLanguage();
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New patient form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    studyCode: '',
    diagnosis: '',
    allergies: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const loadPatients = async () => {
    try {
      const res = await api.getPatients({ q: searchQuery });
      setPatients(res.patients || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, [searchQuery]);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.password || (!formData.phone && !formData.email)) {
      setFormError('Lengkapi nama, password, dan kontak (HP atau Email)');
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      await api.createPatient(formData);
      setShowAddModal(false);
      setFormData({
        name: '', phone: '', email: '', password: '', studyCode: '', diagnosis: '', allergies: '',
      });
      await loadPatients();
    } catch (err) {
      setFormError(err.message || 'Gagal mendaftarkan pasien');
    } finally {
      setFormLoading(false);
    }
  };

  // Calculate summary metrics
  const totalPatients = patients.length;
  const ratesWithVal = patients.filter((p) => p.adherence30 !== null && p.adherence30 !== undefined);
  const avgAdherence = ratesWithVal.length
    ? Math.round(ratesWithVal.reduce((acc, p) => acc + p.adherence30, 0) / ratesWithVal.length)
    : null;
  const totalUnread = patients.reduce((acc, p) => acc + (p.unread || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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

        <div className="flex items-center space-x-3">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Total Partisipan
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
              Rata-rata Kepatuhan (30 Hari)
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
              Pesan Konsultasi Baru
            </span>
            <span className="text-2xl font-extrabold text-amber-600 leading-none mt-1">
              {totalUnread}
            </span>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.staff.searchPatient}
          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
        />
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
            <p className="text-sm font-medium">Belum ada pasien terdaftar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">{t.staff.studyCode}</th>
                  <th className="px-6 py-4">{t.staff.name}</th>
                  <th className="px-6 py-4">{t.staff.diagnosis}</th>
                  <th className="px-6 py-4">{t.staff.activeMeds}</th>
                  <th className="px-6 py-4">{t.staff.adherence7d}</th>
                  <th className="px-6 py-4">{t.staff.adherence30d}</th>
                  <th className="px-6 py-4 text-right">{t.common.actions}</th>
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
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                          {p.studyCode || 'P-???'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          {p.user.name}
                          {p.unread > 0 && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Pesan baru" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{p.user.phone || p.user.email}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 text-xs max-w-xs truncate">
                        {p.diagnosis || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-700">{p.activeMedications || 0}</span>
                      </td>
                      <td className="px-6 py-4">{adhBadge(adh7)}</td>
                      <td className="px-6 py-4">{adhBadge(adh30)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/staff/patients/${p.id}`}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 rounded-lg text-xs font-semibold text-slate-700 transition"
                        >
                          <span>Kelola</span>
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

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
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
                  placeholder="Budi Santoso"
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
                <label className="text-xs font-semibold text-slate-700 uppercase">Diagnosis / Kondisi Medis</label>
                <input
                  type="text"
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  placeholder="Hipertensi stage 1, DM Tipe 2"
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

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
