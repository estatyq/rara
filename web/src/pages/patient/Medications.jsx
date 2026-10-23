import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Pill, Clock, BookOpen, Plus, Info, CheckCircle2 } from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function PatientMedications() {
  const { t } = useLanguage();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMedications('me', true)
      .then((res) => setMedications(res.medications || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  const activeMeds = medications.filter((m) => m.active);
  const inactiveMeds = medications.filter((m) => !m.active);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {t.patient.myMedsTitle}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t.patient.myMedsSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeMeds.map((med) => (
          <div
            key={med.id}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-teal-300 transition"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                    <Pill className="w-5 h-5 transform -rotate-45" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">
                      {med.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {med.dosage && (
                        <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full">
                          {med.dosage}
                        </span>
                      )}
                      {med.form && (
                        <span className="text-xs text-slate-500">
                          {med.form}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {med.instructions && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1">
                  <span className="font-semibold block text-slate-900">
                    {t.patient.instructions}:
                  </span>
                  <p>{med.instructions}</p>
                </div>
              )}

              {/* Scheduled times pills */}
              <div className="mt-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  {t.patient.scheduleTimes}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(med.times || []).map((time) => (
                    <span
                      key={time}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200"
                    >
                      <Clock className="w-3 h-3 text-slate-500" />
                      {time}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Linked Educational Article */}
            {med.article && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <Link
                  to={`/education/${med.article.slug || med.article.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{t.patient.readGuide}</span>
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {inactiveMeds.length > 0 && (
        <div className="pt-6 border-t border-slate-200">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
            Obat yang Telah Selesai / Dihentikan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60">
            {inactiveMeds.map((med) => (
              <div key={med.id} className="bg-slate-100 rounded-xl p-4 border border-slate-200">
                <h4 className="font-semibold text-slate-700 text-sm">{med.name} {med.dosage}</h4>
                <p className="text-xs text-slate-500 mt-1">Status: Tidak aktif</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
