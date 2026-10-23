import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle2, Award, ArrowRight, HelpCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function PatientSurveys() {
  const { t, lang } = useLanguage();
  const [questionnaires, setQuestionnaires] = useState([]);
  const [responses, setResponses] = useState([]);
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSurveys = async () => {
    try {
      const [qRes, rRes] = await Promise.all([
        api.getQuestionnaires(false),
        api.getPatientResponses('me'),
      ]);
      setQuestionnaires(qRes.questionnaires || []);
      setResponses(rRes.responses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, []);

  const handleStartSurvey = (q) => {
    setActiveSurvey(q);
    setAnswers({});
  };

  const handleOptionSelect = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeSurvey) return;

    // Verify all answered
    const unanswered = activeSurvey.questions.some((q) => !answers[q.id]);
    if (unanswered) {
      alert('Mohon jawab seluruh pertanyaan sebelum mengirim.');
      return;
    }

    setSubmitting(true);
    try {
      await api.submitQuestionnaire(activeSurvey.id, answers);
      alert('Terima kasih! Kuesioner berhasil dikirim.');
      setActiveSurvey(null);
      await loadSurveys();
    } catch (err) {
      alert(err.message || 'Gagal mengirim kuesioner');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {t.patient.surveysTitle}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t.patient.surveysSubtitle}
        </p>
      </div>

      {/* Active Survey Taking Modal / Card */}
      {activeSurvey ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-teal-300 shadow-md space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wider">
              {activeSurvey.code}
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-2">
              {lang === 'en' ? activeSurvey.titleEn : activeSurvey.titleId}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {lang === 'en' ? activeSurvey.descriptionEn : activeSurvey.descriptionId}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {activeSurvey.questions.map((q, idx) => {
              const qText = lang === 'en' ? q.textEn : q.textId;
              const selectedValue = answers[q.id];

              return (
                <div key={q.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-semibold text-slate-900 pt-0.5">
                      {qText}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                    {q.options.map((opt) => {
                      const optText = lang === 'en' ? opt.textEn : opt.textId;
                      const isSelected = selectedValue === opt.value;

                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleOptionSelect(q.id, opt.value)}
                          className={`p-3 rounded-xl text-xs font-semibold text-left border transition ${
                            isSelected
                              ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {optText}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveSurvey(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {submitting ? t.common.loading : t.common.submit}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Questionnaires List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questionnaires.map((q) => {
              const completedCount = responses.filter((r) => r.questionnaireId === q.id).length;
              const title = lang === 'en' ? q.titleEn : q.titleId;
              const desc = lang === 'en' ? q.descriptionEn : q.descriptionId;

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-teal-300 transition"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase">
                        {q.code}
                      </span>
                      {completedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          {completedCount}x {t.patient.completedSurvey}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 text-base leading-snug">
                      {title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {desc}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {q.questions.length} Pertanyaan
                    </span>
                    <button
                      onClick={() => handleStartSurvey(q)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    >
                      <span>{t.patient.takeSurvey}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Past Submissions */}
          {responses.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-600" />
                Riwayat Pengisian Kuesioner
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                {responses.map((resp) => (
                  <div key={resp.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800">
                        {resp.questionnaire?.titleId || resp.questionnaire?.code}
                      </span>
                      <span className="text-slate-400 block text-[11px]">
                        {new Date(resp.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {resp.score !== null && (
                      <span className="font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                        Skor: {resp.score}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
