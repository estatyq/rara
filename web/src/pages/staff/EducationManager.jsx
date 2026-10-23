import { useState, useEffect } from 'react';
import { BookOpen, Plus, Edit, Trash2, CheckCircle2, XCircle, Tag, Eye } from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function StaffEducationManager() {
  const { t, lang } = useLanguage();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingArticle, setEditingArticle] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    slug: '',
    category: '',
    drugName: '',
    titleId: '',
    titleEn: '',
    summaryId: '',
    summaryEn: '',
    bodyId: '',
    bodyEn: '',
    published: true,
  });

  const loadArticles = async () => {
    try {
      const res = await api.getArticles({ all: '1' });
      setArticles(res.articles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const handleOpenAdd = () => {
    setEditingArticle(null);
    setForm({
      slug: '', category: '', drugName: '', titleId: '', titleEn: '',
      summaryId: '', summaryEn: '', bodyId: '', bodyEn: '', published: true,
    });
    setShowModal(true);
  };

  const handleOpenEdit = async (art) => {
    try {
      const res = await api.getArticle(art.id);
      const a = res.article;
      setEditingArticle(a);
      setForm({
        slug: a.slug,
        category: a.category,
        drugName: a.drugName || '',
        titleId: a.titleId,
        titleEn: a.titleEn,
        summaryId: a.summaryId || '',
        summaryEn: a.summaryEn || '',
        bodyId: a.bodyId,
        bodyEn: a.bodyEn,
        published: a.published,
      });
      setShowModal(true);
    } catch (err) {
      alert(err.message || 'Gagal memuat artikel');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingArticle) {
        await api.updateArticle(editingArticle.id, form);
      } else {
        await api.createArticle(form);
      }
      setShowModal(false);
      await loadArticles();
    } catch (err) {
      alert(err.message || 'Gagal menyimpan artikel');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus artikel edukasi ini?')) return;
    try {
      await api.deleteArticle(id);
      await loadArticles();
    } catch (err) {
      alert(err.message || 'Gagal menghapus');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.staff.manageArticles}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola materi edukasi obat dwibahasa (Bahasa Indonesia & English) untuk pasien.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>{t.staff.addArticle}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
            {t.common.loading}
          </div>
        ) : articles.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">Belum ada artikel edukasi.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {articles.map((art) => (
              <div key={art.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                      {art.category}
                    </span>
                    {art.drugName && (
                      <span className="text-xs text-slate-500 font-medium">
                        Obat: {art.drugName}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      art.published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {art.published ? 'Tayang' : 'Draf'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{art.titleId}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{art.summaryId}</p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(art)}
                    className="p-2 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                    title="Ubah"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(art.id)}
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-bold text-slate-900">
              {editingArticle ? 'Ubah Materi Edukasi' : 'Tulis Materi Edukasi Baru'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Slug URL (misal: amlodipin) *</label>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Kategori *</label>
                  <input
                    type="text"
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Antihipertensi"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Nama Obat (Opsional)</label>
                  <input
                    type="text"
                    value={form.drugName}
                    onChange={(e) => setForm({ ...form, drugName: e.target.value })}
                    placeholder="Amlodipine"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Judul (Bahasa Indonesia) *</label>
                <input
                  type="text"
                  required
                  value={form.titleId}
                  onChange={(e) => setForm({ ...form, titleId: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Judul (English) *</label>
                <input
                  type="text"
                  required
                  value={form.titleEn}
                  onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Ringkasan (Bahasa Indonesia)</label>
                <textarea
                  rows={2}
                  value={form.summaryId}
                  onChange={(e) => setForm({ ...form, summaryId: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Ringkasan (English)</label>
                <textarea
                  rows={2}
                  value={form.summaryEn}
                  onChange={(e) => setForm({ ...form, summaryEn: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Isi Artikel (Bahasa Indonesia) *</label>
                <textarea
                  rows={6}
                  required
                  value={form.bodyId}
                  onChange={(e) => setForm({ ...form, bodyId: e.target.value })}
                  placeholder="Gunakan ### untuk judul sub-bagian, - untuk daftar butir."
                  className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Isi Artikel (English) *</label>
                <textarea
                  rows={6}
                  required
                  value={form.bodyEn}
                  onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
                  placeholder="Use ### for headers, - for bullet items."
                  className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="published"
                  checked={form.published}
                  onChange={(e) => setForm({ ...form, published: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="published" className="text-xs font-semibold text-slate-700">
                  Publikasikan segera agar dapat dibaca pasien
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                >
                  Simpan Artikel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
