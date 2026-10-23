import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Tag, Calendar, UserCheck } from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function ArticleDetail() {
  const { slug } = useParams();
  const { lang, t } = useLanguage();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getArticle(slug)
      .then((res) => setArticle(res.article))
      .catch((err) => setError(err.message || 'Gagal memuat artikel'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-rose-600 font-semibold mb-4">{error || 'Artikel tidak ditemukan'}</p>
        <Link to="/education" className="text-teal-600 font-semibold hover:underline">
          ← {t.common.back}
        </Link>
      </div>
    );
  }

  const title = lang === 'en' ? article.titleEn || article.titleId : article.titleId;
  const body = lang === 'en' ? article.bodyEn || article.bodyId : article.bodyId;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
      <Link
        to="/education"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t.common.back}</span>
      </Link>

      <article className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              <Tag className="w-3.5 h-3.5" />
              {article.category}
            </span>
            {article.drugName && (
              <span className="text-xs font-semibold text-slate-600">
                Obat: {article.drugName}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
            {title}
          </h1>

          <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <UserCheck className="w-4 h-4 text-teal-600" />
              Ditinjau oleh Tim Farmasi
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(article.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Formatted Article Body */}
        <div className="prose prose-teal max-w-none text-slate-800 text-sm leading-relaxed space-y-4 pt-4 border-t border-slate-100">
          {body.split('\n\n').map((paragraph, i) => {
            if (paragraph.startsWith('### ')) {
              return (
                <h3 key={i} className="text-base font-bold text-slate-900 mt-6 mb-2">
                  {paragraph.replace('### ', '')}
                </h3>
              );
            }
            if (paragraph.startsWith('- ')) {
              const items = paragraph.split('\n- ');
              return (
                <ul key={i} className="list-disc list-inside space-y-1.5 text-slate-700 my-2">
                  {items.map((item, j) => (
                    <li key={j}>{item.replace(/^- /, '')}</li>
                  ))}
                </ul>
              );
            }
            return <p key={i}>{paragraph}</p>;
          })}
        </div>

        {/* Need Help Box */}
        <div className="mt-8 p-5 bg-teal-50 rounded-2xl border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-teal-900">
              Ada pertanyaan seputar obat ini?
            </h4>
            <p className="text-xs text-teal-700 mt-0.5">
              Konsultasikan dosis, keluhan lambung, atau interaksi obat langsung dengan apoteker.
            </p>
          </div>
          <Link
            to="/chat"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-sm transition whitespace-nowrap self-start sm:self-center"
          >
            Tanya Apoteker
          </Link>
        </div>
      </article>
    </div>
  );
}
