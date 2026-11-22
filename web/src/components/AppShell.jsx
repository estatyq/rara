import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Pill, MessageSquare, Home, BookOpen, ClipboardList, Users, LogOut,
  Globe, FileSpreadsheet, User, Bell, Activity, Stethoscope, ShieldCheck,
  LayoutDashboard, Menu, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import DoseMateLogo from './DoseMateLogo';
import MedicationAlarmModal from './MedicationAlarmModal';

function LanguageSwitch({ compact = false }) {
  const { lang, setLang } = useLanguage();
  return (
    <div
      className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold shrink-0"
      role="group"
      aria-label="Language switcher"
    >
      {!compact && <Globe className="w-3.5 h-3.5 text-slate-400 mx-1.5" />}
      <button
        type="button"
        onClick={() => setLang('id')}
        className={`px-2 py-1 rounded-lg transition ${
          lang === 'id' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        ID
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-2 py-1 rounded-lg transition ${
          lang === 'en' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        EN
      </button>
    </div>
  );
}

export default function AppShell({ children }) {
  const { user, isStaff, isAdmin, logout } = useAuth();
  const { lang, t } = useLanguage();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return children;

  const isActive = (path) => {
    const [pathname, search] = path.split('?');
    if (search) {
      return location.pathname === pathname && location.search === `?${search}`;
    }
    if (pathname === '/' || pathname === '/staff' || pathname === '/admin') {
      return location.pathname === pathname && !location.search;
    }
    return location.pathname.startsWith(pathname);
  };

  // ---- STAFF & ADMIN: Dark-Teal Sidebar Web Dashboard (DoseLynx Mockup) ----
  if (isStaff) {
    const staffNav = [
      { to: '/staff', label: t.nav.dashboard, icon: LayoutDashboard },
      { to: '/staff?view=patients', label: t.nav.patients, icon: Users },
      { to: '/staff?view=monitoring', label: t.nav.monitoring, icon: Activity },
      { to: '/staff/inbox', label: t.nav.inbox, icon: MessageSquare },
      { to: '/staff/education', label: t.nav.articles, icon: BookOpen },
      { to: '/staff/questionnaires', label: t.nav.questionnaires, icon: ClipboardList },
      { to: '/staff/export', label: t.nav.researchExport, icon: FileSpreadsheet },
      ...(isAdmin ? [{ to: '/admin', label: t.nav.adminPortal, icon: ShieldCheck }] : []),
    ];

    const initials = (user.name || 'F')
      .split(' ')
      .filter((w) => !w.includes('.'))
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

    const sidebarContent = (
      <div className="flex flex-col h-full bg-gradient-to-b from-[#0F766E] to-[#115E59] text-white">
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <Link to={isAdmin ? '/admin' : '/staff'} onClick={() => setSidebarOpen(false)}>
            <DoseMateLogo inverted size="md" showSubtitle subtitle={t.brandSubtitle} />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-teal-100 hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {staffNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  active
                    ? 'bg-white text-teal-900 shadow-sm'
                    : 'text-teal-50/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-teal-200'}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-teal-100 hover:bg-white/10 hover:text-white transition"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>{t.nav.logout}</span>
          </button>
        </div>
      </div>
    );

    return (
      <div className="min-h-screen flex bg-[#F4FAF9]">
        <MedicationAlarmModal />

        {/* Desktop Fixed Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30 shadow-lg print:hidden">
          {sidebarContent}
        </aside>

        {/* Mobile Slide-Over Sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="w-64 max-w-[80vw] h-full shadow-2xl">{sidebarContent}</div>
            <div className="flex-1 bg-slate-900/40 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 print:hidden">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="lg:hidden">
                <DoseMateLogo size="sm" />
              </div>
              <div className="hidden lg:block min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
                  {isAdmin ? 'DoseLynx Admin' : (lang === 'id' ? 'Dashboard Web Farmasis' : 'Pharmacist Web Dashboard')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <LanguageSwitch />
              <Link
                to="/staff/inbox"
                className="p-2 rounded-xl text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition"
                title={t.nav.inbox}
              >
                <Bell className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-800 font-extrabold text-xs flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-bold text-slate-900 max-w-[190px] truncate">{user.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {user.role === 'ADMIN' ? 'Administrator' : (lang === 'id' ? 'Farmasis' : 'Pharmacist')}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    );
  }

  // ---- PATIENT PORTAL: Clean Airy Top Bar + 4-Tab Mobile Bottom Nav ----
  const patientLinks = [
    { to: '/', label: t.nav.today, icon: Home },
    { to: '/medications', label: t.nav.medications, icon: Pill },
    { to: '/blood-pressure', label: t.nav.health, icon: Activity },
    { to: '/services', label: t.nav.services, icon: Stethoscope },
    { to: '/chat', label: t.nav.chat, icon: MessageSquare },
    { to: '/education', label: t.nav.education, icon: BookOpen },
    { to: '/profile', label: t.nav.profile, icon: User },
  ];

  // Exact 4-tab bottom nav matching the DoseLynx mobile mockup
  const mobileBottomLinks = [
    { to: '/', label: t.nav.today, icon: Home },
    { to: '/medications', label: lang === 'id' ? 'Riwayat' : 'Meds', icon: Pill },
    { to: '/education', label: t.nav.education, icon: BookOpen },
    { to: '/profile', label: t.nav.profile, icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F4FAF9]">
      <MedicationAlarmModal />

      <header className="bg-white/95 backdrop-blur-md border-b border-teal-100/80 sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="shrink-0">
            <DoseMateLogo size="sm" showSubtitle subtitle={t.brandSubtitle} />
          </Link>

          <nav className="hidden lg:flex items-center gap-1 min-w-0">
            {patientLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    active
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitch compact />
            <div className="hidden sm:flex flex-col text-right leading-tight pl-1">
              <span className="text-xs font-bold text-slate-900 max-w-[140px] truncate">{user.name}</span>
              <span className="text-[10px] text-slate-500">{user.phone || user.email}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
              title={t.nav.logout}
              aria-label={t.nav.logout}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 lg:pb-8">{children}</main>

      {/* Mobile 4-tab bottom navigation matching DoseLynx mockup */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-teal-100 z-30 px-2 py-1.5 flex justify-around shadow-[0_-4px_20px_rgba(15,118,110,0.06)] print:hidden">
        {mobileBottomLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-semibold transition ${
                active ? 'text-teal-700 bg-teal-50/70' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.4]' : ''}`} />
              <span className="mt-0.5">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
