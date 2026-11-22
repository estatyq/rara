import { Link, useLocation } from 'react-router-dom';
import {
  Pill, MessageSquare, Calendar, BookOpen, ClipboardList, Users, LogOut,
  Globe, FileSpreadsheet, User, Bell, Activity, Stethoscope, ShieldCheck, Check, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../api/client';

export default function Navbar() {
  const { user, isStaff, isAdmin, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const { activeAlert, clearAlert, snoozeAlert } = useSocket();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path) =>
    path === '/' || path === '/staff' || path === '/admin'
      ? location.pathname === path
      : location.pathname.startsWith(path);

  const patientLinks = [
    { to: '/', label: t.nav.today, short: lang === 'id' ? 'Hari Ini' : 'Today', icon: Calendar },
    { to: '/medications', label: t.nav.medications, short: lang === 'id' ? 'Obat' : 'Meds', icon: Pill },
    { to: '/services', label: t.nav.services, short: lang === 'id' ? 'Layanan' : 'Services', icon: Stethoscope },
    { to: '/blood-pressure', label: lang === 'id' ? 'Tekanan Darah' : 'BP', short: 'TD', icon: Activity },
    { to: '/chat', label: t.nav.chat, short: lang === 'id' ? 'Chat' : 'Chat', icon: MessageSquare },
    { to: '/education', label: t.nav.education, short: lang === 'id' ? 'Edukasi' : 'Learn', icon: BookOpen },
    { to: '/surveys', label: t.nav.surveys, short: lang === 'id' ? 'Survei' : 'Survey', icon: ClipboardList },
    { to: '/profile', label: t.nav.profile, short: t.nav.profile, icon: User },
  ];

  const staffLinks = [
    { to: '/staff', label: t.nav.patients, short: 'Pasien', icon: Users },
    { to: '/staff/inbox', label: t.nav.inbox, short: 'Inbox', icon: MessageSquare },
    { to: '/staff/education', label: t.nav.articles, short: 'Edukasi', icon: BookOpen },
    { to: '/staff/questionnaires', label: t.nav.questionnaires, short: 'Survei', icon: ClipboardList },
    { to: '/staff/export', label: t.nav.researchExport, short: 'Laporan', icon: FileSpreadsheet },
    ...(isAdmin
      ? [{ to: '/admin', label: t.nav.adminPortal, short: 'Admin', icon: ShieldCheck }]
      : []),
  ];

  const links = isStaff ? staffLinks : patientLinks;
  const mobileLinks = isStaff
    ? staffLinks
    : patientLinks.filter((link) => !['/surveys', '/education'].includes(link.to));

  const handleConfirmAlarmDose = async () => {
    if (activeAlert?.doseId) {
      try {
        await api.updateDoseStatus(activeAlert.doseId, 'TAKEN', 'Dikonfirmasi dari alarm pengingat');
      } catch {
        // ignore
      }
    }
    clearAlert();
  };

  return (
    <>
      {/* Interactive Medication Alarm Banner */}
      {activeAlert && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 shadow-lg sticky top-0 z-50 border-b border-amber-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 text-sm font-medium">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center animate-bounce shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-sm flex items-center gap-2">
                  <span>{activeAlert.title}</span>
                  {activeAlert.time && (
                    <span className="text-[11px] bg-black/20 px-2 py-0.5 rounded-full font-semibold">
                      {activeAlert.time}
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-50">
                  {activeAlert.message}
                  {activeAlert.instructions ? ` — ${activeAlert.instructions}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              {activeAlert.doseId && (
                <button
                  onClick={handleConfirmAlarmDose}
                  className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{lang === 'id' ? 'Sudah Diminum' : 'Mark Taken'}</span>
                </button>
              )}
              <button
                onClick={() => snoozeAlert(10)}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{lang === 'id' ? 'Tunda 10m' : 'Snooze 10m'}</span>
              </button>
              <button
                onClick={clearAlert}
                className="text-white hover:text-amber-100 text-xs font-semibold px-2.5 py-1.5 bg-black/20 rounded-lg"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to={isAdmin ? '/admin' : isStaff ? '/staff' : '/'} className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm">
                <Pill className="w-6 h-6 transform -rotate-45" />
              </div>
              <div>
                <span className="font-bold text-xl text-teal-950 tracking-tight flex items-center gap-1.5">
                  DoseLynx
                  {isStaff && (
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                      isAdmin ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                    }`}>
                      {user.role === 'ADMIN' ? 'Admin' : (lang === 'id' ? 'Apoteker' : 'Pharmacist')}
                    </span>
                  )}
                </span>
                <p className="text-[11px] text-slate-500 hidden xl:block leading-none">
                  {t.tagline}
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-0.5 ml-4">
              {links.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center space-x-1.5 px-2.5 py-2 rounded-lg text-xs lg:text-sm font-medium transition ${
                      active
                        ? 'bg-teal-50 text-teal-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Header: Language toggle, User Name, Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              title="Ganti Bahasa / Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{lang === 'id' ? '🇮🇩 ID' : '🇬🇧 EN'}</span>
            </button>

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs lg:text-sm font-semibold text-slate-900 leading-tight max-w-[160px] truncate">
                {user.name}
              </span>
              <span className="text-[11px] text-slate-500">
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

      {/* Bottom Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-1 py-1 flex justify-around print:hidden">
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center py-1 px-1.5 text-[10px] font-medium rounded-lg transition ${
                active ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className="mt-0.5 truncate max-w-[58px]">{link.short || link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
