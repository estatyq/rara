import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import DoseMateLogo from '../components/DoseMateLogo';

export default function Register() {
  const { register } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || (!phone && !email) || !password) {
      setError(t.auth.errFillRequired);
      return;
    }
    if (!consentAccepted) {
      setError(t.auth.errConsentRequired);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
      await register({
        name,
        phone: phone || undefined,
        email: email || undefined,
        password,
        locale: lang,
        timezone: detectedTz,
        consentAccepted: true,
      });
      navigate('/');
    } catch (err) {
      setError(err.message || t.auth.errRegisterFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EAF7F6] via-[#F5FBFA] to-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <div className="inline-flex items-center rounded-xl border border-teal-100 bg-white p-0.5 shadow-xs text-xs font-bold">
          <Globe className="w-3.5 h-3.5 text-teal-600 mx-2" />
          <button
            type="button"
            onClick={() => setLang('id')}
            className={`px-2.5 py-1 rounded-lg transition ${lang === 'id' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}
          >
            ID
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-lg transition ${lang === 'en' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <DoseMateLogo centered size="md" showSubtitle subtitle={t.brandSubtitle} />
        <h2 className="mt-4 text-2xl font-extrabold text-slate-900 tracking-tight">
          {t.auth.registerTitle}
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          {t.auth.registerSubtitle}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-teal-900/5 border border-teal-100/80 rounded-3xl sm:px-8">
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.auth.fullName}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.auth.fullNamePlaceholder}
                className="block w-full px-4 py-2.5 bg-[#F6FBFA] border border-teal-100 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.auth.phone}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.auth.phonePlaceholder}
                className="block w-full px-4 py-2.5 bg-[#F6FBFA] border border-teal-100 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.auth.email}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.emailPlaceholder}
                className="block w-full px-4 py-2.5 bg-[#F6FBFA] border border-teal-100 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.auth.password}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-2.5 bg-[#F6FBFA] border border-teal-100 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>

            <label className="flex items-start gap-2.5 rounded-2xl border border-teal-100 bg-teal-50/50 p-3.5 text-xs leading-relaxed text-slate-700">
              <input
                type="checkbox"
                required
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>{t.auth.consentText}</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-full shadow-md shadow-teal-600/20 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition disabled:opacity-50"
            >
              {loading ? t.common.loading : t.auth.registerButton}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            {t.auth.hasAccount}{' '}
            <Link to="/login" className="font-bold text-teal-700 hover:text-teal-800">
              {t.auth.loginButton}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
