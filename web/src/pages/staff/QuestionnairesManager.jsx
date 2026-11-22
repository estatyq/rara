import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Users, Eye, Plus, Edit3, Trash2, CheckCircle2,
  XCircle, FileQuestion, Award, Lock, X
} from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

const emptyOption = (idx = 1) => ({
  value: `opt_${idx}`,
  textId: '',
  textEn: '',
  score: 0,
});

const emptyQuestion = (idx = 1) => ({
  id: `q${idx}`,
  textId: '',
  textEn: '',
  options: [
    { value: 'yes', textId: 'Ya', textEn: 'Yes', score: 1 },
    { value: 'no', textId: 'Tidak', textEn: 'No', score: 0 },
  ],
});

export default function StaffQuestionnairesManager() {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const dateLocale = isEn ? 'en-US' : 'id-ID';

  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(true);

  // Responses modal
  const [selectedQ, setSelectedQ] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  // Preview questions modal
  const [previewQ, setPreviewQ] = useState(null);

  // Create / Edit modal
  const [showEditor, setShowEditor] = useState(false);
  const [editingQ, setEditingQ] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    titleId: '',
    titleEn: '',
    descriptionId: '',
    descriptionEn: '',
    active: true,
    questions: [emptyQuestion(1)],
  });

  const loadQuestionnaires = useCallback(async () => {
    try {
      const res = await api.getQuestionnaires(true);
      setQuestionnaires(res.questionnaires || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestionnaires();
  }, [loadQuestionnaires]);

  const handleViewResponses = async (q) => {
    setSelectedQ(q);
    setLoadingResponses(true);
    try {
      const res = await api.getQuestionnaireResponses(q.id);
      setResponses(res.responses || []);
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to load responses' : 'Gagal memuat jawaban'));
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleToggleActive = async (q) => {
    try {
      await api.updateQuestionnaire(q.id, { active: !q.active });
      await loadQuestionnaires();
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to update status' : 'Gagal mengubah status'));
    }
  };

  const openCreateModal = () => {
    setEditingQ(null);
    setForm({
      code: '',
      titleId: '',
      titleEn: '',
      descriptionId: '',
      descriptionEn: '',
      active: true,
      questions: [emptyQuestion(1)],
    });
    setShowEditor(true);
  };

  const openEditModal = (q) => {
    setEditingQ(q);
    setForm({
      code: q.code || '',
      titleId: q.titleId || '',
      titleEn: q.titleEn || '',
      descriptionId: q.descriptionId || '',
      descriptionEn: q.descriptionEn || '',
      active: q.active ?? true,
      questions: (q.questions || []).map((item, idx) => ({
        id: item.id || `q${idx + 1}`,
        textId: item.textId || '',
        textEn: item.textEn || '',
        options: (item.options || []).map((o, oIdx) => ({
          value: o.value || `opt_${oIdx + 1}`,
          textId: o.textId || '',
          textEn: o.textEn || '',
          score: Number.isFinite(Number(o.score)) ? Number(o.score) : 0,
        })),
      })),
    });
    setShowEditor(true);
  };

  const addQuestion = () => {
    setForm((prev) => {
      const used = new Set(prev.questions.map((q) => q.id));
      let nextNum = prev.questions.length + 1;
      while (used.has(`q${nextNum}`)) nextNum += 1;
      return {
        ...prev,
        questions: [...prev.questions, emptyQuestion(nextNum)],
      };
    });
  };

  const removeQuestion = (qIdx) => {
    setForm((prev) => {
      if (prev.questions.length <= 1) return prev;
      return {
        ...prev,
        questions: prev.questions.filter((_, i) => i !== qIdx),
      };
    });
  };

  const updateQuestionField = (qIdx, field, value) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === qIdx ? { ...q, [field]: value } : q)),
    }));
  };

  const addOption = (qIdx) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const used = new Set(q.options.map((o) => o.value));
        let n = q.options.length + 1;
        while (used.has(`opt_${n}`)) n += 1;
        return { ...q, options: [...q.options, emptyOption(n)] };
      }),
    }));
  };

  const removeOption = (qIdx, oIdx) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIdx || q.options.length <= 2) return q;
        return { ...q, options: q.options.filter((_, j) => j !== oIdx) };
      }),
    }));
  };

  const updateOptionField = (qIdx, oIdx, field, value) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          options: q.options.map((o, j) => (j === oIdx ? { ...o, [field]: value } : o)),
        };
      }),
    }));
  };

  const handleSaveQuestionnaire = async (e) => {
    e.preventDefault();
    const hasResponses = (editingQ?._count?.responses || 0) > 0;

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        titleId: form.titleId.trim(),
        titleEn: form.titleEn.trim(),
        descriptionId: form.descriptionId.trim() || null,
        descriptionEn: form.descriptionEn.trim() || null,
        active: form.active,
      };

      if (!editingQ || !hasResponses) {
        payload.questions = form.questions.map((q) => ({
          id: q.id.trim(),
          textId: q.textId.trim(),
          textEn: q.textEn.trim(),
          options: q.options.map((o) => ({
            value: o.value.trim(),
            textId: o.textId.trim(),
            textEn: o.textEn.trim(),
            score: Math.trunc(Number(o.score) || 0),
          })),
        }));
      }

      if (editingQ) {
        await api.updateQuestionnaire(editingQ.id, payload);
      } else {
        await api.createQuestionnaire(payload);
      }

      setShowEditor(false);
      await loadQuestionnaires();
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to save questionnaire' : 'Gagal menyimpan kuesioner'));
    } finally {
      setSaving(false);
    }
  };

  const formatPoints = (score) => {
    const num = Number(score) || 0;
    const unit = isEn ? 'pts' : 'poin';
    return num > 0 ? `+${num} ${unit}` : `${num} ${unit}`;
  };

  const questionsLocked = Boolean(editingQ && (editingQ._count?.responses || 0) > 0);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.staff.questionnaires}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEn
              ? 'Adherence instruments, patient literacy surveys, and scoreable clinical questionnaires.'
              : 'Instrumen kuesioner kepatuhan, survei literasi obat, dan evaluasi klinis pasien.'}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>{isEn ? 'New Questionnaire' : 'Buat Kuesioner'}</span>
        </button>
      </div>

      {questionnaires.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-400">
          <ClipboardList className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium">
            {isEn ? 'No questionnaires available yet.' : 'Belum ada kuesioner tersedia.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {questionnaires.map((q) => {
            const respCount = q._count?.responses || 0;
            const title = isEn ? (q.titleEn || q.titleId) : (q.titleId || q.titleEn);
            const desc = isEn ? (q.descriptionEn || q.descriptionId) : (q.descriptionId || q.descriptionEn);

            return (
              <div
                key={q.id}
                className={`bg-white rounded-2xl p-6 border shadow-sm flex flex-col justify-between transition ${
                  q.active ? 'border-slate-200 hover:border-teal-300' : 'border-slate-200 opacity-75 bg-slate-50/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase">
                        {q.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(q)}
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
                          q.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                        title={isEn ? 'Click to toggle active status' : 'Klik untuk ubah status aktif'}
                      >
                        {q.active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{q.active ? (isEn ? 'Active' : 'Aktif') : (isEn ? 'Inactive' : 'Nonaktif')}</span>
                      </button>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold flex items-center gap-1 shrink-0">
                      <Users className="w-3.5 h-3.5" />
                      {respCount} {isEn ? 'Respondents' : 'Responden'}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-lg leading-snug">{title}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <ClipboardList className="w-4 h-4 text-teal-600" />
                    <span>
                      {q.questions.length} {isEn ? 'Questions' : 'Butir Pertanyaan'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewQ(q)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition"
                    >
                      <FileQuestion className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Preview Questions' : 'Lihat Pertanyaan'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(q)}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{t.common.edit}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleViewResponses(q)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{isEn ? 'View Responses' : 'Lihat Jawaban Partisipan'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Questions Modal */}
      {previewQ && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full uppercase">
                    {previewQ.code}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    previewQ.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {previewQ.active ? (isEn ? 'Active' : 'Aktif') : (isEn ? 'Inactive' : 'Nonaktif')}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                  {isEn ? (previewQ.titleEn || previewQ.titleId) : (previewQ.titleId || previewQ.titleEn)}
                </h3>
                {(previewQ.descriptionEn || previewQ.descriptionId) && (
                  <p className="text-xs text-slate-500 mt-1">
                    {isEn
                      ? (previewQ.descriptionEn || previewQ.descriptionId)
                      : (previewQ.descriptionId || previewQ.descriptionEn)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewQ(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                aria-label={t.common.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {(previewQ.questions || []).map((q, idx) => (
                <div key={q.id || idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        {isEn ? (q.textEn || q.textId) : (q.textId || q.textEn)}
                      </p>
                      <span className="text-[10px] font-mono text-slate-400">ID: {q.id}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                    {(q.options || []).map((opt) => (
                      <div
                        key={opt.value}
                        className="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs"
                      >
                        <span className="font-medium text-slate-800">
                          {isEn ? (opt.textEn || opt.textId) : (opt.textId || opt.textEn)}
                        </span>
                        <span className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] shrink-0 ${
                          (opt.score ?? 0) > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {formatPoints(opt.score)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const target = previewQ;
                  setPreviewQ(null);
                  openEditModal(target);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{t.common.edit}</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewQ(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participant Responses Modal */}
      {selectedQ && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-teal-700 uppercase">{selectedQ.code}</span>
                <h3 className="text-lg font-bold text-slate-900">
                  {isEn ? (selectedQ.titleEn || selectedQ.titleId) : (selectedQ.titleId || selectedQ.titleEn)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQ(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                {t.common.close}
              </button>
            </div>

            {loadingResponses ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                {isEn ? 'Loading responses...' : 'Memuat jawaban...'}
              </div>
            ) : responses.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">
                {isEn ? 'No responses submitted for this questionnaire yet.' : 'Belum ada tanggapan untuk kuesioner ini.'}
              </p>
            ) : (
              <div className="space-y-4">
                {responses.map((r) => (
                  <div key={r.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{r.patient?.user?.name}</span>
                          <span className="font-mono text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                            {r.patient?.studyCode || 'P-???'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(r.createdAt).toLocaleString(dateLocale)}
                        </span>
                      </div>
                      {r.score !== null && (
                        <span className="inline-flex items-center gap-1 font-bold text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                          <Award className="w-3.5 h-3.5" />
                          {isEn ? 'Score:' : 'Skor:'} {r.score}
                        </span>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                      {(selectedQ.questions || []).map((q, idx) => {
                        const rawAnswer = r.answers?.[q.id];
                        const matchedOpt = (q.options || []).find((o) => o.value === rawAnswer);
                        const qLabel = isEn ? (q.textEn || q.textId) : (q.textId || q.textEn);
                        const answerLabel = matchedOpt
                          ? (isEn ? (matchedOpt.textEn || matchedOpt.textId) : (matchedOpt.textId || matchedOpt.textEn))
                          : (rawAnswer ?? '—');

                        return (
                          <div key={q.id || idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <p className="text-slate-700 font-medium">
                              <span className="font-bold text-teal-700 mr-1.5">{idx + 1}.</span>
                              {qLabel}
                            </p>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-900 font-semibold border border-teal-100">
                                {String(answerLabel)}
                              </span>
                              {matchedOpt && (
                                <span className="font-mono text-[11px] font-bold text-slate-500">
                                  {formatPoints(matchedOpt.score)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Questionnaire Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xl font-extrabold text-slate-900">
                {editingQ
                  ? (isEn ? 'Edit Questionnaire' : 'Ubah Kuesioner')
                  : (isEn ? 'Create New Questionnaire' : 'Buat Kuesioner Baru')}
              </h2>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                aria-label={t.common.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestionnaire} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Questionnaire Code *' : 'Kode Kuesioner *'}
                  </label>
                  <input
                    type="text"
                    required
                    pattern="[A-Za-z0-9_-]+"
                    maxLength={50}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="ADHERENCE-CUSTOM"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>
                      {isEn ? 'Active (visible to patients)' : 'Aktif (ditampilkan ke pasien)'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Title (Indonesian) *' : 'Judul (Bahasa Indonesia) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.titleId}
                    onChange={(e) => setForm({ ...form, titleId: e.target.value })}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Title (English) *' : 'Judul (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.titleEn}
                    onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Description (Indonesian)' : 'Deskripsi (Bahasa Indonesia)'}
                  </label>
                  <textarea
                    rows={2}
                    value={form.descriptionId}
                    onChange={(e) => setForm({ ...form, descriptionId: e.target.value })}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Description (English)' : 'Deskripsi (English)'}
                  </label>
                  <textarea
                    rows={2}
                    value={form.descriptionEn}
                    onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {questionsLocked ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block">
                      {isEn
                        ? 'Questions are locked because responses have already been collected'
                        : 'Pertanyaan terkunci karena sudah memiliki jawaban pasien'}
                    </strong>
                    <p className="mt-0.5 text-amber-800">
                      {isEn
                        ? 'You can still update the title, description, code, or active status. To change questions, create a new questionnaire.'
                        : 'Anda tetap dapat mengubah judul, deskripsi, kode, atau status aktif. Untuk mengubah daftar pertanyaan, buat kuesioner baru.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {isEn ? `Questions (${form.questions.length})` : `Daftar Pertanyaan (${form.questions.length})`}
                    </h3>
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Add Question' : 'Tambah Pertanyaan'}</span>
                    </button>
                  </div>

                  {form.questions.map((q, qIdx) => (
                    <div key={qIdx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
                            {qIdx + 1}
                          </span>
                          <input
                            type="text"
                            required
                            value={q.id}
                            onChange={(e) => updateQuestionField(qIdx, 'id', e.target.value)}
                            placeholder="q1"
                            className="w-24 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                        {form.questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuestion(qIdx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            title={t.common.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          value={q.textId}
                          onChange={(e) => updateQuestionField(qIdx, 'textId', e.target.value)}
                          placeholder={isEn ? 'Question text (Indonesian) *' : 'Pertanyaan (Bahasa Indonesia) *'}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                        />
                        <input
                          type="text"
                          required
                          value={q.textEn}
                          onChange={(e) => updateQuestionField(qIdx, 'textEn', e.target.value)}
                          placeholder={isEn ? 'Question text (English) *' : 'Pertanyaan (English) *'}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                        />
                      </div>

                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase text-slate-500">
                            {isEn ? 'Answer Options & Scores' : 'Pilihan Jawaban & Skor'}
                          </span>
                          <button
                            type="button"
                            onClick={() => addOption(qIdx)}
                            className="text-[11px] font-bold text-teal-700 hover:underline"
                          >
                            + {isEn ? 'Add Option' : 'Tambah Opsi'}
                          </button>
                        </div>

                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="grid grid-cols-12 gap-1.5 items-center">
                            <input
                              type="text"
                              required
                              value={opt.value}
                              onChange={(e) => updateOptionField(qIdx, oIdx, 'value', e.target.value)}
                              placeholder="value"
                              className="col-span-2 p-2 bg-white border border-slate-200 rounded-lg text-[11px] font-mono"
                            />
                            <input
                              type="text"
                              required
                              value={opt.textId}
                              onChange={(e) => updateOptionField(qIdx, oIdx, 'textId', e.target.value)}
                              placeholder="Label ID *"
                              className="col-span-4 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                            <input
                              type="text"
                              required
                              value={opt.textEn}
                              onChange={(e) => updateOptionField(qIdx, oIdx, 'textEn', e.target.value)}
                              placeholder="Label EN *"
                              className="col-span-3 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                            <input
                              type="number"
                              required
                              value={opt.score}
                              onChange={(e) => updateOptionField(qIdx, oIdx, 'score', e.target.value)}
                              placeholder="0"
                              title={isEn ? 'Score' : 'Skor'}
                              className="col-span-2 p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center"
                            />
                            <div className="col-span-1 flex justify-end">
                              {q.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeOption(qIdx, oIdx)}
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                  title={t.common.delete}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? t.common.saving : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
