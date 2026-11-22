import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, X, Clock, MessageSquare, Bell, BookOpen, Activity, ArrowRight,
  ClipboardList, Stethoscope, CalendarClock, Pill, HeartPulse, CheckCircle2
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import AdherenceRing from '../../components/AdherenceRing';
import { dateTimeInputInZone } from '../../utils/date';

export default function PatientDashboard() {
  const { user } = useAuth();
  const { t, lang, dateLocale, localize } = useLanguage();
  const { socket, triggerAlarm } = useSocket();

  const [doses, setDoses] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [bloodPressure, setBloodPressure] = useState(null);
  const [checkups, setCheckups] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const tz = user.timezone || 'Asia/Jakarta';
      const today = dateTimeInputInZone(new Date(), tz).slice(0, 10);
      const [dosesRes, adhRes, bpRes, messagesRes, checkupRes] = await Promise.all([
        api.getDoses('me', today, today),
        api.getAdherence('me', 30),
        api.getBloodPressures('me', 30, 1).catch(() => ({ summary: null })),
        api.getMessages('me', 50).catch(() => ({ messages: [] })),
        api.getCheckups('me').catch(() => ({ reminders: [] })),
      ]);
      setDoses(dosesRes.doses || []);
      setAdherence(adhRes);
      setBloodPressure(bpRes.summary || null);
      setCheckups((checkupRes.reminders || []).filter((r) => r.status === 'UPCOMING'));
      setUnreadMessages(
        (messagesRes.messages || []).filter((m) => !m.readAt && m.sender?.role !== 'PATIENT').length,
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.timezone]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => loadData();
    const handleNewMsg = () => setUnreadMessages((prev) => prev + 1);
    socket.on('dose:updated', handleUpdate);
    socket.on('dose:due', handleUpdate);
    socket.on('medications:changed', handleUpdate);
    socket.on('blood-pressure:changed', handleUpdate);
    socket.on('checkup:changed', handleUpdate);
    socket.on('message:new', handleNewMsg);

    return () => {
      socket.off('dose:updated', handleUpdate);
      socket.off('dose:due', handleUpdate);
      socket.off('medications:changed', handleUpdate);
      socket.off('blood-pressure:changed', handleUpdate);
      socket.off('checkup:changed', handleUpdate);
      socket.off('message:new', handleNewMsg);
    };
  }, [socket, loadData]);

  const handleStatusChange = async (doseId, status, note) => {
    setSubmittingId(doseId);
    try {
      let finalNote = note;
      if (status === 'SKIPPED' && finalNote === undefined) {
        finalNote = window.prompt(t.patient.skipPrompt, '');
        if (finalNote === null) {
          setSubmittingId(null);
          return;
        }
      }
      await api.updateDoseStatus(doseId, status, finalNote || undefined);
      await loadData();
    } catch (err) {
      alert(err.message || t.common.loading);
    } finally {
      setSubmittingId(null);
    }
  };

  const firstName = (user.name || '').split(' ')[0];
  const takenCount = doses.filter((d) => d.status === 'TAKEN').length;
  const totalCount = doses.length;
  const todayPct = totalCount ? Math.round((takenCount / totalCount) * 100) : 100;
  const nextDose = doses.find((d) => d.status === 'PENDING') || doses[0] || null;
  const nextCheckup = checkups[0] || null;

  const formatTime = (iso) =>
    new Intl.DateTimeFormat(dateLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: user.timezone || 'Asia/Jakarta',
    }).format(new Date(iso));

  const formatDateShort = (iso) =>
    new Intl.DateTimeFormat(dateLocale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: user.timezone || 'Asia/Jakarta',
    }).format(new Date(iso));

  const gestationalAge = (() => {
    if (!user.patient?.estimatedDueDate) return null;
    const daysRemaining = Math.ceil((new Date(user.patient.estimatedDueDate) - new Date()) / 86400000);
    const daysPregnant = Math.max(0, Math.min(294, 280 - daysRemaining));
    return { weeks: Math.floor(daysPregnant / 7), days: daysPregnant % 7 };
  })();

  const handlePreviewAlarm = () => {
    const target = nextDose;
    const medName = localize(target?.medication?.name || 'Aspirin dosis rendah');
    triggerAlarm({
      type: 'dose',
      doseId: target?.id || null,
      medication: medName,
      dosage: target?.medication?.dosage || '80 mg',
      instructions: localize(target?.medication?.instructions) || null,
      title: t.alarm.pushHeader,
      message: target
        ? `${medName}${target.medication.dosage ? ` • ${target.medication.dosage}` : ''}`
        : `${medName} • 80 mg`,
    });
  };

  const quickActions = [
    { to: '/medications', label: t.patient.quickGrid.history, icon: Pill, bg: 'bg-teal-50 text-teal-700 border-teal-100' },
    { to: '/blood-pressure', label: t.patient.quickGrid.health, icon: HeartPulse, bg: 'bg-sky-50 text-sky-700 border-sky-100' },
    { to: '/education', label: t.patient.quickGrid.education, icon: BookOpen, bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { to: '/chat', label: t.patient.quickGrid.pharmacist, icon: MessageSquare, bg: 'bg-cyan-50 text-cyan-700 border-cyan-100', badge: unreadMessages },
    { to: '/services', label: t.patient.quickGrid.care, icon: Stethoscope, bg: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { to: '/surveys', label: t.patient.quickGrid.surveys, icon: ClipboardList, bg: 'bg-amber-50 text-amber-700 border-amber-100' },
  ];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-14 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Greeting Row matching DoseLynx Mobile Mockup */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {lang === 'id' ? `Halo, ${firstName}!` : `Hello, ${firstName}!`} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
            <span>{t.patient.greetingSub}</span>
            {gestationalAge && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-100">
                {lang === 'id'
                  ? `Usia kehamilan: ${gestationalAge.weeks} mgg ${gestationalAge.days} hr`
                  : `Gestational age: ${gestationalAge.weeks}w ${gestationalAge.days}d`}
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handlePreviewAlarm}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-teal-100 text-teal-700 hover:bg-teal-50 shadow-xs text-xs font-bold transition shrink-0"
          title={t.alarm.testAlarm}
        >
          <Bell className="w-4 h-4 text-teal-600" />
          <span className="hidden sm:inline">{t.alarm.testAlarm}</span>
        </button>
      </div>

      {/* Main Responsive 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Primary Column */}
        <div className="lg:col-span-7 space-y-5">
          {/* Soft-Mint Today's Adherence Highlight Card (DoseLynx Screen 2) */}
          <div className="bg-gradient-to-br from-[#DFF6EC] via-[#E9F9F2] to-[#E6F4F9] rounded-3xl p-5 sm:p-6 border border-emerald-200/70 shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
                {t.patient.todayAdherence}
              </p>
              <div className="text-4xl sm:text-5xl font-extrabold text-teal-900 mt-1 tracking-tight">
                {todayPct}%
              </div>
              <p className="text-xs font-bold text-emerald-700 mt-1.5 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>
                  {totalCount > 0 && takenCount === totalCount
                    ? t.patient.allTakenBadge
                    : `${takenCount} / ${totalCount} ${t.patient.inProgressBadge}`}
                </span>
              </p>
            </div>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 shrink-0">
              <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11" />
            </div>
          </div>

          {/* Next Medication Spotlight Card (DoseLynx Screen 2) */}
          {nextDose && (
            <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  {t.patient.nextMedication}
                </span>
                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">
                  {nextDose.status === 'PENDING' ? t.patient.statusPending : t.patient.statusTaken}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="px-3.5 py-2.5 rounded-2xl bg-[#F0FAF8] border border-teal-100 text-center shrink-0">
                  <div className="text-xl font-extrabold text-teal-900 leading-none">
                    {formatTime(nextDose.scheduledAt)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-slate-900 text-base truncate">
                    {localize(nextDose.medication.name)}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {nextDose.medication.dosage || '—'}
                    {nextDose.medication.form ? ` • ${nextDose.medication.form}` : ''}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {nextDose.status === 'PENDING' ? (
                  <button
                    type="button"
                    disabled={submittingId === nextDose.id}
                    onClick={() => handleStatusChange(nextDose.id, 'TAKEN')}
                    className="py-2.5 px-4 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{t.patient.takeDose}</span>
                  </button>
                ) : (
                  <Link
                    to="/medications"
                    className="py-2.5 px-4 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition"
                  >
                    <span>{t.patient.quickGrid.history}</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handlePreviewAlarm}
                  className="py-2.5 px-4 rounded-full bg-[#EAF7F6] hover:bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{t.patient.remindMe}</span>
                </button>
              </div>
            </div>
          )}

          {/* 3x2 Quick Action Grid (Exact DoseLynx Screen 2 layout) */}
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="relative bg-white hover:bg-[#F7FCFB] rounded-2xl p-4 border border-teal-100/80 shadow-xs flex flex-col items-center justify-center text-center gap-2 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {item.badge > 0 && (
                    <span className="absolute top-2.5 right-2.5 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${item.bg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Full Today's Schedule List */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-teal-100/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">{t.patient.todaySchedule}</h2>
                <p className="text-xs text-slate-500">
                  {takenCount} / {totalCount} {t.patient.dosesTaken}
                </p>
              </div>
              <Link to="/medications" className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1">
                <span>{t.common.viewAll}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {doses.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">{t.patient.noDosesToday}</div>
            ) : (
              <div className="space-y-3">
                {doses.map((dose) => {
                  const isTaken = dose.status === 'TAKEN';
                  const isSkipped = dose.status === 'SKIPPED';
                  const isMissed = dose.status === 'MISSED';
                  return (
                    <div
                      key={dose.id}
                      className={`rounded-2xl p-4 border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isTaken
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : isSkipped || isMissed
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-[#F8FCFB] border-teal-100'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-teal-900 bg-white px-2.5 py-1 rounded-xl border border-teal-100">
                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                            {formatTime(dose.scheduledAt)}
                          </span>
                          <span className="font-bold text-sm text-slate-900">{localize(dose.medication.name)}</span>
                          {dose.medication.dosage && (
                            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                              {dose.medication.dosage}
                            </span>
                          )}
                        </div>
                        {dose.medication.instructions && (
                          <p className="text-xs text-slate-500 mt-1.5">{localize(dose.medication.instructions)}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isTaken ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                              <Check className="w-3.5 h-3.5" />
                              {t.patient.statusTaken}
                            </span>
                            <button
                              type="button"
                              disabled={submittingId === dose.id}
                              onClick={() => handleStatusChange(dose.id, 'PENDING')}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1"
                            >
                              {t.patient.undo}
                            </button>
                          </div>
                        ) : isSkipped || isMissed ? (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                              {isSkipped ? t.patient.statusSkipped : t.patient.statusMissed}
                            </span>
                            <button
                              type="button"
                              disabled={submittingId === dose.id}
                              onClick={() => handleStatusChange(dose.id, 'TAKEN')}
                              className="text-xs font-bold text-teal-700 hover:underline px-2 py-1"
                            >
                              {t.patient.takeDose}
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={submittingId === dose.id}
                              onClick={() => handleStatusChange(dose.id, 'TAKEN')}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{t.patient.takeDose}</span>
                            </button>
                            <button
                              type="button"
                              disabled={submittingId === dose.id}
                              onClick={() => handleStatusChange(dose.id, 'SKIPPED')}
                              className="p-2 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 transition"
                              title={t.patient.skipDose}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Secondary Column: 30d Adherence, Blood Pressure, Next Checkup */}
        <div className="lg:col-span-5 space-y-5">
          {/* 30-Day Adherence Ring */}
          <div className="bg-white rounded-3xl p-6 border border-teal-100/80 shadow-sm flex flex-col items-center text-center">
            <h3 className="text-sm font-extrabold text-slate-900 mb-4">{t.patient.adherenceRate}</h3>
            <AdherenceRing percentage={adherence?.rate ?? 0} size={132} />
            <div className="grid grid-cols-3 gap-2.5 w-full mt-5">
              <div className="rounded-2xl bg-emerald-50/80 p-2.5 border border-emerald-100">
                <div className="text-lg font-extrabold text-emerald-700">{adherence?.counts?.TAKEN ?? 0}</div>
                <div className="text-[10px] font-bold uppercase text-emerald-600">{t.patient.statusTaken}</div>
              </div>
              <div className="rounded-2xl bg-amber-50/80 p-2.5 border border-amber-100">
                <div className="text-lg font-extrabold text-amber-700">{adherence?.counts?.SKIPPED ?? 0}</div>
                <div className="text-[10px] font-bold uppercase text-amber-600">{t.patient.statusSkipped}</div>
              </div>
              <div className="rounded-2xl bg-rose-50/80 p-2.5 border border-rose-100">
                <div className="text-lg font-extrabold text-rose-700">{adherence?.counts?.MISSED ?? 0}</div>
                <div className="text-[10px] font-bold uppercase text-rose-600">{t.patient.statusMissed}</div>
              </div>
            </div>
          </div>

          {/* Latest Blood Pressure Summary */}
          <Link
            to="/blood-pressure"
            className="block bg-white rounded-3xl p-5 border border-teal-100/80 shadow-sm hover:border-teal-300 transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{t.health.tabBp}</h3>
                  <p className="text-xs text-slate-500">
                    {bloodPressure?.latest
                      ? `${bloodPressure.latest.systolic}/${bloodPressure.latest.diastolic} mmHg`
                      : (lang === 'id' ? 'Belum ada pengukuran' : 'No reading yet')}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* Upcoming Check-Up Reminder Card */}
          <Link
            to="/blood-pressure?tab=checkups"
            className="block bg-gradient-to-br from-[#EDF9F8] to-white rounded-3xl p-5 border border-teal-100 shadow-sm hover:border-teal-300 transition group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700">
                    {t.health.tabCheckups}
                  </span>
                  {nextCheckup ? (
                    <>
                      <h3 className="text-sm font-extrabold text-slate-900 mt-0.5 leading-snug">
                        {localize(nextCheckup.title)}
                      </h3>
                      <p className="text-xs text-teal-800 font-semibold mt-1">
                        {formatDateShort(nextCheckup.scheduledAt)}
                        {nextCheckup.location ? ` • ${localize(nextCheckup.location)}` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">{t.health.noCheckups}</p>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-teal-600 shrink-0 mt-1 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
