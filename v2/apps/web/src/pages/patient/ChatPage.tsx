import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, ShieldCheck, UserCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export default function ChatPage() {
  const { t, i18n } = useTranslation(['patient', 'nav', 'common']);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'id-ID';

  const { data } = useQuery({
    queryKey: ['messages', 'me'],
    queryFn: () => api.getMessages('me'),
    refetchInterval: 8000,
  });

  const sendMut = useMutation({
    mutationFn: (body: string) => api.sendMessage('me', body),
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({ queryKey: ['messages', 'me'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pharmacist = user?.enrollments?.[0]?.pharmacist;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMut.mutate(text.trim());
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 h-[calc(100vh-6rem)] flex flex-col">
      <div className="bg-white p-4 rounded-3xl border border-teal-100 shadow-sm flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0">
          <UserCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-extrabold text-slate-900 text-base">{t('nav:chat')}</h1>
          <p className="text-xs text-emerald-600 font-medium">{pharmacist?.name || 'DoseMate Clinical Pharmacy'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-white/90 rounded-3xl border border-teal-100 space-y-3">
        {(data?.messages ?? []).map((m) => {
          const isMe = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && (
                <span className="text-[11px] font-bold text-teal-800 ml-1 mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-teal-600" />
                  {m.sender.name}
                </span>
              )}
              <div
                className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe ? 'bg-teal-600 text-white rounded-br-md' : 'bg-[#F1F6F8] text-slate-800 border border-slate-200/60 rounded-bl-md'
                }`}
              >
                {m.body}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {new Intl.DateTimeFormat(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(m.createdAt))}
              </span>
            </div>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('patient:typeMessage')}
          className="flex-1 px-4 py-3 bg-white border border-teal-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="submit"
          disabled={sendMut.isPending || !text.trim()}
          className="w-11 h-11 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-sm disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {pharmacist && (
        <p className="text-[11px] text-center text-slate-500 mt-2 flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>{t('patient:connectedWith')} <strong>{pharmacist.name}</strong></span>
        </p>
      )}
    </div>
  );
}
