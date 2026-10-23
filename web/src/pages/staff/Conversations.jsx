import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ArrowRight, Clock, UserCheck } from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function StaffConversations() {
  const { t } = useLanguage();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getConversations()
      .then((res) => setConversations(res.conversations || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.staff.conversationsTitle}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Daftar seluruh pesan masuk dari pasien yang membutuhkan bimbingan atau informasi obat.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
            {t.common.loading}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">{t.staff.noConversations}</p>
          </div>
        ) : (
          conversations.map((c) => (
            <Link
              key={c.patientId}
              to={`/staff/patients/${c.patientId}`}
              className="p-5 flex items-center justify-between hover:bg-slate-50 transition group"
            >
              <div className="flex items-center space-x-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-lg shrink-0">
                  {c.patient?.user?.name?.charAt(0) || 'P'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-teal-700 transition">
                      {c.patient?.user?.name}
                    </span>
                    {c.patient?.studyCode && (
                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {c.patient.studyCode}
                      </span>
                    )}
                    {c.unread > 0 && (
                      <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">
                        {c.unread} baru
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate max-w-md mt-0.5">
                    {c.lastMessage?.body || 'Belum ada pesan'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0 ml-4">
                {c.lastMessage && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
