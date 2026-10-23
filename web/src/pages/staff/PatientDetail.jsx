import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Pill, Clock, Plus, Trash2, MessageSquare, Save, CheckCircle2,
  AlertCircle, FileText, Send, CheckCheck, UserCheck, Stethoscope
} from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import AdherenceRing from '../../components/AdherenceRing';

export default function StaffPatientDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [patient, setPatient] = useState(null);
  const [medications, setMedications] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [doses, setDoses] = useState([]);
  const [messages, setMessages] = useState([]);
  const [responses, setResponses] = useState([]);
  const [articles, setArticles] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Notes state
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Chat reply state
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Add Medication Modal state
  const [showAddMed, setShowAddMed] = useState(false);
  const [medForm, setMedForm] = useState({
    name: '', dosage: '', form: '', instructions: '', times: '07:00', articleId: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [pRes, mRes, aRes, dRes, msgRes, rRes, artRes] = await Promise.all([
        api.getPatient(id),
        api.getMedications(id, true),
        api.getAdherence(id, 30),
        api.getDoses(id),
        api.getMessages(id, 50),
        api.getPatientResponses(id),
        api.getArticles(),
      ]);
      setPatient(pRes.patient);
      setNotes(pRes.patient?.notes || '');
      setMedications(mRes.medications || []);
      setAdherence(aRes);
      setDoses(dRes.doses || []);
      setMessages(msgRes.messages || []);
      setResponses(rRes.responses || []);
      setArticles(artRes.articles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time chat listener
  useEffect(() => {
    if (!socket) return;
    const handleMsg = (msg) => {
      if (msg.patientId === id) {
        setMessages((prev) => [...prev, msg]);
      }
    };
    socket.on('message:new', handleMsg);
    return () => socket.off('message:new', handleMsg);
  }, [socket, id]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.updatePatient(id, { notes });
      alert('Catatan intervensi klinis berhasil disimpan!');
    } catch (err) {
      alert(err.message || 'Gagal menyimpan catatan');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!medForm.name || !medForm.times) return;
    try {
      const timesArray = medForm.times.split(',').map((s) => s.trim()).filter(Boolean);
      await api.createMedication(id, {
        name: medForm.name,
        dosage: medForm.dosage || undefined,
        form: medForm.form || undefined,
        instructions: medForm.instructions || undefined,
        times: timesArray,
        articleId: medForm.articleId || undefined,
      });
      setShowAddMed(false);
      setMedForm({ name: '', dosage: '', form: '', instructions: '', times: '07:00', articleId: '' });
      await loadData();
    } catch (err) {
      alert(err.message || 'Gagal menambahkan obat');
    }
  };

  const handleDeleteMedication = async (medId) => {
    if (!window.confirm('Hentikan obat ini untuk pasien? Riwayat dosis tetap tersimpan untuk riset.')) return;
    try {
      await api.deleteMedication(medId);
      await loadData();
    } catch (err) {
      alert(err.message || 'Gagal menonaktifkan obat');
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || sendingMsg) return;
    const text = chatInput.trim();
    setChatInput('');
    setSendingMsg(true);
    try {
      const res = await api.sendMessage(id, text);
      setMessages((prev) => [...prev, res.message]);
    } catch (err) {
      alert(err.message || 'Gagal mengirim pesan');
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading || !patient) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Ringkasan Kepatuhan' },
    { id: 'medications', label: `Obat & Jadwal (${medications.filter((m) => m.active).length})` },
    { id: 'chat', label: `Konsultasi Chat (${messages.length})` },
    { id: 'notes', label: 'Catatan Apoteker' },
    { id: 'surveys', label: `Kuesioner (${responses.length})` },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link
        to="/staff"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Daftar Pasien</span>
      </Link>

      {/* Patient Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-sm">
            {patient.user.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">
                {patient.user.name}
              </h1>
              <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                {patient.studyCode || 'P-???'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>{patient.user.phone || patient.user.email}</span>
              <span>•</span>
              <span>Diagnosis: <strong>{patient.diagnosis || '—'}</strong></span>
            </p>
          </div>
        </div>

        {/* Adherence Rate */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="block text-2xl font-extrabold text-teal-600">
              {adherence?.rate !== null && adherence?.rate !== undefined ? `${Math.round(adherence.rate)}%` : '—'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Kepatuhan 30 Hari
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 sm:space-x-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <h3 className="font-bold text-slate-800 text-sm mb-4">
              Indikator Kepatuhan Obat (30 Hari)
            </h3>
            <AdherenceRing rate={adherence?.rate} size={150} strokeWidth={12} label="30 Hari" />
            {adherence?.avgDelayMinutes !== null && (
              <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
                Rata-rata deviasi jam minum obat:{' '}
                <strong className="text-slate-800">{adherence.avgDelayMinutes} menit</strong>
              </p>
            )}
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">
              Tingkat Kepatuhan per Obat
            </h3>
            {adherence?.byMedication?.length ? (
              <div className="space-y-3">
                {adherence.byMedication.map((m) => (
                  <div key={m.medicationId} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 text-sm">{m.name}</span>
                      <span className="text-xs text-slate-500 block">
                        Diminum: {m.TAKEN} | Lewat: {m.SKIPPED} | Lupa: {m.MISSED}
                      </span>
                    </div>
                    <span className="font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 text-xs">
                      {m.rate !== null ? `${Math.round(m.rate)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Belum ada riwayat konsumsi obat yang tercatat.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Medications */}
      {activeTab === 'medications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base">Regimen Resep Obat</h3>
            <button
              onClick={() => setShowAddMed(true)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Obat</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {medications.map((med) => (
              <div
                key={med.id}
                className={`p-5 rounded-2xl border transition ${
                  med.active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{med.name}</h4>
                    <span className="text-xs font-semibold text-teal-700">{med.dosage} • {med.form}</span>
                    {med.instructions && (
                      <p className="text-xs text-slate-600 mt-2">{med.instructions}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {med.times.map((t) => (
                        <span key={t} className="text-xs bg-slate-100 font-bold px-2 py-0.5 rounded text-slate-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  {med.active && (
                    <button
                      onClick={() => handleDeleteMedication(med.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Hentikan obat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Chat */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 h-[550px] flex flex-col">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-slate-50 rounded-xl">
            {messages.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs">Belum ada riwayat pesan.</p>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === user.id;
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-400 mb-0.5 px-1">{m.sender?.name}</span>
                    <div
                      className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                        isMe ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      <p>{m.body}</p>
                      <span className={`block text-[9px] mt-1 text-right ${isMe ? 'text-teal-200' : 'text-slate-400'}`}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSendChat} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ketik balasan atau instruksi apoteker..."
              className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || sendingMsg}
              className="p-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Pharmacist Notes */}
      {activeTab === 'notes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Catatan Intervensi & Konseling Farmasi (Privat Tim Peneliti)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Catatan ini hanya dapat dilihat oleh apoteker dan administrator, tidak ditampilkan kepada pasien.
            </p>
          </div>

          <textarea
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tulis riwayat konseling, penyesuaian jadwal obat, keluhan efek samping, atau catatan penting riset..."
            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-sans"
          />

          <button
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="flex items-center space-x-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingNotes ? t.common.loading : t.common.save}</span>
          </button>
        </div>
      )}

      {/* Tab 5: Questionnaires */}
      {activeTab === 'surveys' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">
            Riwayat Jawaban Kuesioner Pasien
          </h3>
          {responses.length === 0 ? (
            <p className="text-xs text-slate-400">Pasien belum mengisi kuesioner apa pun.</p>
          ) : (
            <div className="space-y-3">
              {responses.map((resp) => (
                <div key={resp.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-sm">{resp.questionnaire?.titleId}</span>
                      <span className="text-xs text-slate-400 block">{new Date(resp.createdAt).toLocaleString()}</span>
                    </div>
                    {resp.score !== null && (
                      <span className="font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 text-xs">
                        Skor: {resp.score}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 pt-2 border-t border-slate-200/60">
                    <pre className="font-mono bg-white p-2 rounded border border-slate-200 overflow-x-auto text-[11px]">
                      {JSON.stringify(resp.answers, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Medication Modal */}
      {showAddMed && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg">Tambah Obat untuk Pasien</h3>
            <form onSubmit={handleAddMedication} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Nama Obat *</label>
                <input
                  type="text"
                  required
                  value={medForm.name}
                  onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                  placeholder="Amlodipin"
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Dosis</label>
                  <input
                    type="text"
                    value={medForm.dosage}
                    onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                    placeholder="5 mg"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Bentuk</label>
                  <input
                    type="text"
                    value={medForm.form}
                    onChange={(e) => setMedForm({ ...medForm, form: e.target.value })}
                    placeholder="Tablet"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Jadwal Jam Minum (Pisahkan koma) *</label>
                <input
                  type="text"
                  required
                  value={medForm.times}
                  onChange={(e) => setMedForm({ ...medForm, times: e.target.value })}
                  placeholder="07:00, 19:00"
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Instruksi Pasien</label>
                <input
                  type="text"
                  value={medForm.instructions}
                  onChange={(e) => setMedForm({ ...medForm, instructions: e.target.value })}
                  placeholder="Diminum bersama makan pagi"
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Tautkan Panduan Edukasi</label>
                <select
                  value={medForm.articleId}
                  onChange={(e) => setMedForm({ ...medForm, articleId: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="">-- Tanpa Panduan Terkait --</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>{a.titleId}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMed(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                >
                  Simpan Obat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
