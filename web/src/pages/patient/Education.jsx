import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search, ArrowRight, Tag } from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function PatientEducation() {
  const { t, lang } = useLanguage();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getArticles({ category: selectedCategory, q: searchQuery })
      .then((res) => {
        setArticles(res.articles || []);
        if (res.categories) setCategories(res.categories);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedCategory, searchQuery]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {t.patient.educationTitle}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t.patient.educationSubtitle}
        </p>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari obat, efek samping, atau topik edukasi..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedCategory === ''
                ? 'bg-teal-700 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.patient.allCategories}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedCategory === cat
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-500">
          <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
          {t.common.loading}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium">Tidak ada artikel yang sesuai pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((art) => {
            const title = lang === 'en' ? art.titleEn || art.titleId : art.titleId;
            const summary = lang === 'en' ? art.summaryEn || art.summaryId : art.summaryId;

            return (
              <Link
                key={art.id}
                to={`/education/${art.slug || art.id}`}
                className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-teal-300 hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                      <Tag className="w-3 h-3" />
                      {art.category}
                    </span>
                    {art.drugName && (
                      <span className="text-[11px] font-medium text-slate-500">
                        • {art.drugName}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition leading-snug">
                    {title}
                  </h3>
                  {summary && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                      {summary}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-teal-700 group-hover:text-teal-800">
                  <span>{t.patient.readMore}</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
