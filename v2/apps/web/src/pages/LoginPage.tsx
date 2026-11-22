import { Globe, HeartPulse, ShieldCheck, UserCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import DoseMateLogo from '../components/DoseMateLogo';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

const SHOW_DEMO = import.meta.env.VITE_ENABLE_DEMO !== 'false';

export default function LoginPage() {
  const { t, i18n } = useTranslation(['auth', 'common', 'errors']);
  const { login, switchLocale } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const lang = i18n.language === 'en' ? 'en' : 'id';

  const doLogin = async (id: string, pass: string) => {
    setBusy(true);
    try {
      const user = await login(id, pass);
      navigate(['PHARMACIST', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(user.globalRole) ? '/staff' : '/');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? t(`errors:${err.code}`, { defaultValue: err.message })
          : t('errors:AUTH_INVALID_CREDENTIALS');
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    void doLogin(identifier, password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EAF7F6] via-[#F5FBFA] to-white flex items-center justify-center p-4 sm:p-6 relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <div className="inline-flex items-center rounded-xl border border-teal-100 bg-white p-0.5 shadow-xs text-xs font-bold">
          <Globe className="w-3.5 h-3.5 text-teal-600 mx-2" />
          <button type="button" onClick={() => switchLocale('id')} className={`px-2.5 py-1 rounded-lg ${lang === 'id' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}>ID</button>
          <button type="button" onClick={() => switchLocale('en')} className={`px-2.5 py-1 rounded-lg ${lang === 'en' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}>EN</button>
        </div>
      </div>

      <div className="max-w-4xl w-full bg-white rounded-[2rem] shadow-xl shadow-teal-900/5 border border-teal-100 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Splash Panel (DoseLynx Mockup Screen 1) */}
        <div className="bg-gradient-to-b from-[#EDF9F8] via-white to-[#E6F4F9] p-8 sm:p-10 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-teal-100">
          <DoseMateLogo centered size="lg" showSubtitle />
          <div className="my-6 w-52 h-52 sm:w-60 sm:h-60 rounded-3xl overflow-hidden bg-white shadow-sm border border-teal-100">
            <img src="/images/login-general-care.svg" alt="DoseLynx Medication Companion" className="w-full h-full object-cover" />
          </div>
          <p className="text-sm sm:text-base font-extrabold text-slate-800 max-w-xs">{t('common:tagline')}</p>
        </div>

        {/* Right Form Panel */}
        <div className="p-7 sm:p-10 flex flex-col justify-center">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('auth:loginTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1 mb-6">{t('auth:loginSubtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('auth:loginLabel')}</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t('auth:loginPlaceholder')}
                className="w-full px-4 py-3 bg-[#F6FBFA] border border-teal-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('auth:passwordLabel')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#F6FBFA] border border-teal-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 transition disabled:opacity-50"
            >
              {busy ? t('common:loading') : t('auth:signIn')}
            </button>
          </form>

          {SHOW_DEMO && (
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center">
                {t('auth:demoTitle')}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void doLogin('pasien@doselynx.com', 'pasien1234')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-100 transition"
              >
                <span className="flex items-center gap-2"><HeartPulse className="w-4 h-4 text-teal-600" /> Aisyah Rahmadani (Patient — ID)</span>
                <span className="text-[10px] font-mono text-teal-600">Demo</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void doLogin('apoteker@doselynx.com', 'apoteker1234')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-xl border border-sky-100 transition"
              >
                <span className="flex items-center gap-2"><UserCheck className="w-4 h-4 text-sky-600" /> Rabiatul Adawiah, Apt. (Pharmacy ID)</span>
                <span className="text-[10px] font-mono text-sky-600">Demo</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void doLogin('daniel@greencross.sg', 'apoteker1234')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
              >
                <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-slate-500" /> Dr. Daniel Tan, RPh (Pharmacy SG)</span>
                <span className="text-[10px] font-mono text-slate-500">Tenant 2</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
