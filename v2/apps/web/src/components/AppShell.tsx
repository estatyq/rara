import {
  Activity, Bell, BookOpen, FileSpreadsheet, Globe, Home, LayoutDashboard,
  LogOut, Menu, MessageSquare, Pill, ShieldCheck, User, Users, WifiOff, X
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DoseMateLogo from './DoseMateLogo';
import MedicationAlarmModal from './MedicationAlarmModal';

function LangToggle() {
  const { i18n } = useTranslation();
  const { switchLocale } = useAuth();
  const lang = i18n.language === 'en' ? 'en' : 'id';
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold shrink-0">
      <Globe className="w-3.5 h-3.5 text-slate-400 mx-1.5" />
      <button
        type="button"
        onClick={() => switchLocale('id')}
        className={`px-2 py-1 rounded-lg transition ${lang === 'id' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}
      >
        ID
      </button>
      <button
        type="button"
        onClick={() => switchLocale('en')}
        className={`px-2 py-1 rounded-lg transition ${lang === 'en' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}
      >
        EN
      </button>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation(['nav', 'common']);
  const { user, isStaff, isOffline, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!user) return <>{children}</>;

  const isActive = (path: string) => {
    const [p, s] = path.split('?');
    if (s) return location.pathname === p && location.search === `?${s}`;
    return location.pathname === p && !location.search;
  };

  if (isStaff) {
    const staffNav = [
      { to: '/staff', label: t('nav:dashboard'), icon: LayoutDashboard },
      { to: '/staff?view=patients', label: t('nav:patients'), icon: Users },
      { to: '/staff?view=monitoring', label: t('nav:monitoring'), icon: Activity },
      { to: '/staff?view=reports', label: t('nav:reports'), icon: FileSpreadsheet },
    ];

    const initials = user.name
      .split(' ')
      .filter((w) => !w.includes('.'))
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

    const sidebar = (
      <div className="flex flex-col h-full bg-gradient-to-b from-[#0F766E] to-[#115E59] text-white">
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <Link to="/staff" onClick={() => setDrawerOpen(false)}>
            <DoseMateLogo inverted size="md" showSubtitle />
          </Link>
          <button type="button" onClick={() => setDrawerOpen(false)} className="lg:hidden p-1.5 rounded-lg text-teal-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {staffNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  active ? 'bg-white text-teal-900 shadow-sm' : 'text-teal-50/90 hover:bg-white/10'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-teal-200'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-teal-100 hover:bg-white/10 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('nav:logout')}</span>
          </button>
        </div>
      </div>
    );

    return (
      <div className="min-h-screen flex bg-[#F4FAF9]">
        <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30 shadow-lg">{sidebar}</aside>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="w-64 h-full shadow-2xl">{sidebar}</div>
            <div className="flex-1 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          </div>
        )}
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setDrawerOpen(true)} className="lg:hidden p-2 rounded-xl text-slate-600">
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-100">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>{user.tenants?.[0]?.name || 'DoseMate Pharmacy Cloud'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LangToggle />
              <Bell className="w-5 h-5 text-slate-400" />
              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-800 font-extrabold text-xs flex items-center justify-center">
                  {initials}
                </div>
                <div className="hidden sm:block leading-tight">
                  <div className="text-xs font-bold text-slate-900">{user.name}</div>
                  <div className="text-[11px] text-slate-500">{user.globalRole}</div>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    );
  }

  // Patient Shell matching DoseMate Mobile Mockup
  const patientLinks = [
    { to: '/', label: t('nav:home'), icon: Home },
    { to: '/health', label: t('nav:health'), icon: Activity },
    { to: '/education', label: t('nav:education'), icon: BookOpen },
    { to: '/chat', label: t('nav:chat'), icon: MessageSquare },
    { to: '/profile', label: t('nav:profile'), icon: User },
  ];

  const bottomLinks = [
    { to: '/', label: t('nav:home'), icon: Home },
    { to: '/health', label: t('nav:health'), icon: Pill },
    { to: '/education', label: t('nav:education'), icon: BookOpen },
    { to: '/profile', label: t('nav:profile'), icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F4FAF9]">
      <MedicationAlarmModal />

      {isOffline && (
        <div className="bg-amber-500 text-white text-xs font-bold px-4 py-2 text-center flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>{t('common:offlineBanner')}</span>
        </div>
      )}

      <header className="bg-white/95 backdrop-blur-md border-b border-teal-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/">
            <DoseMateLogo size="sm" showSubtitle />
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {patientLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    active ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button
              type="button"
              onClick={() => void logout()}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
              title={t('nav:logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 lg:pb-8">{children}</main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-teal-100 z-30 px-2 py-1.5 flex justify-around shadow-[0_-4px_20px_rgba(15,118,110,0.06)]">
        {bottomLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-semibold transition ${
                active ? 'text-teal-700 bg-teal-50/70' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="mt-0.5">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
