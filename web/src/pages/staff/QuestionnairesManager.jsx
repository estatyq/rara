import { useState, useEffect } from 'react';
import { ClipboardList, Users, CheckCircle2, Eye, Award } from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function StaffQuestionnairesManager() {
  const { t, lang } = useLanguage();
  const [questionnaires, setQuestionnaires] = useState([]);
  const [selectedQ, setSelectedQ] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(false);

  useEffect(() => {
    api.getQuestionnaires(true)
      .then((res) => setQuestionnaires(res.questionnaires || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleViewResponses = async (q) => {
    setSelectedQ(q);
    setLoadingResponses(true);
    try {
      const res = await api.getQuestionnaireResponses(q.id);
      setResponses(res.responses || []);
    } catch (err) {
      alert(err.message || 'Gagal memuat jawaban');
    } finally {
      setLoadingResponses(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.staff.questionnaires}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Instrumen kuesioner kepatuhan dan survei literasi obat yang digunakan dalam penelitian.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {questionnaires.map((q) => {
          const respCount = q._count?.responses || 0;

          return (
            <div
              key={q.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-teal-300 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase">
                    {q.code}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {respCount} Responden
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-lg leading-snug">
                  {lang === 'en' ? q.titleEn : q.titleId}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {lang === 'en' ? q.descriptionEn : q.descriptionId}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                  <ClipboardList className="w-4 h-4" />
                  <span>{q.questions.length} Butir Pertanyaan</span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => handleViewResponses(q)}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  <Eye className="w-4 h-4" />
                  <span>Lihat Jawaban Partisipan</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Responses Modal */}
      {selectedQ && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-teal-700 uppercase">{selectedQ.code}</span>
                <h3 className="text-lg font-bold text-slate-900">{selectedQ.titleId}</h3>
              </div>
              <button
                onClick={() => setSelectedQ(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Tutup
              </button>
            </div>

            {loadingResponses ? (
              <div className="p-8 text-center text-slate-400 text-xs">Memuat jawaban...</div>
            ) : responses.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">Belum ada tanggapan untuk kuesioner ini.</p>
            ) : (
              <div className="space-y-3">
                {responses.map((r) => (
                  <div key={r.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{r.patient?.user?.name}</span>
                        <span className="font-mono text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                          {r.patient?.studyCode || 'P-???'}
                        </span>
                      </div>
                      {r.score !== null && (
                        <span className="font-bold text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                          Skor: {r.score}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                      <pre className="font-mono text-[11px] overflow-x-auto">
                        {JSON.stringify(r.answers, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
