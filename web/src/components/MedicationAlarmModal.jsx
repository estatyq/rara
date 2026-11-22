import { useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../api/client';
import { DoseMateMark } from './DoseMateLogo';

/**
 * Full-screen calm medication reminder & intake confirmation modal
 * modeled directly on the DoseLynx "Pengingat & Konfirmasi Obat" screen.
 */
export default function MedicationAlarmModal() {
  const { t } = useLanguage();
  const { activeAlert, clearAlert, snoozeAlert } = useSocket();
  const [busy, setBusy] = useState(false);

  if (!activeAlert) return null;

  const handleConfirm = async (status) => {
    if (activeAlert.doseId && activeAlert.type === 'dose') {
      setBusy(true);
      try {
        await api.updateDoseStatus(activeAlert.doseId, status, t.alarm.confirmedNote);
      } catch {
        // ignore transient error
      } finally {
        setBusy(false);
      }
    }
    clearAlert();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-sm bg-gradient-to-b from-[#F4FAF9] via-white to-[#E6F7F5] rounded-[2rem] shadow-2xl border border-teal-100 overflow-hidden p-6">
        {/* Top Push Notification Style Banner */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-teal-100 flex items-start gap-3">
          <DoseMateMark className="w-8 h-8 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-teal-800">DoseLynx</span>
              <span className="text-[10px] font-medium text-slate-400">
                {activeAlert.time || t.alarm.nowLabel}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-900 mt-0.5">{activeAlert.title}</p>
            <p className="text-xs text-slate-600 truncate">{activeAlert.message}</p>
          </div>
        </div>

        {/* Center Friendly Pill Illustration */}
        <div className="my-8 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-teal-50/80 border border-teal-100 flex items-center justify-center shadow-inner mb-5">
            <svg viewBox="0 0 80 80" className="w-16 h-16 drop-shadow-sm" fill="none">
              <g transform="rotate(-40 40 40)">
                <rect x="14" y="25" width="52" height="30" rx="15" fill="#F97316" />
                <path d="M40 25H51C59.284 25 66 31.716 66 40C66 48.284 59.284 55 51 55H40V25Z" fill="#BAE6FD" />
                <rect x="20" y="31" width="16" height="5" rx="2.5" fill="#FED7AA" fillOpacity="0.65" />
              </g>
            </svg>
          </div>

          <h2 className="text-xl font-extrabold text-slate-900 leading-snug max-w-[240px]">
            {t.alarm.question}
          </h2>
          <p className="text-sm font-semibold text-teal-700 mt-2">
            {activeAlert.message}
          </p>
          {activeAlert.instructions && (
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
              {activeAlert.instructions}
            </p>
          )}
        </div>

        {/* Action Buttons matching DoseLynx Mockup */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleConfirm('TAKEN')}
            className="w-full py-3.5 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            <span>{t.alarm.confirmTaken}</span>
          </button>

          {activeAlert.type === 'dose' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleConfirm('SKIPPED')}
              className="w-full py-3.5 px-5 rounded-full bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <X className="w-4 h-4 text-rose-500 stroke-[2.5]" />
              <span>{t.alarm.confirmSkipped}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => snoozeAlert(10)}
            className="w-full py-2.5 text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center justify-center gap-1.5 transition"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t.alarm.snoozeLater}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
