import { Link, useLocation } from 'react-router-dom';
import { Pill, MessageSquare, Calendar, BookOpen, ClipboardList, Users, LogOut, Globe, FileSpreadsheet, User, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useSocket } from '../context/SocketContext';

export default function Navbar() {
  const { user, isStaff, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const { activeAlert, clearAlert } = useSocket();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  const patientLinks = [
    { to: '/', label: t.nav.today, icon: Calendar },
    { to: '/medications', label: t.nav.medications, icon: Pill },
    { to: '/chat', label: t.nav.chat, icon: MessageSquare },
    { to: '/education', label: t.nav.education, icon: BookOpen },
    { to: '/surveys', label: t.nav.surveys, icon: ClipboardList },
    { to: '/profile', label: t.nav.profile, icon: User },
  ];

  const staffLinks = [
    { to: '/staff', label: t.nav.patients, icon: Users },
    { to: '/staff/inbox', label: t.nav.inbox, icon: MessageSquare },
    { to: '/staff/education', label: t.nav.articles, icon: BookOpen },
    { to: '/staff/questionnaires', label: t.nav.questionnaires, icon: ClipboardList },
    { to: '/staff/export', label: t.nav.researchExport, icon: FileSpreadsheet },
  ];

  const links = isStaff ? staffLinks : patientLinks;

  return (
    <>
      {/* Realtime Alert Banner */}
      {activeAlert && (
        <div className="bg-amber-500 text-white px-4 py-2.5 shadow-md flex items-center justify-between sticky top-0 z-50 animate-bounce">
          <div className="flex items-center space-x-2 text-sm font-medium">
            <Bell className="w-5 h-5" />
            <span><strong>{activeAlert.title}</strong> {activeAlert.message}</span>
          </div>
          <button
            onClick={clearAlert}
            className="text-white hover:text-amber-100 text-xs px-2 py-1 bg-amber-600 rounded"
          >
            {t.common.close}
          </button>
        </div>
      )}

      {/* Main Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to={isStaff ? '/staff' : '/'} className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm">
                <Pill className="w-6 h-6 transform -rotate-45" />
              </div>
              <div>
                <span className="font-bold text-xl text-teal-950 tracking-tight flex items-center gap-1.5">
                  Apoteku
                  {isStaff && (
                    <span className="text-[10px] uppercase tracking-wider bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded-full">
                      {user.role === 'ADMIN' ? 'Admin' : 'Pharmacist'}
                    </span>
                  )}
                </span>
                <p className="text-[11px] text-slate-500 hidden sm:block leading-none">
                  {t.tagline}
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1 ml-6">
              {links.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      active
                        ? 'bg-teal-50 text-teal-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Header: Language toggle, User Name, Logout */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              title="Ganti Bahasa / Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{lang === 'id' ? '🇮🇩 ID' : '🇬🇧 EN'}</span>
            </button>

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-900 leading-tight">
                {user.name}
              </span>
              <span className="text-xs text-slate-500">
                {user.phone || user.email}
              </span>
            </div>

            <button
              onClick={logout}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title={t.nav.logout}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Bar for Mobile Patients */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-1 flex justify-around">
        {links.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium rounded-lg transition ${
                active ? 'text-teal-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className="mt-0.5 truncate max-w-[64px]">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
