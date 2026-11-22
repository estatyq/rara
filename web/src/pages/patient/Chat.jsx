import { useState, useEffect, useRef } from 'react';
import { Send, UserCheck, ShieldCheck, CheckCheck, Clock, Phone } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSocket } from '../../context/SocketContext';

export default function PatientChat() {
  const { user } = useAuth();
  const { t, lang, dateLocale, localize } = useLanguage();
  const { socket } = useSocket();

  const [messages, setMessages] = useState([]);
  const [pharmacist, setPharmacist] = useState(null);
  const [waMeUrl, setWaMeUrl] = useState(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    Promise.all([
      api.getMessages('me', 100),
      api.getPatient('me').catch(() => ({ patient: null })),
    ])
      .then(([msgRes, pRes]) => {
        setMessages(msgRes.messages || []);
        const ph = pRes?.patient?.pharmacist || null;
        setPharmacist(ph);
        if (ph?.phone) {
          const digits = String(ph.phone).replace(/\D/g, '').replace(/^0/, '62');
          setWaMeUrl(`https://wa.me/${digits}`);
        }
        api.markMessagesRead('me').catch(() => {});
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      api.markMessagesRead('me').catch(() => {});
    };

    const handleTyping = (data) => {
      if (data.userId !== user.id) {
        setTypingUser(data.name);
        setTimeout(() => setTypingUser(null), 3000);
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing', handleTyping);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing', handleTyping);
    };
  }, [socket, user.id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await api.sendMessage('me', text);
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    } catch (err) {
      alert(err.message || (lang === 'id' ? 'Gagal mengirim pesan' : 'Failed to send message'));
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (socket) socket.emit('typing', {});
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 h-[calc(100vh-5.5rem)] flex flex-col">
      {/* Pharmacist Header matching DoseLynx Screen 6 */}
      <div className="bg-white p-4 rounded-3xl border border-teal-100 shadow-sm flex items-center justify-between gap-3 shrink-0 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
              {t.patient.chatGreeting}
            </h2>
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5 mt-0.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate">{t.patient.chatOnline}</span>
            </p>
          </div>
        </div>

        {waMeUrl && (
          <a
            href={waMeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold shrink-0 transition"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>
        )}
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 bg-white/80 rounded-3xl border border-teal-100/80 space-y-3 shadow-inner">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <UserCheck className="w-12 h-12 mx-auto text-teal-400 mb-2 stroke-1" />
            <p className="text-sm font-bold text-slate-600">{t.patient.chatEmptyTitle}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{t.patient.chatEmptyHint}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user.id;
            const timeStr = new Intl.DateTimeFormat(dateLocale, {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: user.timezone || 'Asia/Jakarta',
            }).format(new Date(msg.createdAt));

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <span className="text-[11px] font-bold text-teal-800 ml-1 mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-teal-600" />
                    {msg.sender?.name || (lang === 'id' ? 'Apoteker' : 'Pharmacist')}
                  </span>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-xs whitespace-pre-wrap ${
                    isMe
                      ? 'bg-teal-600 text-white rounded-br-md'
                      : 'bg-[#F1F6F8] text-slate-800 border border-slate-200/70 rounded-bl-md'
                  }`}
                >
                  {localize(msg.body)}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {timeStr}
                  {isMe && msg.readAt && <CheckCheck className="w-3 h-3 text-teal-600 ml-0.5" />}
                </span>
              </div>
            );
          })
        )}

        {typingUser && (
          <div className="text-xs text-teal-700 font-medium italic px-2">
            {typingUser} {lang === 'id' ? 'sedang mengetik...' : 'is typing...'}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer + Connected Pharmacist Footer (DoseLynx Screen 6) */}
      <form onSubmit={handleSend} className="mt-3 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder={t.patient.typeMessage}
          className="flex-1 px-4 py-3 bg-white border border-teal-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
        />
        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          className="w-11 h-11 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-sm transition disabled:opacity-50 shrink-0"
          aria-label={t.patient.send}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {pharmacist && (
        <p className="text-[11px] text-center text-slate-500 mt-2 flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>
            {t.patient.chatConnected}{' '}
            <strong className="text-slate-700">{pharmacist.name}</strong>
          </span>
        </p>
      )}
    </div>
  );
}
