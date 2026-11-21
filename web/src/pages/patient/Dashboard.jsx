import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Clock, MessageSquare, AlertCircle, ShieldAlert, Sparkles, BookOpen, Activity, ArrowRight, ClipboardList, Stethoscope, FileText } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import AdherenceRing from '../../components/AdherenceRing';
import { dateTimeInputInZone } from '../../utils/date';

export default function PatientDashboard() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { socket } = useSocket();

  const [doses, setDoses] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [bloodPressure, setBloodPressure] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const today = dateTimeInputInZone(new Date(), user.timezone).slice(0, 10);
      const [dosesRes, adhRes, bpRes, messagesRes] = await Promise.all([
        api.getDoses('me', today, today),
        api.getAdherence('me', 30),
        api.getBloodPressures('me', 30, 1).catch(() => ({ summary: null })),
        api.getMessages('me', 50).catch(() => ({ messages: [] })),
      ]);
      setDoses(dosesRes.doses || []);
      setAdherence(adhRes);
      setBloodPressure(bpRes.summary || null);
      setUnreadMessages(
        (messagesRes.messages || []).filter((message) => !message.readAt && message.sender?.role !== 'PATIENT').length,
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

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => loadData();
    socket.on('dose:updated', handleUpdate);
    socket.on('dose:due', handleUpdate);
    socket.on('medications:changed', handleUpdate);
    socket.on('blood-pressure:changed', handleUpdate);
    socket.on('message:new', () => setUnreadMessages((prev) => prev + 1));

    return () => {
      socket.off('dose:updated', handleUpdate);
      socket.off('dose:due', handleUpdate);
      socket.off('medications:changed', handleUpdate);
      socket.off('blood-pressure:changed', handleUpdate);
    };
  }, [socket, loadData]);

  const handleStatusChange = async (doseId, status, note) => {
    setSubmittingId(doseId);
    try {
      let finalNote = note;
      if (status === 'SKIPPED' && finalNote === undefined) {
        finalNote = window.prompt(
          lang === 'id'
            ? 'Alasan melewati dosis ini (opsional, misal: mual atau lupa):'
            : 'Reason for skipping this dose (optional, e.g. nausea):',
          '',
        );
        if (finalNote === null) {
          setSubmittingId(null);
          return;
        }
      }
      await api.updateDoseStatus(doseId, status, finalNote || undefined);
      await loadData();
    } catch (err) {
      alert(err.message || 'Gagal memperbarui status');
    } finally {
      setSubmittingId(null);
    }
  };

  const takenCount = doses.filter((d) => d.status === 'TAKEN').length;
  const totalCount = doses.length;
  const progressPct = totalCount ? Math.round((takenCount / totalCount) * 100) : 0;

  const todayStr = new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: user.timezone,
  }).format(new Date());

  const gestationalAge = (() => {
    if (!user.patient?.estimatedDueDate) return null;
    const daysRemaining = Math.ceil((new Date(user.patient.estimatedDueDate) - new Date()) / 86400000);
    const daysPregnant = Math.max(0, Math.min(294, 280 - daysRemaining));
    return {
      weeks: Math.floor(daysPregnant / 7),
      days: daysPregnant % 7,
    };
  })();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
      {/* Welcome & Date Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-teal-200 text-xs font-semibold uppercase tracking-wider">
            {todayStr}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            {lang === 'id' ? `Halo, ${user.name} 👋` : `Hello, ${user.name} 👋`}
          </h1>
          <p className="text-teal-100 text-sm mt-1 max-w-lg">
            {lang === 'id'
              ? 'Tetap rutin minum obat dan catat tekanan darah untuk membantu pemantauan kehamilan Anda.'
              : 'Keep taking your medicines and recording blood pressure to support your pregnancy monitoring.'}
          </p>
          {gestationalAge && (
            <span className="inline-flex mt-3 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-teal-50">
              {lang === 'id' ? 'Usia kehamilan' : 'Gestational age'}: {gestationalAge.weeks} {lang === 'id' ? 'minggu' : 'weeks'} {gestationalAge.days} {lang === 'id' ? 'hari' : 'days'}
            </span>
          )}
        </div>

        {/* Adherence Mini Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex items-center gap-4 self-start sm:self-center">
          <div className="text-center">
            <span className="text-3xl font-extrabold leading-none">
              {adherence?.rate !== null && adherence?.rate !== undefined ? `${Math.round(adherence.rate)}%` : '—'}
            </span>
            <span className="block text-[10px] uppercase font-semibold text-teal-200 mt-1">
              {t.patient.adherenceRate}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Dose Schedule & Adherence Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Schedule */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {t.patient.todaySchedule}
                </h2>
                <p className="text-xs text-slate-500">
                  {takenCount} dari {totalCount} {t.patient.dosesTaken}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-28 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-teal-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {doses.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Sparkles className="w-10 h-10 mx-auto text-teal-400 mb-2 stroke-1" />
                <p className="text-sm font-medium">{t.patient.noDosesToday}</p>
                <Link to="/medications" className="mt-2 inline-block text-xs text-teal-600 font-semibold hover:underline">
                  {t.patient.myMedsTitle} →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {doses.map((dose) => {
                  const scheduledTime = new Intl.DateTimeFormat('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: user.timezone,
                  }).format(new Date(dose.scheduledAt));

                  const isTaken = dose.status === 'TAKEN';
                  const isSkipped = dose.status === 'SKIPPED';
                  const isMissed = dose.status === 'MISSED';
                  const isPending = dose.status === 'PENDING';
                  const isBusy = submittingId === dose.id;

                  return (
                    <div
                      key={dose.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isTaken
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : isSkipped
                          ? 'bg-slate-50 border-slate-200 opacity-70'
                          : isMissed
                          ? 'bg-rose-50/60 border-rose-200'
                          : 'bg-white border-slate-200 hover:border-teal-300 shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-bold text-sm px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {scheduledTime}
                            </span>
                            <span className="font-bold text-slate-900 text-base">
                              {dose.medication.name}
                            </span>
                            {dose.medication.dosage && (
                              <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                                {dose.medication.dosage}
                              </span>
                            )}
                          </div>

                          {dose.medication.instructions && (
                            <p className="text-xs text-slate-600 pl-0.5">
                              {dose.medication.instructions}
                            </p>
                          )}

                          {dose.note && (
                            <p className="text-xs italic text-slate-500 pl-0.5">
                              "{dose.note}"
                            </p>
                          )}
                        </div>

                        {/* Status / Action Buttons */}
                        <div className="flex items-center justify-end gap-2 shrink-0 w-full sm:w-auto pt-1 sm:pt-0 border-t border-slate-100 sm:border-0">
                          {isPending && (
                            <>
                              <button
                                disabled={isBusy}
                                onClick={() => handleStatusChange(dose.id, 'TAKEN')}
                                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{t.patient.takeDose}</span>
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={() => handleStatusChange(dose.id, 'SKIPPED')}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition disabled:opacity-50"
                                title={t.patient.skipDose}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {isTaken && (
                            <div className="flex items-center space-x-1.5">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                {t.patient.statusTaken}
                              </span>
                              <button
                                disabled={isBusy}
                                onClick={() => handleStatusChange(dose.id, 'PENDING')}
                                className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                              >
                                {t.patient.undo}
                              </button>
                            </div>
                          )}

                          {isSkipped && (
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-semibold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-lg">
                                {t.patient.statusSkipped}
                              </span>
                              <button
                                disabled={isBusy}
                                onClick={() => handleStatusChange(dose.id, 'PENDING')}
                                className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                              >
                                {t.patient.undo}
                              </button>
                            </div>
                          )}

                          {isMissed && (
                            <div className="flex items-center space-x-1.5">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {t.patient.statusMissed}
                              </span>
                              <button
                                disabled={isBusy}
                                onClick={() => handleStatusChange(dose.id, 'TAKEN')}
                                className="text-xs font-semibold text-teal-700 hover:underline"
                              >
                                {t.patient.takeDose}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Adherence Summary & Quick Shortcuts */}
        <div className="space-y-6">
          {/* Adherence Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
            <h3 className="text-sm font-bold text-slate-800 mb-3 text-left">
              {t.patient.adherenceRate}
            </h3>
            <div className="py-2">
              <AdherenceRing rate={adherence?.rate} size={140} strokeWidth={12} label="30 Hari" />
            </div>
            {adherence?.counts && (
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                  <span className="block text-base font-extrabold text-emerald-700">
                    {adherence.counts.TAKEN}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-800 uppercase">
                    Diminum
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                  <span className="block text-base font-extrabold text-slate-700">
                    {adherence.counts.SKIPPED}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-600 uppercase">
                    Lewat
                  </span>
                </div>
                <div className="bg-rose-50 rounded-xl p-2 border border-rose-100">
                  <span className="block text-base font-extrabold text-rose-700">
                    {adherence.counts.MISSED}
                  </span>
                  <span className="text-[10px] font-semibold text-rose-800 uppercase">
                    Lupa
                  </span>
                </div>
              </div>
            )}
          </div>

          <Link
            to="/blood-pressure"
            className="block bg-white rounded-2xl p-5 border border-slate-200 hover:border-rose-300 shadow-sm transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Activity className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {lang === 'id' ? 'Tekanan Darah' : 'Blood Pressure'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'id' ? 'Catat hasil pengukuran hari ini' : 'Record today’s reading'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-rose-500 group-hover:translate-x-0.5 transition" />
            </div>
            {bloodPressure?.latest ? (
              <div className="mt-4 flex items-end justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {bloodPressure.latest.systolic}/{bloodPressure.latest.diastolic}
                  </span>
                  <span className="text-[11px] text-slate-400">mmHg</span>
                </div>
                <span className={`text-[10px] font-bold rounded-full px-2 py-1 border ${
                  bloodPressure.latest.category === 'NORMAL'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : bloodPressure.latest.category === 'LOW'
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : bloodPressure.latest.category === 'ELEVATED'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {bloodPressure.latest.controlled
                    ? (lang === 'id' ? 'Terkontrol' : 'Controlled')
                    : (lang === 'id' ? 'Perlu ditinjau' : 'Review')}
                </span>
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-400">
                {lang === 'id' ? 'Belum ada pengukuran tersimpan.' : 'No readings saved yet.'}
              </p>
            )}
          </Link>

          {/* Quick Pharmacy Services Link */}
          <Link
            to="/services"
            className="block bg-white rounded-2xl p-5 border border-slate-200 hover:border-teal-300 shadow-sm transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition">
                    {lang === 'id' ? 'Layanan Kefarmasian' : 'Pharmacy Services'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {lang === 'id'
                      ? 'Ajukan evaluasi PTO, rekonsiliasi jadwal obat, atau telefarmasi'
                      : 'Request PTO evaluation, schedule reconciliation, or telepharmacy'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600 transition" />
            </div>
          </Link>

          {/* Quick Chat with Pharmacist */}
          <Link
            to="/chat"
            className="block bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-5 border border-teal-200 hover:shadow-md transition group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition">
                  {t.patient.chatGreeting}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Tanyakan dosis, efek samping, atau cara minum obat langsung ke apoteker Anda.
                </p>
              </div>
            </div>
          </Link>

          {/* Educational Articles Quick Link */}
          <Link
            to="/education"
            className="block bg-white rounded-2xl p-5 border border-slate-200 hover:border-teal-300 shadow-sm transition group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition">
                  {t.patient.educationTitle}
                </h4>
                <p className="text-xs text-slate-500">
                  Panduan kehamilan risiko tinggi, tekanan darah, dan obat yang diresepkan.
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/surveys"
            className="block bg-white rounded-2xl p-4 border border-slate-200 hover:border-indigo-300 shadow-sm transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {lang === 'id' ? 'Kuesioner Penelitian' : 'Study questionnaires'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {lang === 'id' ? 'Bantu peneliti memahami pengalaman Anda' : 'Help researchers understand your experience'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
