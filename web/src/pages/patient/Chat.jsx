import { useState, useEffect, useRef } from 'react';
import { Send, UserCheck, ShieldCheck, CheckCheck, Clock } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSocket } from '../../context/SocketContext';

export default function PatientChat() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket } = useSocket();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    api.getMessages('me', 100)
      .then((res) => {
        setMessages(res.messages || []);
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
      setMessages((prev) => [...prev, msg]);
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
      setMessages((prev) => [...prev, res.message]);
    } catch (err) {
      alert(err.message || 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (socket) {
      socket.emit('typing', {});
    }
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 pb-20 h-[calc(100vh-5rem)] flex flex-col">
      {/* Pharmacist Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between shrink-0 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base leading-tight">
              Tim Farmasi & Apoteker Klinis
            </h2>
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Siap melayani konsultasi obat & efek samping
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-100/70 rounded-2xl border border-slate-200/80 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <UserCheck className="w-12 h-12 mx-auto text-teal-400 mb-2 stroke-1" />
            <p className="text-sm font-medium text-slate-600">
              Belum ada percakapan.
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Tulis pertanyaan Anda kepada apoteker mengenai aturan minum, gejala sampingan, atau interaksi obat.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user.id;
            const timeStr = new Intl.DateTimeFormat('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(new Date(msg.createdAt));

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <span className="text-[11px] font-semibold text-teal-800 ml-1 mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-teal-600" />
                    {msg.sender?.name || 'Apoteker'}
                  </span>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-teal-600 text-white rounded-br-none'
                      : 'bg-white text-slate-900 rounded-bl-none border border-slate-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <div
                    className={`flex items-center justify-end space-x-1 text-[10px] mt-1 ${
                      isMe ? 'text-teal-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{timeStr}</span>
                    {isMe && (
                      <CheckCheck className={`w-3.5 h-3.5 ${msg.readAt ? 'text-teal-100' : 'text-teal-300'}`} />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingUser && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 italic py-1">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
            <span>{typingUser} sedang mengetik...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="mt-3 flex items-center space-x-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder={t.patient.typeMessage}
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          className="p-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
