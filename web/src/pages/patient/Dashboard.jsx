import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Clock, MessageSquare, AlertCircle, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import AdherenceRing from '../../components/AdherenceRing';

export default function PatientDashboard() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { socket } = useSocket();

  const [doses, setDoses] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [dosesRes, adhRes, unreadRes] = await Promise.all([
        api.getDoses('me', today, today),
        api.getAdherence('me', 30),
        api.getMessages('me', 1).catch(() => ({ messages: [] })),
      ]);
      setDoses(dosesRes.doses || []);
      setAdherence(adhRes);
      // Check unread
      const unreadCount = (dosesRes.doses || []).length;
      void unreadCount;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

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
    socket.on('message:new', () => setUnreadMessages((prev) => prev + 1));

    return () => {
      socket.off('dose:updated', handleUpdate);
      socket.off('dose:due', handleUpdate);
      socket.off('medications:changed', handleUpdate);
    };
  }, [socket, loadData]);

  const handleStatusChange = async (doseId, status) => {
    setSubmittingId(doseId);
    try {
      await api.updateDoseStatus(doseId, status);
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
  }).format(new Date());

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
              ? 'Pastikan pengobatan Anda diminum tepat waktu untuk hasil terapi yang optimal.'
              : 'Remember to take your medications on time to protect your health and therapy.'}
          </p>
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
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
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
                        <div className="flex items-center space-x-2 shrink-0">
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
                  Panduan obat Amlodipin, Metformin, & tips kesehatan.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
