import { useState, useEffect } from 'react';
import { User, Bell, Shield, Phone, Mail, MapPin, Stethoscope, AlertTriangle, Check, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';

export default function PatientProfile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPatient('me')
      .then((res) => setProfile(res.patient))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    // Check push support
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushSubscribed(!!sub);
        });
      });
    }
  }, []);

  const handleTogglePush = async () => {
    if (!pushSupported) return;
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        // Unsubscribe
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await api.subscribePush({ endpoint: sub.endpoint, keys: { p256dh: '', auth: '' } }).catch(() => {});
        }
        setPushSubscribed(false);
      } else {
        // Subscribe
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
      alert('Notifikasi uji coba berhasil dikirim!');
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
      {/* User Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex items-center space-x-4">
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
            Terdaftar di Sistem Pemantauan Kepatuhan Obat
          </p>
        </div>
      </div>

      {/* Clinical Profile Details */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-teal-600" />
          Informasi Klinis & Terapi
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">
              Diagnosis / Kondisi
            </span>
            <span className="font-semibold text-slate-800">
              {profile?.diagnosis || 'Belum diisi'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Riwayat Alergi Obat
            </span>
            <span className="font-semibold text-slate-800">
              {profile?.allergies || 'Tidak ada riwayat alergi'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">
              Apoteker Penanggung Jawab
            </span>
            <span className="font-semibold text-teal-700">
              {profile?.pharmacist?.name || 'apt. Rara Ganie'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">
              Zona Waktu
            </span>
            <span className="font-semibold text-slate-800">
              {user.timezone || 'Asia/Jakarta (WIB)'}
            </span>
          </div>
        </div>
      </div>

      {/* Push Notification Manager */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Pengingat Jadwal Minum Obat (Push Notification)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Dapatkan notifikasi langsung di layar HP/browser saat tiba waktu minum obat.
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
