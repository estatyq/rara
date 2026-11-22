import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PlayCircle, Search, ArrowRight, Clock, Pill, X } from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function PatientEducation() {
  const { t, lang } = useLanguage();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [mediaTab, setMediaTab] = useState('ARTICLE'); // ARTICLE | VIDEO
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [activeVideo, setActiveVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = { mediaType: mediaTab };
    if (selectedCategory) params.category = selectedCategory;
    if (search.trim()) params.q = search.trim();

    api.getArticles(params)
      .then((res) => {
        setArticles(res.articles || []);
        if (res.categories?.length) setCategories(res.categories);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [mediaTab, selectedCategory, search]);

  const categoryLabels = {
    'Medication Information': { id: 'Informasi Obat', en: 'Medication Info' },
    'Disease Education': { id: 'Edukasi Penyakit', en: 'Disease Education' },
    'Medication Use': { id: 'Cara Pakai Obat', en: 'Medication Use' },
    'Side Effects & Safety': { id: 'Efek Samping & Keamanan', en: 'Side Effects & Safety' },
    'Curated Materials': { id: 'Materi Kurasi', en: 'Curated Materials' },
  };

  const catLabel = (cat) => categoryLabels[cat]?.[lang] || cat;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.patient.educationTitle}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t.patient.educationSubtitle}</p>
      </div>

      {/* Article / Video Segmented Tabs matching DoseLynx Screen 5 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-teal-100 pb-4">
        <div className="inline-flex bg-white p-1 rounded-2xl border border-teal-100 shadow-xs self-start">
          <button
            type="button"
            onClick={() => setMediaTab('ARTICLE')}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold transition ${
              mediaTab === 'ARTICLE'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-teal-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{t.patient.tabArticles}</span>
          </button>
          <button
            type="button"
            onClick={() => setMediaTab('VIDEO')}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold transition ${
              mediaTab === 'VIDEO'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-teal-800'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>{t.patient.tabVideos}</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.common.search}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-teal-100 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Category Pills covering Section E pillars */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory('')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
            selectedCategory === ''
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-slate-600 border-teal-100 hover:bg-teal-50'
          }`}
        >
          {t.patient.allCategories}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
              selectedCategory === cat
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-slate-600 border-teal-100 hover:bg-teal-50'
            }`}
          >
            {catLabel(cat)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500">
          <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
          {t.common.loading}
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-teal-100 text-slate-400 text-sm">
          {lang === 'id' ? 'Materi tidak ditemukan.' : 'No educational materials found.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((art) => {
            const title = lang === 'en' ? art.titleEn : art.titleId;
            const summary = lang === 'en' ? art.summaryEn : art.summaryId;
            const cover = art.coverImage || (art.drugName ? '/images/edu-medications.jpg' : '/images/edu-bp-monitor.svg');
            const isVideo = art.mediaType === 'VIDEO';

            return (
              <div
                key={art.id}
                className="bg-white rounded-3xl border border-teal-100/80 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-teal-300 transition group"
              >
                <div className="relative h-40 bg-teal-50 overflow-hidden">
                  <img
                    src={cover}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  {isVideo && (
                    <button
                      type="button"
                      onClick={() => setActiveVideo(art)}
                      className="absolute inset-0 bg-slate-900/30 flex items-center justify-center group-hover:bg-slate-900/40 transition"
                      aria-label={t.patient.watchVideo}
                    >
                      <div className="w-12 h-12 rounded-full bg-white/95 text-teal-700 flex items-center justify-center shadow-lg">
                        <PlayCircle className="w-7 h-7" />
                      </div>
                    </button>
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-full bg-white/95 text-teal-800 text-[10px] font-extrabold shadow-xs">
                      {catLabel(art.category)}
                    </span>
                  </div>
                  {art.durationLabel && (
                    <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-lg bg-slate-900/75 text-white text-[10px] font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {art.durationLabel}
                    </span>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  {art.drugName && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full self-start mb-2">
                      <Pill className="w-3 h-3" />
                      {art.drugName}
                    </span>
                  )}
                  <h3 className="font-extrabold text-slate-900 text-sm leading-snug line-clamp-2">
                    {title}
                  </h3>
                  {summary && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 flex-1 leading-relaxed">
                      {summary}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    {isVideo ? (
                      <button
                        type="button"
                        onClick={() => setActiveVideo(art)}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-teal-700 hover:text-teal-900"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>{t.patient.watchVideo}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <Link
                        to={`/education/${art.slug}`}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-teal-700 hover:text-teal-900"
                      >
                        <span>{t.patient.readMore}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video Guide Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-teal-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700">
                  {catLabel(activeVideo.category)} • {activeVideo.durationLabel || 'Video'}
                </span>
                <h3 className="font-extrabold text-slate-900 text-base truncate">
                  {lang === 'en' ? activeVideo.titleEn : activeVideo.titleId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
                <img
                  src={activeVideo.coverImage || '/images/edu-bp-monitor.svg'}
                  alt=""
                  className="w-full h-full object-cover opacity-50"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-teal-500/90 flex items-center justify-center shadow-lg mb-3">
                    <PlayCircle className="w-9 h-9" />
                  </div>
                  <p className="text-sm font-bold max-w-md">
                    {lang === 'en' ? activeVideo.summaryEn : activeVideo.summaryId}
                  </p>
                  <Link
                    to={`/education/${activeVideo.slug}`}
                    onClick={() => setActiveVideo(null)}
                    className="mt-4 px-5 py-2 rounded-full bg-white text-teal-800 text-xs font-extrabold hover:bg-teal-50 transition"
                  >
                    {lang === 'id' ? 'Baca Ringkasan Lengkap Materi' : 'Open Full Lesson Summary'}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
