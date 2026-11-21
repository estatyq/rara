import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Clock, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

export default function EducationPage() {
  const { t, i18n } = useTranslation(['patient', 'nav', 'common']);
  const [mediaType, setMediaType] = useState<'ARTICLE' | 'VIDEO'>('ARTICLE');
  const locale = i18n.language === 'en' ? 'en' : 'id';

  const { data, isLoading } = useQuery({
    queryKey: ['education', locale, mediaType],
    queryFn: () => api.getEducation({ locale, mediaType }),
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('nav:education')}</h1>
        <div className="inline-flex bg-white p-1 rounded-2xl border border-teal-100 self-start">
          <button
            type="button"
            onClick={() => setMediaType('ARTICLE')}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold transition ${
              mediaType === 'ARTICLE' ? 'bg-teal-600 text-white' : 'text-slate-600'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {t('patient:tabArticles')}
          </button>
          <button
            type="button"
            onClick={() => setMediaType('VIDEO')}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold transition ${
              mediaType === 'VIDEO' ? 'bg-teal-600 text-white' : 'text-slate-600'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            {t('patient:tabVideos')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">{t('common:loading')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(data?.articles ?? []).map((art) => (
            <div key={art.id} className="bg-white rounded-3xl border border-teal-100 shadow-sm overflow-hidden flex flex-col">
              <div className="relative h-40 bg-teal-50">
                <img src={art.coverImage || '/images/edu-hypertension.jpg'} alt={art.title} className="w-full h-full object-cover" />
                {art.durationLabel && (
                  <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-lg bg-slate-900/75 text-white text-[10px] font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {art.durationLabel}
                  </span>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700">{art.category}</span>
                <h3 className="font-extrabold text-slate-900 text-sm mt-1">{art.title}</h3>
                {art.summary && <p className="text-xs text-slate-500 mt-2 flex-1">{art.summary}</p>}
                <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-extrabold text-teal-700 flex items-center gap-1">
                  <span>{mediaType === 'VIDEO' ? t('patient:watchVideo') : t('patient:readMore')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
