import { useState, useEffect, useCallback } from 'react';
import {
  User, Bell, Phone, Stethoscope, AlertTriangle, Check, Edit3, Save, MessageSquare
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';

export default function PatientProfile() {
  const { user, refreshUser } = useAuth();
  const { t, lang } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [waLogs, setWaLogs] = useState([]);
  const [waMeUrl, setWaMeUrl] = useState(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    diagnosis: '',
    allergies: '',
    estimatedDueDate: '',
    whatsappOptIn: true,
  });

  const loadData = useCallback(async () => {
    try {
      const [pRes, waRes] = await Promise.all([
        api.getPatient('me'),
        api.getPatientWhatsAppLogs('me').catch(() => ({ logs: [], waMeUrl: null })),
      ]);
      const p = pRes.patient;
      setProfile(p);
      setWaLogs(waRes.logs || []);
      setWaMeUrl(waRes.waMeUrl || null);
      setForm({
        name: p?.user?.name || user.name || '',
        phone: p?.user?.phone || user.phone || '',
        email: p?.user?.email || user.email || '',
        address: p?.address || '',
        diagnosis: p?.diagnosis || '',
        allergies: p?.allergies || '',
        estimatedDueDate: p?.estimatedDueDate ? new Date(p.estimatedDueDate).toISOString().slice(0, 10) : '',
        whatsappOptIn: p?.user?.whatsappOptIn ?? true,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.name, user.phone, user.email]);

  useEffect(() => {
    loadData();

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushSubscribed(!!sub);
        });
      });
    }
  }, [loadData]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateMe({
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        whatsappOptIn: form.whatsappOptIn,
      });
      await api.updatePatient('me', {
        address: form.address,
        diagnosis: form.diagnosis,
        allergies: form.allergies,
        estimatedDueDate: form.estimatedDueDate || null,
      });
      await refreshUser();
      await loadData();
      setEditing(false);
    } catch (err) {
      alert(err.message || 'Gagal memperbarui profil');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWhatsApp = async () => {
    const nextVal = !form.whatsappOptIn;
    setForm((prev) => ({ ...prev, whatsappOptIn: nextVal }));
    try {
      await api.updateMe({ whatsappOptIn: nextVal });
      await refreshUser();
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTogglePush = async () => {
    if (!pushSupported) return;
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await api.subscribePush({ endpoint: sub.endpoint, keys: { p256dh: '', auth: '' } }).catch(() => {});
        }
        setPushSubscribed(false);
      } else {
        const { publicKey } = await api.getVapidKey();
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });
        const subJson = sub.toJSON();
        await api.subscribePush({
          endpoint: sub.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          },
        });
        setPushSubscribed(true);
      }
    } catch (err) {
      alert(err.message || 'Gagal mengubah pengaturan notifikasi');
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    try {
      await api.testPush();
      alert(lang === 'id' ? 'Notifikasi uji coba berhasil dikirim!' : 'Test notification sent!');
    } catch (err) {
      alert(err.message || 'Gagal mengirim notifikasi');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  const pharmacistPhone = profile?.pharmacist?.phone || '+6281299887766';
  const pharmacistWaUrl = `https://wa.me/${pharmacistPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
    lang === 'id'
      ? `Halo Apoteker ${profile?.pharmacist?.name || 'Rabiatul Adawiah'}, saya ${user.name} (${profile?.studyCode || 'Pasien'}) ingin berkonsultasi.`
      : `Hello Pharmacist ${profile?.pharmacist?.name || 'Rabiatul Adawiah'}, I am ${user.name} and would like to consult.`,
  )}`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
      {/* User Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-sm">
            {user.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
                {user.name}
              </h1>
              {profile?.studyCode && (
                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {profile.studyCode}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {user.phone || user.email} • {user.timezone || 'Asia/Jakarta'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded-xl text-xs font-bold transition self-start sm:self-center"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{editing ? t.common.cancel : (lang === 'id' ? 'Kelola Profil' : 'Edit Profile')}</span>
        </button>
      </div>

      {/* Edit Profile Form */}
      {editing && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl p-6 border border-teal-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            {lang === 'id' ? 'Perbarui Profil & Data Klinis' : 'Update Profile & Clinical Details'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">
                {lang === 'id' ? 'Nama Lengkap' : 'Full Name'}
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">
                {lang === 'id' ? 'Nomor WhatsApp / HP' : 'WhatsApp / Phone Number'}
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+6281234567890"
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">
                {lang === 'id' ? 'Perkiraan Hari Lahir (HPL)' : 'Estimated Due Date'}
              </label>
              <input
                type="date"
                value={form.estimatedDueDate}
                onChange={(e) => setForm({ ...form, estimatedDueDate: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase">
                {lang === 'id' ? 'Alamat' : 'Address'}
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">
                {lang === 'id' ? 'Diagnosis / Kondisi' : 'Condition / Diagnosis'}
              </label>
              <input
                type="text"
                value={form.diagnosis}
                onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">
                {lang === 'id' ? 'Riwayat Alergi Obat' : 'Drug Allergies'}
              </label>
              <input
                type="text"
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? t.common.loading : t.common.save}</span>
            </button>
          </div>
        </form>
      )}

      {/* Clinical Profile Details */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-teal-600" />
          {lang === 'id' ? 'Informasi Klinis & Apoteker Penanggung Jawab' : 'Clinical Profile & Assigned Pharmacist'}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {profile?.estimatedDueDate && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
              <span className="text-xs font-semibold text-rose-600 uppercase block mb-1">
                {lang === 'id' ? 'Perkiraan Hari Lahir' : 'Estimated Due Date'}
              </span>
              <span className="font-semibold text-slate-800">
                {new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', {
                  timeZone: user.timezone,
                  dateStyle: 'long',
                }).format(new Date(profile.estimatedDueDate))}
              </span>
            </div>
          )}

          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <span className="text-xs font-semibold text-indigo-600 uppercase block mb-1">
              {lang === 'id' ? 'Kelompok Pemantauan' : 'Study Group'}
            </span>
            <span className="font-semibold text-slate-800">
              {profile?.studyGroup === 'CONTROL'
                ? (lang === 'id' ? 'Kontrol' : 'Control')
                : (lang === 'id' ? 'Intervensi Pemantauan Apoteker' : 'Pharmacist Intervention')}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">
              {lang === 'id' ? 'Diagnosis / Kondisi' : 'Diagnosis / Condition'}
            </span>
            <span className="font-semibold text-slate-800">
              {profile?.diagnosis || '—'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              {lang === 'id' ? 'Riwayat Alergi Obat' : 'Drug Allergies'}
            </span>
            <span className="font-semibold text-slate-800">
              {profile?.allergies || 'Tidak ada'}
            </span>
          </div>

          <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-teal-800 uppercase block">
                {lang === 'id' ? 'Apoteker Penanggung Jawab' : 'Responsible Clinical Pharmacist'}
              </span>
              <span className="font-extrabold text-slate-900 text-sm">
                {profile?.pharmacist?.name || 'Rabiatul Adawiah, S.Farm., Apt.'}
              </span>
              {profile?.pharmacist?.pharmacistProfile?.straNumber && (
                <span className="block text-[11px] text-slate-600 mt-0.5">
                  STRA: {profile.pharmacist.pharmacistProfile.straNumber}
                </span>
              )}
            </div>
            <a
              href={pharmacistWaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{lang === 'id' ? 'Hubungi via WhatsApp' : 'Chat on WhatsApp'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* WhatsApp Integration & Reminder Manager */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {lang === 'id'
                  ? 'Integrasi Pengingat WhatsApp Otomatis'
                  : 'Automated WhatsApp Reminder Integration'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'id'
                  ? `Kirim pengingat jadwal obat & peringatan tekanan darah ke nomor ${user.phone || 'WhatsApp Anda'}.`
                  : `Send medication schedule reminders & blood pressure alerts to ${user.phone || 'your WhatsApp'}.`}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleWhatsApp}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              form.whatsappOptIn
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {form.whatsappOptIn
              ? (lang === 'id' ? 'WhatsApp Aktif ✓' : 'WhatsApp On ✓')
              : (lang === 'id' ? 'Nonaktif' : 'Disabled')}
          </button>
        </div>

        {waLogs.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              {lang === 'id' ? 'Riwayat Pesan Pengingat WhatsApp Terakhir' : 'Recent WhatsApp Reminder Logs'}
            </span>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {waLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span className="font-bold text-emerald-700">{log.category}</span>
                    <span>{new Date(log.createdAt).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')} • {log.status}</span>
                  </div>
                  <p className="text-slate-700">{log.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Web Push Notification Manager */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {lang === 'id'
                  ? 'Pengingat Jadwal Minum Obat (Web Push Notification)'
                  : 'Browser & Mobile Push Reminders'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'id'
                  ? 'Dapatkan notifikasi langsung di layar HP/browser saat tiba waktu minum obat.'
                  : 'Receive direct push notifications on your phone/browser when a dose is due.'}
              </p>
            </div>
          </div>

          {pushSupported && (
            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                pushSubscribed
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              {pushLoading ? t.common.loading : pushSubscribed ? 'Aktif ✓' : 'Aktifkan'}
            </button>
          )}
        </div>

        {pushSubscribed && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
              <Check className="w-4 h-4 stroke-[3]" />
              {t.patient.pushEnabled}
            </span>
            <button
              onClick={handleTestPush}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              {t.patient.testPush}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
