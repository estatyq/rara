import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCheck, ShieldCheck, HeartPulse, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import DoseMateLogo from '../components/DoseMateLogo';

const SHOW_DEMO = import.meta.env.VITE_ENABLE_DEMO !== 'false';

export default function Login() {
  const { login } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!identifier || !password) return;
    setError('');
    setLoading(true);
    try {
      const user = await login(identifier, password);
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'PHARMACIST') navigate('/staff');
      else navigate('/');
    } catch (err) {
      if (err.status === 401) setError(t.auth.errInvalidCredentials);
      else if (err.status >= 500) setError(t.auth.errServerDown);
      else setError(err.message || t.auth.errInvalidCredentials);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (id, pass, role) => {
    setError('');
    setLoading(true);
    try {
      const u = await login(id, pass);
      navigate(u.role === 'ADMIN' ? '/admin' : role === 'staff' ? '/staff' : '/');
    } catch (err) {
      setIdentifier(id);
      setPassword(pass);
      setError(err.status === 401 ? t.auth.errInvalidCredentials : t.auth.errServerDown);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EAF7F6] via-[#F5FBFA] to-white flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 relative">
      {/* Language Switch */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <div className="inline-flex items-center rounded-xl border border-teal-100 bg-white p-0.5 shadow-xs text-xs font-bold">
          <Globe className="w-3.5 h-3.5 text-teal-600 mx-2" />
          <button
            type="button"
            onClick={() => setLang('id')}
            className={`px-2.5 py-1 rounded-lg transition ${lang === 'id' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ID
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-lg transition ${lang === 'en' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto bg-white rounded-[2rem] shadow-xl shadow-teal-900/5 border border-teal-100/80 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Splash Panel matching DoseLynx mockup */}
        <div className="bg-gradient-to-b from-[#EDF9F8] via-white to-[#E6F4F9] p-8 sm:p-10 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-teal-100/70">
          <DoseMateLogo centered size="lg" showSubtitle subtitle={t.brandSubtitle} />

          <div className="my-6 w-52 h-52 sm:w-60 sm:h-60 rounded-3xl overflow-hidden bg-white shadow-sm border border-teal-100/70 flex items-center justify-center">
            <img
              src="/images/login-general-care.svg"
              alt="DoseLynx Medication Companion"
              className="w-full h-full object-cover"
            />
          </div>

          <p className="text-sm sm:text-base font-bold text-slate-800 max-w-xs leading-snug">
            {t.tagline}
          </p>
          <p className="text-xs text-teal-700 font-medium mt-2">
            {lang === 'id'
              ? 'Pemantauan kepatuhan obat, tekanan darah & pendampingan apoteker klinis.'
              : 'Medication adherence, health monitoring & connected pharmaceutical care.'}
          </p>
        </div>

        {/* Right Login Form */}
        <div className="p-7 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {t.auth.loginTitle}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t.taglineShort}
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.auth.loginInput}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t.auth.loginInputPlaceholder}
                className="block w-full px-4 py-3 bg-[#F6FBFA] border border-teal-100 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.auth.password}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-[#F6FBFA] border border-teal-100 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-full shadow-md shadow-teal-600/20 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition disabled:opacity-50"
            >
              {loading ? t.common.loading : t.auth.loginButton}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link
              to="/register"
              className="inline-block w-full py-2.5 px-4 rounded-full border border-teal-200 text-sm font-bold text-teal-700 hover:bg-teal-50 transition"
            >
              {t.auth.registerButton}
            </Link>
          </div>

          {/* Quick Demo Accounts */}
          {SHOW_DEMO && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
                {t.auth.demoAccounts}
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleDemoLogin('pasien@doselynx.com', 'pasien123', 'patient')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50/80 hover:bg-teal-100/80 rounded-xl border border-teal-100 transition"
                >
                  <span className="flex items-center gap-2">
                    <HeartPulse className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>{t.auth.patientDemo}</span>
                  </span>
                  <span className="text-[10px] text-teal-600 font-mono">pasien123</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoLogin('apoteker@doselynx.com', 'apoteker123', 'staff')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-sky-900 bg-sky-50/80 hover:bg-sky-100/80 rounded-xl border border-sky-100 transition"
                >
                  <span className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>{t.auth.pharmacistDemo}</span>
                  </span>
                  <span className="text-[10px] text-sky-600 font-mono">apoteker123</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoLogin('admin@doselynx.com', 'admin123', 'staff')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{t.auth.adminDemo}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">admin123</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
