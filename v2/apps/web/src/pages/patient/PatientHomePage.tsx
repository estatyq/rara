import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Bell, BookOpen, CalendarClock, Check, CheckCircle2,
  Clock, HeartPulse, MessageSquare, Pill, ShieldCheck, X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export default function PatientHomePage() {
  const { t } = useTranslation(['patient', 'alarm', 'common']);
  const { user, setActiveAlarm } = useAuth();
  const qc = useQueryClient();

  const { data: dosesRes, isLoading } = useQuery({
    queryKey: ['doses', 'today'],
    queryFn: () => api.getDoses('me'),
  });

  const { data: medsRes } = useQuery({
    queryKey: ['medications', 'me'],
    queryFn: () => api.getMedications('me'),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'TAKEN' | 'SKIPPED' | 'PENDING' }) =>
      api.confirmDose(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['doses'] });
      toast.success(t('patient:statusTaken'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const doses = dosesRes?.doses ?? [];
  const spacingWarnings = medsRes?.spacingWarnings ?? [];
  const takenCount = doses.filter((d) => d.status === 'TAKEN').length;
  const totalCount = doses.length;
  const todayPct = totalCount ? Math.round((takenCount / totalCount) * 100) : 100;
  const nextDose = doses.find((d) => d.status === 'PENDING') ?? doses[0] ?? null;
  const firstName = (user?.name || '').split(' ')[0] || 'Patient';

  const triggerPreviewAlarm = () => {
    setActiveAlarm({
      doseId: nextDose?.id ?? null,
      medicationName: nextDose?.medication.displayName ?? 'Aspirin dosis rendah',
      dosage: nextDose?.medication.dosage ?? '80 mg',
      instructions: nextDose?.medication.instructions ?? null,
      timeLabel: nextDose?.localTime ?? 'Now',
    });
  };

  const quickGrid = [
    { to: '/health', label: t('patient:quickHealth'), icon: HeartPulse, cls: 'bg-sky-50 text-sky-700 border-sky-100' },
    { to: '/education', label: t('patient:quickEducation'), icon: BookOpen, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { to: '/chat', label: t('patient:quickPharmacist'), icon: MessageSquare, cls: 'bg-teal-50 text-teal-700 border-teal-100' },
    { to: '/health?tab=checkups', label: t('patient:quickFollowUp'), icon: CalendarClock, cls: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { to: '/health?tab=params', label: t('patient:quickHistory'), icon: Pill, cls: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
    { to: '/profile', label: t('patient:quickCaregivers'), icon: ShieldCheck, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  ];

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-14 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t('common:loading')}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Greeting Row matching DoseLynx Screen 2 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('patient:greeting', { name: firstName })} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('patient:greetingSub')}</p>
        </div>
        <button
          type="button"
          onClick={triggerPreviewAlarm}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-teal-100 text-teal-700 hover:bg-teal-50 shadow-xs text-xs font-bold transition"
        >
          <Bell className="w-4 h-4" />
          <span>{t('alarm:testAlarm')}</span>
        </button>
      </div>

      {/* Automatic Calcium <-> Iron Spacing Advisory (Section D) */}
      {spacingWarnings.length > 0 && (
        <div className="rounded-3xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <div className="font-extrabold">{t('patient:spacingWarningTitle')}</div>
            <p className="mt-0.5">
              {t('patient:spacingWarningBody', {
                medA: spacingWarnings[0]?.medA,
                medB: spacingWarnings[0]?.medB,
                minutes: spacingWarnings[0]?.minGapMinutes,
              })}
            </p>
          </div>
        </div>
      )}

      {/* Today's Adherence Mint Highlight Card (DoseLynx Screen 2) */}
      <div className="bg-gradient-to-br from-[#DFF6EC] via-[#E9F9F2] to-[#E6F4F9] rounded-3xl p-6 border border-emerald-200/70 shadow-sm flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-teal-800">{t('patient:todayAdherence')}</p>
          <div className="text-4xl sm:text-5xl font-extrabold text-teal-900 mt-1">{todayPct}%</div>
          <p className="text-xs font-bold text-emerald-700 mt-1.5 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>
              {totalCount > 0 && takenCount === totalCount
                ? t('patient:allTaken')
                : t('patient:dosesDone', { taken: takenCount, total: totalCount })}
            </span>
          </p>
        </div>
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 shrink-0">
          <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11" />
        </div>
      </div>

      {/* Next Medication Spotlight */}
      {nextDose && (
        <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              {t('patient:nextSchedule')}
            </span>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">
              {nextDose.localTime}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-3 rounded-2xl bg-[#F0FAF8] border border-teal-100 text-xl font-extrabold text-teal-900">
              {nextDose.localTime}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-slate-900 text-base truncate">{nextDose.medication.displayName}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {nextDose.medication.dosage || '—'}
                {nextDose.medication.form ? ` • ${nextDose.medication.form}` : ''}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => confirmMutation.mutate({ id: nextDose.id, status: 'TAKEN' })}
              className="py-2.5 px-4 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition"
            >
              <Check className="w-4 h-4" />
              <span>{t('alarm:taken')}</span>
            </button>
            <button
              type="button"
              onClick={triggerPreviewAlarm}
              className="py-2.5 px-4 rounded-full bg-[#EAF7F6] hover:bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{t('patient:remindMe')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3x2 Quick Action Grid */}
      <div className="grid grid-cols-3 gap-3">
        {quickGrid.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="bg-white hover:bg-[#F7FCFB] rounded-2xl p-4 border border-teal-100/80 shadow-xs flex flex-col items-center justify-center text-center gap-2 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${item.cls}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Full Today's Medication Schedule */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-teal-100 shadow-sm space-y-3">
        <h2 className="text-base font-extrabold text-slate-900">{t('patient:todayList')}</h2>
        {doses.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">{t('patient:noDosesToday')}</p>
        ) : (
          doses.map((d) => {
            const isTaken = d.status === 'TAKEN';
            return (
              <div
                key={d.id}
                className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isTaken ? 'bg-emerald-50/60 border-emerald-200' : 'bg-[#F8FCFB] border-teal-100'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-teal-900 bg-white px-2.5 py-1 rounded-xl border border-teal-100">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      {d.localTime}
                    </span>
                    <span className="font-bold text-sm text-slate-900">{d.medication.displayName}</span>
                    {d.medication.dosage && (
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                        {d.medication.dosage}
                      </span>
                    )}
                  </div>
                  {d.medication.instructions && <p className="text-xs text-slate-500 mt-1">{d.medication.instructions}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isTaken ? (
                    <>
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                        <Check className="w-3.5 h-3.5" />
                        {t('patient:statusTaken')}
                      </span>
                      <button
                        type="button"
                        onClick={() => confirmMutation.mutate({ id: d.id, status: 'PENDING' })}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2"
                      >
                        {t('patient:undo')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => confirmMutation.mutate({ id: d.id, status: 'TAKEN' })}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {t('alarm:taken')}
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmMutation.mutate({ id: d.id, status: 'SKIPPED' })}
                        className="p-2 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-rose-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
