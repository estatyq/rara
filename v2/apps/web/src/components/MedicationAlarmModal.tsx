import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { DoseMateMark } from './DoseMateLogo';

export default function MedicationAlarmModal() {
  const { t } = useTranslation(['alarm', 'common']);
  const { activeAlarm, setActiveAlarm } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!activeAlarm) return null;

  const confirm = async (status: 'TAKEN' | 'SKIPPED') => {
    if (activeAlarm.doseId) {
      setBusy(true);
      try {
        await api.confirmDose(activeAlarm.doseId, status);
        await qc.invalidateQueries({ queryKey: ['doses'] });
        toast.success(status === 'TAKEN' ? t('alarm:taken') : t('alarm:skipped'));
      } catch {
        toast.error(t('common:loading'));
      } finally {
        setBusy(false);
      }
    }
    setActiveAlarm(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#F4FAF9] via-white to-[#E6F7F5] rounded-[2rem] shadow-2xl border border-teal-100 p-6">
        {/* Top Push Notification Card matching DoseMate Screen 3 */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-teal-100 flex items-start gap-3">
          <DoseMateMark className="w-8 h-8 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-teal-800">DoseMate</span>
              <span className="text-[10px] text-slate-400">{activeAlarm.timeLabel}</span>
            </div>
            <p className="text-xs font-bold text-slate-900 mt-0.5">{t('alarm:header')}</p>
            <p className="text-xs text-slate-600 truncate">
              {activeAlarm.medicationName}
              {activeAlarm.dosage ? ` • ${activeAlarm.dosage}` : ''}
            </p>
          </div>
        </div>

        {/* Center Friendly Pill Graphic */}
        <div className="my-8 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-teal-50/90 border border-teal-100 flex items-center justify-center mb-5 shadow-inner">
            <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none">
              <g transform="rotate(-40 40 40)">
                <rect x="14" y="25" width="52" height="30" rx="15" fill="#F97316" />
                <path d="M40 25H51C59.284 25 66 31.716 66 40C66 48.284 59.284 55 51 55H40V25Z" fill="#BAE6FD" />
              </g>
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 leading-snug max-w-[240px]">
            {t('alarm:question')}
          </h2>
          <p className="text-sm font-bold text-teal-700 mt-2">
            {activeAlarm.medicationName}
            {activeAlarm.dosage ? ` (${activeAlarm.dosage})` : ''}
          </p>
          {activeAlarm.instructions && (
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs">{activeAlarm.instructions}</p>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm('TAKEN')}
            className="w-full py-3.5 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            <span>{t('alarm:taken')}</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm('SKIPPED')}
            className="w-full py-3.5 px-5 rounded-full bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <X className="w-4 h-4 text-rose-500 stroke-[2.5]" />
            <span>{t('alarm:skipped')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAlarm(null)}
            className="w-full py-2.5 text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center justify-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t('alarm:snooze')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
