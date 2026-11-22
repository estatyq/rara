import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Users, Award, Stethoscope, Database, Activity, CheckCircle2,
  XCircle, Clock, Plus, Search, UserPlus, Save, Phone, Edit3, Trash2, KeyRound
} from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function AdminPortal() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const dateLocale = isEn ? 'en-US' : 'id-ID';
  const [activeTab, setActiveTab] = useState('reports'); // reports | users | verification | services | system
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [systemData, setSystemData] = useState(null);
  const [loading, setLoading] = useState(true);

  // User filter state
  const [userQuery, setUserQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Create User Modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'PHARMACIST',
    straNumber: '',
    sipaNumber: '',
    workplace: '',
    specialization: isEn ? 'Clinical Pharmacy' : 'Farmasi Klinis',
    yearsExperience: 3,
    studyCode: '',
    diagnosis: '',
  });

  // Verify Pharmacist Modal
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyForm, setVerifyForm] = useState({
    straNumber: '',
    sipaNumber: '',
    workplace: '',
    specialization: '',
    yearsExperience: 3,
    verificationStatus: 'VERIFIED',
    verificationNote: '',
  });

  // Service Modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    code: '',
    category: 'TELEPHARMACY',
    nameId: '',
    nameEn: '',
    descriptionId: '',
    descriptionEn: '',
    durationMinutes: 30,
    priceIDR: 0,
    icon: 'Stethoscope',
    active: true,
  });

  // System & WhatsApp Config state
  const [waConfig, setWaConfig] = useState({
    whatsapp_enabled: 'true',
    whatsapp_provider: 'SIMULATOR',
    whatsapp_api_url: 'https://api.fonnte.com/send',
    whatsapp_api_token: '',
    whatsapp_sender_number: '+6281299887766',
    whatsapp_auto_dose_reminder: 'true',
    whatsapp_auto_bp_alert: 'true',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [testWaForm, setTestWaForm] = useState({ phone: '+6281234567890', message: isEn ? 'DoseLynx WhatsApp integration test message.' : 'Pesan uji coba integrasi WhatsApp DoseLynx.' });
  const [sendingTestWa, setSendingTestWa] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [ovRes, usrRes, svcRes, sysRes] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminUsers({ q: userQuery, role: roleFilter }),
        api.getServices(true),
        api.getAdminSystem(),
      ]);
      setOverview(ovRes);
      setUsers(usrRes.users || []);
      setServices(svcRes.services || []);
      setSystemData(sysRes);
      if (sysRes?.config) {
        setWaConfig((prev) => ({ ...prev, ...sysRes.config }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userQuery, roleFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.createAdminUser(newUserForm);
      setShowCreateUser(false);
      setNewUserForm({
        name: '', email: '', phone: '', password: '', role: 'PHARMACIST',
        straNumber: '', sipaNumber: '', workplace: '', specialization: isEn ? 'Clinical Pharmacy' : 'Farmasi Klinis',
        yearsExperience: 3, studyCode: '', diagnosis: '',
      });
      await loadAll();
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to create user account' : 'Gagal membuat akun pengguna'));
    }
  };

  const handleToggleUserActive = async (u) => {
    try {
      await api.updateAdminUser(u.id, { active: !u.active });
      await loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleChangeUserRole = async (u, nextRole) => {
    try {
      await api.updateAdminUser(u.id, { role: nextRole });
      await loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetUserPassword = async (u) => {
    const newPass = window.prompt(
      lang === 'id' ? `Masukkan kata sandi baru untuk ${u.name}:` : `Enter new password for ${u.name}:`,
      '',
    );
    if (!newPass || newPass.length < 6) return;
    try {
      await api.updateAdminUser(u.id, { password: newPass });
      alert(lang === 'id' ? 'Kata sandi berhasil diperbarui!' : 'Password updated!');
    } catch (err) {
      alert(err.message);
    }
  };

  const openVerifyModal = (u) => {
    const p = u.pharmacistProfile || {};
    setVerifyTarget(u);
    setVerifyForm({
      straNumber: p.straNumber || '',
      sipaNumber: p.sipaNumber || '',
      workplace: p.workplace || '',
      specialization: p.specialization || (isEn ? 'Clinical Pharmacy' : 'Farmasi Klinis'),
      yearsExperience: p.yearsExperience ?? 3,
      verificationStatus: p.verificationStatus || 'VERIFIED',
      verificationNote: p.verificationNote || '',
    });
  };

  const handleSaveVerification = async (e) => {
    e.preventDefault();
    if (!verifyTarget) return;
    try {
      await api.verifyPharmacist(verifyTarget.id, verifyForm);
      setVerifyTarget(null);
      await loadAll();
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to verify pharmacist' : 'Gagal memverifikasi apoteker'));
    }
  };

  const openServiceModal = (svc = null) => {
    setEditingService(svc);
    if (svc) {
      setServiceForm({
        code: svc.code,
        category: svc.category,
        nameId: svc.nameId,
        nameEn: svc.nameEn,
        descriptionId: svc.descriptionId,
        descriptionEn: svc.descriptionEn,
        durationMinutes: svc.durationMinutes,
        priceIDR: svc.priceIDR,
        icon: svc.icon || 'Stethoscope',
        active: svc.active,
      });
    } else {
      setServiceForm({
        code: `SVC-${Math.floor(100 + Math.random() * 900)}`,
        category: 'TELEPHARMACY',
        nameId: '',
        nameEn: '',
        descriptionId: '',
        descriptionEn: '',
        durationMinutes: 30,
        priceIDR: 0,
        icon: 'Stethoscope',
        active: true,
      });
    }
    setShowServiceModal(true);
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await api.updateService(editingService.id, serviceForm);
      } else {
        await api.createService(serviceForm);
      }
      setShowServiceModal(false);
      await loadAll();
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to save service' : 'Gagal menyimpan layanan'));
    }
  };

  const handleDeleteService = async (svc) => {
    const confirmLabel = isEn
      ? `Delete service ${svc.nameEn || svc.nameId}?`
      : `Hapus layanan ${svc.nameId}?`;
    if (!window.confirm(confirmLabel)) return;
    try {
      await api.deleteService(svc.id);
      await loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveSystemConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.updateSystemConfig(waConfig);
      await loadAll();
      alert(lang === 'id' ? 'Konfigurasi sistem & WhatsApp berhasil disimpan!' : 'System & WhatsApp settings saved!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSendTestWhatsApp = async (e) => {
    e.preventDefault();
    setSendingTestWa(true);
    try {
      await api.sendAdminWhatsApp(testWaForm);
      await loadAll();
      alert(lang === 'id' ? 'Pesan WhatsApp terkirim dan tercatat di log!' : 'WhatsApp message sent and logged!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingTestWa(false);
    }
  };

  const pharmacists = users.filter((u) => u.role === 'PHARMACIST');

  const tabs = [
    { id: 'reports', label: lang === 'id' ? 'Laporan Operasional' : 'Operational Reports', icon: Activity },
    { id: 'users', label: lang === 'id' ? 'Akun & Hak Akses' : 'Accounts & Roles', icon: Users },
    { id: 'verification', label: lang === 'id' ? 'Verifikasi Apoteker' : 'Verify Pharmacists', icon: Award },
    { id: 'services', label: lang === 'id' ? 'Kelola Layanan' : 'Manage Services', icon: Stethoscope },
    { id: 'system', label: lang === 'id' ? 'Sistem, DB & WhatsApp' : 'System, DB & WhatsApp', icon: Database },
  ];

  if (loading && !overview) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
        {lang === 'id' ? 'Memuat Panel Administrator...' : 'Loading Administrator Portal...'}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
            {lang === 'id' ? 'Pusat Kendali Administrator' : 'System Administrator Control Center'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
            {lang === 'id'
              ? 'Manajemen Platform Layanan Farmasi Digital'
              : 'Digital Pharmacy Services Platform Administration'}
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            {lang === 'id'
              ? 'Kelola akun pasien & apoteker, verifikasi kredensial STRA/SIPA, layanan kefarmasian, integrasi WhatsApp, database, dan laporan operasional.'
              : 'Manage patient & pharmacist accounts, verify STRA/SIPA credentials, pharmacy services, WhatsApp integration, database, and operational analytics.'}
          </p>
        </div>

        <button
          onClick={() => setShowCreateUser(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-sm transition self-start sm:self-center shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>{lang === 'id' ? 'Buat Akun Baru' : 'Create User Account'}</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Operational Reports */}
      {activeTab === 'reports' && overview && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">
                {isEn ? 'Total Active Users' : 'Total Pengguna Aktif'}
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {(overview.users.PATIENT || 0) + (overview.users.PHARMACIST || 0) + (overview.users.ADMIN || 0)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isEn
                  ? `${overview.users.PATIENT} Patients • ${overview.users.PHARMACIST} Pharmacists • ${overview.users.ADMIN} Admins`
                  : `${overview.users.PATIENT} Pasien • ${overview.users.PHARMACIST} Apoteker • ${overview.users.ADMIN} Admin`}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">
                {isEn ? 'Therapy Adherence (30 Days)' : 'Kepatuhan Terapi (30 Hari)'}
              </span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                {overview.doses30d.adherenceRate !== null ? `${overview.doses30d.adherenceRate}%` : '—'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isEn
                  ? `${overview.doses30d.TAKEN} Taken • ${overview.doses30d.SKIPPED} Skipped • ${overview.doses30d.MISSED} Missed`
                  : `${overview.doses30d.TAKEN} Diminum • ${overview.doses30d.SKIPPED} Lewat • ${overview.doses30d.MISSED} Lupa`}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">
                {isEn ? 'Blood Pressure Control' : 'Kontrol Tekanan Darah'}
              </span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">
                {overview.bloodPressure30d.controlRate !== null ? `${overview.bloodPressure30d.controlRate}%` : '—'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isEn
                  ? `${overview.bloodPressure30d.controlledCount} of ${overview.bloodPressure30d.totalReadings} readings <140/90`
                  : `${overview.bloodPressure30d.controlledCount} dari ${overview.bloodPressure30d.totalReadings} pengukuran <140/90`}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">
                {isEn ? 'PTO Care & WhatsApp' : 'Layanan PTO & WhatsApp'}
              </span>
              <div className="text-2xl font-extrabold text-teal-600 mt-1">
                {overview.followUps.total} PTO / {overview.whatsappTotalSent} WA
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {overview.serviceRequests.total} {isEn ? 'Pharmacy Service Requests' : 'Permintaan Layanan Farmasi'}
              </p>
            </div>
          </div>

          {/* Pharmacist Workload & Verification Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {isEn
                  ? 'Pharmacist Performance & Operational Workload'
                  : 'Laporan Kinerja & Beban Kerja Apoteker'}
              </h3>
              <span className="text-xs text-slate-500">
                {isEn ? 'Verified:' : 'Terverifikasi:'} <strong>{overview.verification.VERIFIED}</strong> •{' '}
                {isEn ? 'Pending:' : 'Menunggu:'} <strong>{overview.verification.PENDING}</strong>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3">{isEn ? 'Pharmacist Name' : 'Nama Apoteker'}</th>
                    <th className="px-6 py-3">{isEn ? 'STRA & SIPA No.' : 'No. STRA & SIPA'}</th>
                    <th className="px-6 py-3">{isEn ? 'Verification Status' : 'Status Verifikasi'}</th>
                    <th className="px-6 py-3">{isEn ? 'Assigned Patients' : 'Pasien Ditangani'}</th>
                    <th className="px-6 py-3">{isEn ? 'PTO Reports' : 'Laporan PTO'}</th>
                    <th className="px-6 py-3">{isEn ? 'Pharmacy Services' : 'Layanan Farmasi'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.pharmacistWorkload.map((pw) => (
                    <tr key={pw.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-slate-900">{pw.name}</div>
                        <div className="text-slate-500">{pw.email || pw.phone}</div>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-[11px] text-slate-700">
                        <div>STRA: {pw.profile?.straNumber || '—'}</div>
                        <div>SIPA: {pw.profile?.sipaNumber || '—'}</div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold border text-[10px] ${
                          pw.profile?.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : pw.profile?.verificationStatus === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {pw.profile?.verificationStatus || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-bold text-slate-800">{pw.assignedPatients}</td>
                      <td className="px-6 py-3.5 font-bold text-teal-700">{pw.followUpsCount}</td>
                      <td className="px-6 py-3.5 font-bold text-indigo-700">{pw.serviceRequestsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: User Accounts & Access Rights */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs self-start">
              {[
                { val: '', label: lang === 'id' ? 'Semua Peran' : 'All Roles' },
                { val: 'PATIENT', label: lang === 'id' ? 'Pasien' : 'Patients' },
                { val: 'PHARMACIST', label: lang === 'id' ? 'Apoteker' : 'Pharmacists' },
                { val: 'ADMIN', label: 'Administrator' },
              ].map((r) => (
                <button
                  key={r.val}
                  onClick={() => setRoleFilter(r.val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    roleFilter === r.val ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder={lang === 'id' ? 'Cari nama, email, atau nomor HP...' : 'Search name, email, or phone...'}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-3.5">{isEn ? 'Name & Contact' : 'Nama & Kontak'}</th>
                    <th className="px-5 py-3.5">{isEn ? 'Role' : 'Hak Akses (Role)'}</th>
                    <th className="px-5 py-3.5">{isEn ? 'Clinical / License Details' : 'Detail Klinis / Lisensi'}</th>
                    <th className="px-5 py-3.5">{isEn ? 'Account Status' : 'Status Akun'}</th>
                    <th className="px-5 py-3.5 text-right">{isEn ? 'Access Controls' : 'Pengaturan Akses'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">{u.name}</div>
                        <div className="text-slate-500">{u.email || '—'} • {u.phone || '—'}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={u.role}
                          onChange={(e) => handleChangeUserRole(u, e.target.value)}
                          className="bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 font-bold text-slate-800"
                        >
                          <option value="PATIENT">PATIENT</option>
                          <option value="PHARMACIST">PHARMACIST</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {u.role === 'PATIENT' && (
                          <span>
                            {isEn ? 'Code:' : 'Kode:'} <strong>{u.patient?.studyCode || '—'}</strong> •{' '}
                            {u.patient?.diagnosis || (isEn ? 'Patient' : 'Pasien')}
                          </span>
                        )}
                        {u.role === 'PHARMACIST' && (
                          <span>
                            STRA: <strong>{u.pharmacistProfile?.straNumber || (isEn ? 'Not set' : 'Belum diisi')}</strong> (
                            {u.pharmacistProfile?.verificationStatus || 'PENDING'})
                          </span>
                        )}
                        {u.role === 'ADMIN' && (
                          <span>{isEn ? 'Full System Administrator' : 'Administrator Sistem Penuh'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold border text-[10px] ${
                          u.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {u.active ? (isEn ? 'ACTIVE' : 'AKTIF') : (isEn ? 'INACTIVE' : 'NONAKTIF')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleResetUserPassword(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                          title={isEn ? 'Reset Password' : 'Reset Kata Sandi'}
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>{isEn ? 'Reset Password' : 'Reset Sandi'}</span>
                        </button>
                        <button
                          onClick={() => handleToggleUserActive(u)}
                          className={`px-2.5 py-1 rounded-lg font-bold ${
                            u.active
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {u.active ? (isEn ? 'Deactivate' : 'Nonaktifkan') : (isEn ? 'Activate' : 'Aktifkan')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Pharmacist Identity & Credential Verification */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950">
            {isEn ? (
              <>
                <strong>Pharmacist Credential Verification (STRA &amp; SIPA):</strong> Verify that the Pharmacist Registration Certificate (STRA) and Practice License (SIPA) numbers match official Ministry of Health / Pharmacy Council records before granting <strong>VERIFIED</strong> status.
              </>
            ) : (
              <>
                <strong>Verifikasi Kredensial Apoteker (STRA &amp; SIPA):</strong> Pastikan nomor Surat Tanda Registrasi Apoteker (STRA) dan Surat Izin Praktik Apoteker (SIPA) sesuai dengan data Kementerian Kesehatan / Konsil Kefarmasian sebelum memberikan status <strong>VERIFIED</strong>.
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pharmacists.map((ph) => {
              const p = ph.pharmacistProfile || {};
              const status = p.verificationStatus || 'PENDING';
              return (
                <div key={ph.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{ph.name}</h3>
                        <p className="text-xs text-slate-500">{ph.email} • {ph.phone}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        status === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : status === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {status}
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                      <div>
                        <strong>{isEn ? 'STRA No.:' : 'No. STRA:'}</strong>{' '}
                        <span className="font-mono">{p.straNumber || (isEn ? 'Not provided' : 'Belum dilengkapi')}</span>
                      </div>
                      <div>
                        <strong>{isEn ? 'SIPA No.:' : 'No. SIPA:'}</strong>{' '}
                        <span className="font-mono">{p.sipaNumber || (isEn ? 'Not provided' : 'Belum dilengkapi')}</span>
                      </div>
                      <div>
                        <strong>{isEn ? 'Workplace:' : 'Tempat Praktik:'}</strong> {p.workplace || '—'}
                      </div>
                      <div>
                        <strong>{isEn ? 'Specialization:' : 'Spesialisasi:'}</strong> {p.specialization || '—'}
                      </div>
                      {p.verificationNote && (
                        <div className="text-teal-800 pt-1 border-t border-slate-200/60">
                          <strong>{isEn ? 'Verification Note:' : 'Catatan Verifikasi:'}</strong> {p.verificationNote}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => openVerifyModal(ph)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Review & Verify Credentials' : 'Periksa & Verifikasi Kredensial'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Manage Pharmacy Services Catalog */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {isEn ? 'Digital Pharmacy Services Catalog' : 'Katalog Layanan Kefarmasian Digital'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEn
                  ? 'Manage pharmacy services displayed to patients in the mobile app.'
                  : 'Kelola layanan farmasi yang ditampilkan kepada pasien di aplikasi mobile.'}
              </p>
            </div>
            <button
              onClick={() => openServiceModal(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>{isEn ? 'Add New Service' : 'Tambah Layanan Baru'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((svc) => (
              <div
                key={svc.id}
                className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between ${
                  svc.active ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {svc.code} • {svc.category}
                      </span>
                      <h3 className="font-bold text-slate-900 text-base mt-1">
                        {isEn ? (svc.nameEn || svc.nameId) : svc.nameId}
                      </h3>
                      <p className="text-xs text-teal-700 font-medium">
                        {isEn ? svc.nameId : svc.nameEn}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openServiceModal(svc)}
                        className="p-1.5 text-slate-400 hover:text-teal-700 rounded-lg"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteService(svc)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    {isEn ? (svc.descriptionEn || svc.descriptionId) : svc.descriptionId}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {isEn ? 'Duration:' : 'Durasi:'} <strong>{svc.durationMinutes} {isEn ? 'min' : 'mnt'}</strong>
                  </span>
                  <span>
                    {isEn ? 'Requests:' : 'Permintaan:'} <strong>{svc._count?.requests || 0}</strong>
                  </span>
                  <span className={`font-bold ${svc.active ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {svc.active ? (isEn ? 'Active' : 'Aktif') : (isEn ? 'Inactive' : 'Nonaktif')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: System, Database & WhatsApp Integration */}
      {activeTab === 'system' && systemData && (
        <div className="space-y-6">
          {/* Database Status & Table Counts */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {isEn
                      ? `System Status & Database Table Metrics (${systemData.database.engine})`
                      : `Status Sistem & Statistik Tabel Database (${systemData.database.engine})`}
                  </h3>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isEn ? 'Database Online & Healthy' : 'Database Online & Sehat'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {Object.entries(systemData.database.tables).map(([table, count]) => (
                <div key={table} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="block text-lg font-extrabold text-slate-900">{count}</span>
                  <span className="text-[10px] font-mono text-slate-500 truncate block">{table}</span>
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp Gateway Configuration & Live Test */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSaveSystemConfig}
              className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Phone className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {isEn ? 'WhatsApp Gateway Integration Config' : 'Konfigurasi Integrasi WhatsApp Gateway'}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    {isEn ? 'WA Integration Status' : 'Status Integrasi WA'}
                  </label>
                  <select
                    value={waConfig.whatsapp_enabled}
                    onChange={(e) => setWaConfig({ ...waConfig, whatsapp_enabled: e.target.value })}
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="true">{isEn ? 'Enabled' : 'Aktif (Enabled)'}</option>
                    <option value="false">{isEn ? 'Disabled' : 'Nonaktif (Disabled)'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    {isEn ? 'Gateway Provider' : 'Provider Gateway'}
                  </label>
                  <select
                    value={waConfig.whatsapp_provider}
                    onChange={(e) => setWaConfig({ ...waConfig, whatsapp_provider: e.target.value })}
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="SIMULATOR">SIMULATOR (Internal Log & wa.me)</option>
                    <option value="FONNTE">FONNTE WhatsApp Gateway</option>
                    <option value="WABLAS">WABLAS WhatsApp API</option>
                    <option value="CLOUD_API">Meta WhatsApp Cloud API</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  {isEn ? 'Gateway Endpoint URL' : 'Endpoint URL Gateway'}
                </label>
                <input
                  type="text"
                  value={waConfig.whatsapp_api_url}
                  onChange={(e) => setWaConfig({ ...waConfig, whatsapp_api_url: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    {isEn ? 'Sender Number' : 'Nomor Pengirim'}
                  </label>
                  <input
                    type="text"
                    value={waConfig.whatsapp_sender_number}
                    onChange={(e) => setWaConfig({ ...waConfig, whatsapp_sender_number: e.target.value })}
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    {isEn ? 'API Token (Optional in Simulator)' : 'API Token (Opsional di Simulator)'}
                  </label>
                  <input
                    type="password"
                    value={waConfig.whatsapp_api_token || ''}
                    onChange={(e) => setWaConfig({ ...waConfig, whatsapp_api_token: e.target.value })}
                    placeholder="••••••••••••"
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    {isEn ? 'Auto Dose Reminders' : 'Pengingat Dosis Otomatis'}
                  </label>
                  <select
                    value={waConfig.whatsapp_auto_dose_reminder}
                    onChange={(e) => setWaConfig({ ...waConfig, whatsapp_auto_dose_reminder: e.target.value })}
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="true">{isEn ? 'Yes, Send Automatically' : 'Ya, Kirim Otomatis'}</option>
                    <option value="false">{isEn ? 'No' : 'Tidak'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    {isEn ? 'Auto Critical BP Alerts' : 'Peringatan TD Tinggi Otomatis'}
                  </label>
                  <select
                    value={waConfig.whatsapp_auto_bp_alert}
                    onChange={(e) => setWaConfig({ ...waConfig, whatsapp_auto_bp_alert: e.target.value })}
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="true">{isEn ? 'Yes, Send Automatically' : 'Ya, Kirim Otomatis'}</option>
                    <option value="false">{isEn ? 'No' : 'Tidak'}</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                {savingConfig
                  ? (isEn ? 'Saving...' : 'Menyimpan...')
                  : (isEn ? 'Save System Settings' : 'Simpan Konfigurasi Sistem')}
              </button>
            </form>

            {/* Test WhatsApp & Recent WhatsApp Logs */}
            <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
                {isEn
                  ? `Live Test & WhatsApp Message Logs (${systemData.whatsappLogs.length})`
                  : `Uji Pengiriman & Log Pesan WhatsApp (${systemData.whatsappLogs.length})`}
              </h3>
              <form onSubmit={handleSendTestWhatsApp} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={testWaForm.phone}
                  onChange={(e) => setTestWaForm({ ...testWaForm, phone: e.target.value })}
                  placeholder="+62812..."
                  className="sm:w-40 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
                <input
                  type="text"
                  value={testWaForm.message}
                  onChange={(e) => setTestWaForm({ ...testWaForm, message: e.target.value })}
                  placeholder={isEn ? 'Test message body...' : 'Isi pesan uji coba...'}
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
                <button
                  type="submit"
                  disabled={sendingTestWa}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0"
                >
                  {isEn ? 'Send WA' : 'Kirim WA'}
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {systemData.whatsappLogs.map((w) => (
                  <div key={w.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-emerald-700">{w.phone} • {w.category} ({w.provider})</span>
                      <span>{new Date(w.createdAt).toLocaleString(dateLocale)} • {w.status}</span>
                    </div>
                    <p className="text-slate-700 mt-1">{w.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Log */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">
              {isEn ? 'Security Audit & System Activity Log' : 'Log Audit Keamanan & Aktivitas Sistem (Audit Trail)'}
            </h3>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
                  <tr>
                    <th className="px-4 py-2.5">{isEn ? 'Timestamp' : 'Waktu'}</th>
                    <th className="px-4 py-2.5">{isEn ? 'Actor' : 'Pelaku'}</th>
                    <th className="px-4 py-2.5">{isEn ? 'Action' : 'Aksi'}</th>
                    <th className="px-4 py-2.5">{isEn ? 'Entity' : 'Entitas'}</th>
                    <th className="px-4 py-2.5">{isEn ? 'Details' : 'Detail'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {systemData.auditLogs.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                        {new Date(a.createdAt).toLocaleString(dateLocale)}
                      </td>
                      <td className="px-4 py-2 font-semibold text-slate-800">
                        {a.actorName} ({a.actorRole})
                      </td>
                      <td className="px-4 py-2 font-mono font-bold text-indigo-700">{a.action}</td>
                      <td className="px-4 py-2 text-slate-600">{a.entityType}</td>
                      <td className="px-4 py-2 font-mono text-[11px] text-slate-500 max-w-md truncate">{a.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              {isEn ? 'Create New User Account' : 'Buat Akun Pengguna Baru'}
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Role *' : 'Peran (Role) *'}
                  </label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  >
                    <option value="PHARMACIST">{isEn ? 'Pharmacist (PHARMACIST)' : 'Apoteker (PHARMACIST)'}</option>
                    <option value="PATIENT">{isEn ? 'Patient (PATIENT)' : 'Pasien (PATIENT)'}</option>
                    <option value="ADMIN">Administrator (ADMIN)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Initial Password *' : 'Kata Sandi Awal *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    placeholder={isEn ? 'Minimum 6 characters' : 'Minimal 6 karakter'}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Full Name & Credentials *' : 'Nama Lengkap & Gelar *'}
                </label>
                <input
                  type="text"
                  required
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  placeholder={isEn ? 'Full Name, RPh' : 'apt. Nama Lengkap, S.Farm.'}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Email</label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    placeholder="name@doselynx.com"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'WhatsApp / Phone Number' : 'Nomor WhatsApp / HP'}
                  </label>
                  <input
                    type="tel"
                    value={newUserForm.phone}
                    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    placeholder="081234567890"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              {newUserForm.role === 'PHARMACIST' && (
                <div className="p-3.5 bg-teal-50/60 border border-teal-200 rounded-2xl space-y-2.5">
                  <span className="text-xs font-bold text-teal-900 block">
                    {isEn ? 'Pharmacist Credentials (STRA & SIPA)' : 'Kredensial Apoteker (STRA & SIPA)'}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newUserForm.straNumber}
                      onChange={(e) => setNewUserForm({ ...newUserForm, straNumber: e.target.value })}
                      placeholder={isEn ? 'STRA Number' : 'Nomor STRA'}
                      className="p-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                    <input
                      type="text"
                      value={newUserForm.sipaNumber}
                      onChange={(e) => setNewUserForm({ ...newUserForm, sipaNumber: e.target.value })}
                      placeholder={isEn ? 'SIPA Number' : 'Nomor SIPA'}
                      className="p-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={newUserForm.workplace}
                    onChange={(e) => setNewUserForm({ ...newUserForm, workplace: e.target.value })}
                    placeholder={isEn ? 'Practice Workplace (Hospital / Clinic / Pharmacy)' : 'Tempat Praktik (RS / Puskesmas / Apotek)'}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              )}

              {newUserForm.role === 'PATIENT' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newUserForm.studyCode}
                    onChange={(e) => setNewUserForm({ ...newUserForm, studyCode: e.target.value })}
                    placeholder={isEn ? 'Study Code (P-003)' : 'Kode Studi (P-003)'}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                  <input
                    type="text"
                    value={newUserForm.diagnosis}
                    onChange={(e) => setNewUserForm({ ...newUserForm, diagnosis: e.target.value })}
                    placeholder="Diagnosis"
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  {isEn ? 'Cancel' : 'Batal'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                >
                  {isEn ? 'Save Account' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Verify Pharmacist Credentials */}
      {verifyTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              {isEn ? `Verify Credentials: ${verifyTarget.name}` : `Verifikasi Kredensial: ${verifyTarget.name}`}
            </h3>
            <form onSubmit={handleSaveVerification} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'STRA Number' : 'Nomor STRA'}
                </label>
                <input
                  type="text"
                  required
                  value={verifyForm.straNumber}
                  onChange={(e) => setVerifyForm({ ...verifyForm, straNumber: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'SIPA Number' : 'Nomor SIPA'}
                </label>
                <input
                  type="text"
                  required
                  value={verifyForm.sipaNumber}
                  onChange={(e) => setVerifyForm({ ...verifyForm, sipaNumber: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Pharmacy Practice Workplace' : 'Tempat Praktik Kefarmasian'}
                </label>
                <input
                  type="text"
                  value={verifyForm.workplace}
                  onChange={(e) => setVerifyForm({ ...verifyForm, workplace: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Specialization' : 'Spesialisasi'}
                </label>
                <input
                  type="text"
                  value={verifyForm.specialization}
                  onChange={(e) => setVerifyForm({ ...verifyForm, specialization: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Verification Status' : 'Status Verifikasi'}
                </label>
                <select
                  value={verifyForm.verificationStatus}
                  onChange={(e) => setVerifyForm({ ...verifyForm, verificationStatus: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="VERIFIED">{isEn ? 'VERIFIED (Officially Verified)' : 'VERIFIED (Terverifikasi Resmi)'}</option>
                  <option value="PENDING">{isEn ? 'PENDING (Awaiting Review)' : 'PENDING (Menunggu Pemeriksaan)'}</option>
                  <option value="REJECTED">{isEn ? 'REJECTED (Rejected / Invalid)' : 'REJECTED (Ditolak / Tidak Valid)'}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Admin Verification Note' : 'Catatan Verifikasi Admin'}
                </label>
                <textarea
                  rows={2}
                  value={verifyForm.verificationNote}
                  onChange={(e) => setVerifyForm({ ...verifyForm, verificationNote: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVerifyTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  {isEn ? 'Cancel' : 'Batal'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  {isEn ? 'Save Verification Decision' : 'Simpan Keputusan Verifikasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Pharmacy Service */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              {editingService
                ? (isEn ? 'Edit Pharmacy Service' : 'Ubah Layanan Farmasi')
                : (isEn ? 'Add New Pharmacy Service' : 'Tambah Layanan Farmasi Baru')}
            </h3>
            <form onSubmit={handleSaveService} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Service Code *' : 'Kode Layanan *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceForm.code}
                    onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value })}
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Category *' : 'Kategori *'}
                  </label>
                  <select
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="PTO">{isEn ? 'PTO (Pharmacotherapy Monitoring)' : 'PTO (Pemantauan Terapi Obat)'}</option>
                    <option value="TELEPHARMACY">{isEn ? 'TELEPHARMACY' : 'TELEPHARMACY (Telefarmasi)'}</option>
                    <option value="RECONCILIATION">{isEn ? 'RECONCILIATION (Medication Reconciliation)' : 'RECONCILIATION (Rekonsiliasi Obat)'}</option>
                    <option value="COUNSELING">{isEn ? 'COUNSELING (Adherence Counseling)' : 'COUNSELING (Konseling Kepatuhan)'}</option>
                    <option value="HOME_CARE">HOME_CARE (Home Pharmacy Care)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Service Name (Indonesian) *' : 'Nama Layanan (Bahasa Indonesia) *'}
                </label>
                <input
                  type="text"
                  required
                  value={serviceForm.nameId}
                  onChange={(e) => setServiceForm({ ...serviceForm, nameId: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Service Name (English) *</label>
                <input
                  type="text"
                  required
                  value={serviceForm.nameEn}
                  onChange={(e) => setServiceForm({ ...serviceForm, nameEn: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Description (Indonesian) *' : 'Deskripsi (Bahasa Indonesia) *'}
                </label>
                <textarea
                  rows={2}
                  required
                  value={serviceForm.descriptionId}
                  onChange={(e) => setServiceForm({ ...serviceForm, descriptionId: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Description (English) *</label>
                <textarea
                  rows={2}
                  required
                  value={serviceForm.descriptionEn}
                  onChange={(e) => setServiceForm({ ...serviceForm, descriptionEn: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Duration (Minutes)' : 'Durasi (Menit)'}
                  </label>
                  <input
                    type="number"
                    value={serviceForm.durationMinutes}
                    onChange={(e) => setServiceForm({ ...serviceForm, durationMinutes: Number(e.target.value) })}
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Fee (IDR)' : 'Biaya (IDR)'}
                  </label>
                  <input
                    type="number"
                    value={serviceForm.priceIDR}
                    onChange={(e) => setServiceForm({ ...serviceForm, priceIDR: Number(e.target.value) })}
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Status</label>
                  <select
                    value={serviceForm.active ? '1' : '0'}
                    onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.value === '1' })}
                    className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="1">{isEn ? 'Active' : 'Aktif'}</option>
                    <option value="0">{isEn ? 'Inactive' : 'Nonaktif'}</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  {isEn ? 'Cancel' : 'Batal'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
                >
                  {isEn ? 'Save Service' : 'Simpan Layanan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
