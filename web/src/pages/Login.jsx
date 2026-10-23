import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pill, UserCheck, ShieldCheck, HeartPulse, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function Login() {
  const { login } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();
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
      if (user.role === 'PHARMACIST' || user.role === 'ADMIN') {
        navigate('/staff');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const autofill = (id, pass) => {
    setIdentifier(id);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          onClick={toggleLanguage}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
        >
          <Globe className="w-4 h-4 text-slate-500" />
          <span>{lang === 'id' ? '🇮🇩 Bahasa Indonesia' : '🇬🇧 English'}</span>
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-md">
          <Pill className="w-8 h-8 transform -rotate-45" />
        </div>
        <h2 className="mt-4 text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.appName}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t.auth.loginSubtitle}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {t.auth.loginInput}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t.auth.loginInputPlaceholder}
                className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {t.auth.password}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition disabled:opacity-50"
            >
              {loading ? t.common.loading : t.auth.loginButton}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2.5 text-center">
              {t.auth.demoAccounts}
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => autofill('pasien@rara.local', 'pasien123')}
                className="flex items-center justify-between px-3 py-2 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition"
              >
                <span className="flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-teal-600" />
                  {t.auth.patientDemo}
                </span>
                <span className="text-[10px] text-teal-600">pasien123</span>
              </button>

              <button
                type="button"
                onClick={() => autofill('apoteker@rara.local', 'apoteker123')}
                className="flex items-center justify-between px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
              >
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {t.auth.pharmacistDemo}
                </span>
                <span className="text-[10px] text-emerald-600">apoteker123</span>
              </button>

              <button
                type="button"
                onClick={() => autofill('admin@rara.local', 'admin123')}
                className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                  {t.auth.adminDemo}
                </span>
                <span className="text-[10px] text-slate-500">admin123</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500">
            {t.auth.noAccount}{' '}
            <Link to="/register" className="font-semibold text-teal-600 hover:text-teal-700">
              {t.auth.registerButton}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
