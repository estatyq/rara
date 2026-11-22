import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Pill, Clock, Plus, Trash2, MessageSquare, Save, CheckCircle2,
  AlertCircle, FileText, Send, HeartPulse, Activity, Printer, Phone, XCircle, Calendar
} from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import AdherenceRing from '../../components/AdherenceRing';
import { dateTimeInputInZone } from '../../utils/date';

const DRP_LABELS = {
  NONE: { id: 'Tidak Ada Masalah Terapi (Terkontrol)', en: 'No Drug Therapy Problem (Controlled)' },
  NON_ADHERENCE: { id: 'Ketidakpatuhan / Lupa Dosis (Non-Adherence)', en: 'Medication Non-Adherence / Missed Doses' },
  ADVERSE_DRUG_REACTION: { id: 'Keluhan Efek Samping Obat (ESO/ADR)', en: 'Adverse Drug Reaction / Side Effect' },
  SUBOPTIMAL_DOSAGE: { id: 'Dosis / Jam Minum Belum Optimal', en: 'Suboptimal Dosage / Schedule Timing' },
  DRUG_INTERACTION: { id: 'Potensi Interaksi Obat / Suplemen', en: 'Potential Drug / Supplement Interaction' },
  NEEDS_ADDITIONAL_THERAPY: { id: 'Memerlukan Terapi / Evaluasi Dokter Tambahan', en: 'Needs Additional Therapy / Physician Review' },
};

export default function StaffPatientDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const dateLocale = isEn ? 'en-US' : 'id-ID';
  const { user } = useAuth();
  const { socket } = useSocket();

  const [patient, setPatient] = useState(null);
  const [medications, setMedications] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [bloodPressure, setBloodPressure] = useState(null);
  const [doses, setDoses] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [waLogs, setWaLogs] = useState([]);
  const [waMeUrl, setWaMeUrl] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [responses, setResponses] = useState([]);
  const [articles, setArticles] = useState([]);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
  const [historyDays, setHistoryDays] = useState(14);
  const [loading, setLoading] = useState(true);

  // Notes state
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Chat & WhatsApp reply state
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [waInput, setWaInput] = useState('');
  const [sendingWa, setSendingWa] = useState(false);

  // Add Medication Modal state
  const [showAddMed, setShowAddMed] = useState(false);
  const [clinicBp, setClinicBp] = useState({ systolic: '', diastolic: '', pulse: '', note: '' });
  const [savingBp, setSavingBp] = useState(false);
  const [medForm, setMedForm] = useState({
    name: '', dosage: '', form: 'Tablet', instructions: '', times: '07:00', articleId: '',
  });

  // Follow-Up & PTO Form State
  const [ptoForm, setPtoForm] = useState({
    type: 'PTO_REPORT',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    drpCategory: 'NONE',
    recommendation: '',
    nextFollowUpDate: '',
    sendToChat: true,
    sendViaWhatsApp: true,
  });
  const [savingPto, setSavingPto] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const todayStr = dateTimeInputInZone(new Date(), 'Asia/Jakarta').slice(0, 10);
      const fromDate = new Date(Date.now() - (historyDays - 1) * 86400000);
      const fromStr = dateTimeInputInZone(fromDate, 'Asia/Jakarta').slice(0, 10);

      const [pRes, mRes, aRes, dRes, msgRes, rRes, artRes, bpRes, fRes, waRes, stRes] = await Promise.all([
        api.getPatient(id),
        api.getMedications(id, true),
        api.getAdherence(id, 30),
        api.getDoses(id, fromStr, todayStr),
        api.getMessages(id, 50),
        api.getPatientResponses(id),
        api.getArticles(),
        api.getBloodPressures(id, 30, 60),
        api.getFollowUps(id).catch(() => ({ followUps: [] })),
        api.getPatientWhatsAppLogs(id).catch(() => ({ logs: [], waMeUrl: null })),
        api.getStaffList().catch(() => ({ users: [] })),
      ]);
      setPatient(pRes.patient);
      setNotes(pRes.patient?.notes || '');
      setMedications(mRes.medications || []);
      setAdherence(aRes);
      setDoses((dRes.doses || []).slice().reverse());
      setMessages(msgRes.messages || []);
      setResponses(rRes.responses || []);
      setArticles(artRes.articles || []);
      setBloodPressure({ logs: bpRes.logs || [], summary: bpRes.summary || null });
      setFollowUps(fRes.followUps || []);
      setWaLogs(waRes.logs || []);
      setWaMeUrl(waRes.waMeUrl || null);
      setStaffList((stRes.users || []).filter((u) => u.role === 'PHARMACIST'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, historyDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const handleMsg = (msg) => {
      if (msg.patientId === id) {
        setMessages((prev) => [...prev, msg]);
      }
    };
    const handleBp = (log) => {
      if (log.patientId === id) loadData();
    };
    socket.on('message:new', handleMsg);
    socket.on('blood-pressure:changed', handleBp);
    return () => {
      socket.off('message:new', handleMsg);
      socket.off('blood-pressure:changed', handleBp);
    };
  }, [socket, id, loadData]);

  const handleAssignPharmacist = async (newPharmacistId) => {
    try {
      await api.updatePatient(id, { pharmacistId: newPharmacistId || null });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.updatePatient(id, { notes });
      alert(isEn ? 'Clinical notes saved!' : 'Catatan klinis berhasil disimpan!');
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to save notes' : 'Gagal menyimpan catatan'));
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
      setMedForm({ name: '', dosage: '', form: 'Tablet', instructions: '', times: '07:00', articleId: '' });
      await loadData();
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to add medication' : 'Gagal menambahkan obat'));
    }
  };

  const handleDeleteMedication = async (medId) => {
    const confirmMsg = isEn
      ? 'Stop this medication for the patient? Dose history will be preserved.'
      : 'Hentikan obat ini untuk pasien? Riwayat dosis tetap tersimpan untuk riset.';
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.deleteMedication(medId);
      await loadData();
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to deactivate medication' : 'Gagal menonaktifkan obat'));
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
      alert(err.message || (isEn ? 'Failed to send message' : 'Gagal mengirim pesan'));
    } finally {
      setSendingMsg(false);
    }
  };

  const handleSendWhatsApp = async (e) => {
    e.preventDefault();
    if (!waInput.trim() || sendingWa) return;
    setSendingWa(true);
    try {
      await api.sendPatientWhatsApp(id, {
        message: waInput.trim(),
        category: 'FOLLOW_UP',
      });
      setWaInput('');
      await loadData();
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to send WhatsApp message' : 'Gagal mengirim pesan WhatsApp'));
    } finally {
      setSendingWa(false);
    }
  };

  const handleClinicBp = async (e) => {
    e.preventDefault();
    if (!clinicBp.systolic || !clinicBp.diastolic) return;
    setSavingBp(true);
    try {
      await api.recordBloodPressure(id, {
        systolic: Number(clinicBp.systolic),
        diastolic: Number(clinicBp.diastolic),
        pulse: clinicBp.pulse ? Number(clinicBp.pulse) : undefined,
        note: clinicBp.note || undefined,
        source: 'CLINIC',
      });
      setClinicBp({ systolic: '', diastolic: '', pulse: '', note: '' });
      await loadData();
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to save blood pressure reading' : 'Gagal menyimpan tekanan darah'));
    } finally {
      setSavingBp(false);
    }
  };

  const handleCreateFollowUp = async (e) => {
    e.preventDefault();
    if (!ptoForm.plan.trim()) return;
    setSavingPto(true);
    try {
      await api.createFollowUp(id, ptoForm);
      setPtoForm({
        type: 'PTO_REPORT',
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
        drpCategory: 'NONE',
        recommendation: '',
        nextFollowUpDate: '',
        sendToChat: true,
        sendViaWhatsApp: true,
      });
      await loadData();
    } catch (err) {
      alert(err.message || (isEn ? 'Failed to save follow-up report' : 'Gagal menyimpan laporan tindak lanjut'));
    } finally {
      setSavingPto(false);
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
    { id: 'overview', label: lang === 'id' ? 'Ringkasan Kepatuhan' : 'Adherence Summary' },
    { id: 'medications', label: `${lang === 'id' ? 'Obat & Jadwal' : 'Medications'} (${medications.filter((m) => m.active).length})` },
    { id: 'history', label: `${lang === 'id' ? 'Riwayat Obat' : 'Dose History'} (${doses.length})` },
    { id: 'blood-pressure', label: lang === 'id' ? 'Tekanan Darah' : 'Blood Pressure' },
    { id: 'followups', label: `${lang === 'id' ? 'Tindak Lanjut & Laporan PTO' : 'Follow-Up & PTO Report'} (${followUps.length})` },
    { id: 'chat', label: `${lang === 'id' ? 'Chat & WhatsApp' : 'Chat & WhatsApp'} (${messages.length})` },
    { id: 'notes', label: lang === 'id' ? 'Catatan & Survei' : 'Notes & Surveys' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          to="/staff"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === 'id' ? 'Kembali ke Daftar Pasien' : 'Back to Patient List'}</span>
        </Link>

        <button
          onClick={() => {
            setActiveTab('followups');
            setTimeout(() => window.print(), 200);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 shadow-xs transition"
        >
          <Printer className="w-4 h-4 text-teal-600" />
          <span>{lang === 'id' ? 'Cetak Laporan PTO (PDF)' : 'Print PTO Report (PDF)'}</span>
        </button>
      </div>

      {/* Printable Official Clinical Header (Visible when printing) */}
      <div className="hidden print:block border-b-2 border-teal-800 pb-4 mb-4">
        <h1 className="text-xl font-extrabold text-teal-950 uppercase">
          {isEn
            ? 'Pharmacotherapy Monitoring (PTO) & Clinical Pharmacy Report'
            : 'Laporan Pemantauan Terapi Obat (PTO) & Farmasi Klinis'}
        </h1>
        <p className="text-xs text-slate-600">
          {isEn
            ? `DoseLynx Digital Pharmacy Platform • Responsible Pharmacist: ${patient.pharmacist?.name || user.name}`
            : `Platform Layanan Farmasi Digital DoseLynx • Apoteker Penanggung Jawab: ${patient.pharmacist?.name || user.name}`}
        </p>
      </div>

      {/* Patient Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-sm shrink-0">
            {patient.user.name.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">
                {patient.user.name}
              </h1>
              <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                {patient.studyCode || 'P-???'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span>{patient.user.phone || patient.user.email}</span>
              <span>•</span>
              <span>Diagnosis: <strong>{patient.diagnosis || '—'}</strong></span>
              {patient.allergies && (
                <>
                  <span>•</span>
                  <span className="text-rose-700 font-semibold">
                    {isEn ? 'Allergies:' : 'Alergi:'} {patient.allergies}
                  </span>
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                {patient.studyGroup === 'CONTROL'
                  ? (isEn ? 'Control Group' : 'Kelompok Kontrol')
                  : (isEn ? 'Intervention Group' : 'Kelompok Intervensi')}
              </span>
              {patient.estimatedDueDate && (
                <span className="text-[10px] font-semibold text-slate-500">
                  {isEn ? 'EDD' : 'HPL'}{' '}
                  {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium' }).format(new Date(patient.estimatedDueDate))}
                </span>
              )}
              <div className="flex items-center gap-1 text-[11px] text-slate-600 print:hidden">
                <span>• {isEn ? 'Pharmacist:' : 'Apoteker PJ:'}</span>
                <select
                  value={patient.pharmacistId || ''}
                  onChange={(e) => handleAssignPharmacist(e.target.value)}
                  className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-teal-800"
                >
                  <option value="">{isEn ? '-- Select Pharmacist --' : '-- Pilih Apoteker --'}</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Adherence & BP Summary */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="block text-2xl font-extrabold text-rose-600">
              {bloodPressure?.summary?.latest
                ? `${bloodPressure.summary.latest.systolic}/${bloodPressure.summary.latest.diastolic}`
                : '—'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isEn ? 'Latest BP (mmHg)' : 'TD Terakhir (mmHg)'}
            </span>
          </div>
          <div className="text-right border-l border-slate-200 pl-6">
            <span className="block text-2xl font-extrabold text-teal-600">
              {adherence?.rate !== null && adherence?.rate !== undefined ? `${Math.round(adherence.rate)}%` : '—'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isEn ? '30-Day Adherence' : 'Kepatuhan 30 Hari'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto print:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <h3 className="font-bold text-slate-800 text-sm mb-4">
              {isEn ? 'Medication Adherence (30 Days)' : 'Indikator Kepatuhan Obat (30 Hari)'}
            </h3>
            <AdherenceRing rate={adherence?.rate} size={150} strokeWidth={12} label={isEn ? '30 Days' : '30 Hari'} />
            {adherence?.avgDelayMinutes !== null && (
              <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
                {isEn ? 'Average intake timing delay:' : 'Rata-rata deviasi jam minum obat:'}{' '}
                <strong className="text-slate-800">
                  {adherence.avgDelayMinutes} {isEn ? 'min' : 'menit'}
                </strong>
              </p>
            )}
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">
              {isEn ? 'Adherence by Medication' : 'Tingkat Kepatuhan per Obat'}
            </h3>
            {adherence?.byMedication?.length ? (
              <div className="space-y-3">
                {adherence.byMedication.map((m) => (
                  <div key={m.medicationId} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 text-sm">{m.name}</span>
                      <span className="text-xs text-slate-500 block">
                        {isEn
                          ? `Taken: ${m.TAKEN} | Skipped: ${m.SKIPPED} | Missed: ${m.MISSED}`
                          : `Diminum: ${m.TAKEN} | Dilewati: ${m.SKIPPED} | Terlewat: ${m.MISSED}`}
                      </span>
                    </div>
                    <span className="font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 text-xs">
                      {m.rate !== null ? `${Math.round(m.rate)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                {isEn ? 'No medication intake history recorded yet.' : 'Belum ada riwayat konsumsi obat yang tercatat.'}
              </p>
            )}

            {patient.riskFactors && (
              <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950">
                <strong className="block uppercase text-[10px] text-amber-700 mb-1">
                  {isEn ? 'Clinical Risk Factors:' : 'Faktor Risiko Klinis:'}
                </strong>
                {patient.riskFactors}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Medications */}
      {activeTab === 'medications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base">
              {isEn ? 'Prescriptions & Medication Schedule' : 'Regimen Resep & Jadwal Pengobatan'}
            </h3>
            <button
              onClick={() => setShowAddMed(true)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>{isEn ? 'Add Medication' : 'Tambah Obat'}</span>
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
                      {med.times.map((timeStr) => (
                        <span key={timeStr} className="text-xs bg-slate-100 font-bold px-2 py-0.5 rounded text-slate-700">
                          {timeStr}
                        </span>
                      ))}
                    </div>
                  </div>
                  {med.active && (
                    <button
                      onClick={() => handleDeleteMedication(med.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title={isEn ? 'Stop medication' : 'Hentikan obat'}
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

      {/* TAB 3: Medication Use History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                {lang === 'id' ? 'Riwayat Penggunaan & Konfirmasi Dosis Obat Pasien' : 'Patient Medication Consumption Log'}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setHistoryDays(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    historyDays === d ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {d} {lang === 'id' ? 'Hari' : 'Days'}
                </button>
              ))}
            </div>
          </div>

          {doses.length === 0 ? (
            <p className="p-12 text-center text-xs text-slate-400">
              {isEn
                ? 'No medication consumption history in this date range.'
                : 'Belum ada riwayat penggunaan obat pada rentang tanggal ini.'}
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-3">{isEn ? 'Scheduled Time' : 'Waktu Jadwal'}</th>
                    <th className="px-5 py-3">{isEn ? 'Medication & Dosage' : 'Obat & Dosis'}</th>
                    <th className="px-5 py-3">{isEn ? 'Status' : 'Status'}</th>
                    <th className="px-5 py-3">{isEn ? 'Taken At / Delay' : 'Waktu Diminum / Deviasi'}</th>
                    <th className="px-5 py-3">{isEn ? 'Patient Note' : 'Catatan Pasien'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doses.map((d) => {
                    const delayMin =
                      d.status === 'TAKEN' && d.takenAt
                        ? Math.round((new Date(d.takenAt) - new Date(d.scheduledAt)) / 60000)
                        : null;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-slate-700">
                          {new Intl.DateTimeFormat(dateLocale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: patient.user.timezone,
                          }).format(new Date(d.scheduledAt))}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-bold text-slate-900">{d.medication?.name}</span>{' '}
                          <span className="text-teal-700 font-semibold">{d.medication?.dosage}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${
                            d.status === 'TAKEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : d.status === 'SKIPPED' ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : d.status === 'MISSED' ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {d.takenAt
                            ? `${new Date(d.takenAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })} (${delayMin >= 0 ? `+${delayMin}` : delayMin} ${isEn ? 'min' : 'mnt'})`
                            : '—'}
                        </td>
                        <td className="px-5 py-3 italic text-slate-500">{d.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Blood Pressure */}
      {activeTab === 'blood-pressure' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isEn ? 'Latest' : 'Terakhir'}
                </span>
                <div className="mt-2 text-2xl font-extrabold text-slate-900">
                  {bloodPressure?.summary?.latest
                    ? `${bloodPressure.summary.latest.systolic}/${bloodPressure.summary.latest.diastolic}`
                    : '—'}
                  <span className="text-[11px] font-medium text-slate-400 ml-1">mmHg</span>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isEn ? 'Average' : 'Rata-rata'}
                </span>
                <div className="mt-2 text-2xl font-extrabold text-slate-900">
                  {bloodPressure?.summary?.average
                    ? `${bloodPressure.summary.average.systolic}/${bloodPressure.summary.average.diastolic}`
                    : '—'}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isEn ? 'Controlled' : 'Terkontrol'}
                </span>
                <div className="mt-2 text-2xl font-extrabold text-teal-700">
                  {bloodPressure?.summary?.controlRate == null ? '—' : `${bloodPressure.summary.controlRate}%`}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {isEn ? 'Blood Pressure History' : 'Riwayat tekanan darah'}
                </h3>
              </div>
              {bloodPressure?.logs?.length ? (
                <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                  {bloodPressure.logs.map((log) => (
                    <div key={log.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-900">
                          {log.systolic}/{log.diastolic}
                          <span className="text-[10px] font-medium text-slate-400 ml-1.5">mmHg</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Intl.DateTimeFormat(dateLocale, {
                            timeZone: patient.user.timezone,
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(log.measuredAt))}
                          {' · '}{log.source === 'CLINIC' ? (isEn ? 'Clinic' : 'Klinik') : (isEn ? 'Self' : 'Mandiri')}
                        </p>
                        {log.note && <p className="text-xs text-slate-500 mt-1">{log.note}</p>}
                      </div>
                      <span className={`text-[10px] font-bold border rounded-full px-2 py-1 ${
                        log.category === 'NORMAL'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : log.category === 'ELEVATED'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : log.category === 'LOW'
                              ? 'text-sky-700 bg-sky-50 border-sky-200'
                              : 'text-rose-700 bg-rose-50 border-rose-200'
                      }`}>
                        {log.category}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-12 text-center text-sm text-slate-400">
                  {isEn ? 'No blood pressure readings recorded yet.' : 'Belum ada pengukuran tekanan darah.'}
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleClinicBp} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 h-fit">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                {isEn ? 'Record Clinic Reading' : 'Catat hasil klinik'}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">
                {isEn ? 'Systolic' : 'Sistolik'}
                <input
                  type="number"
                  min="60"
                  max="260"
                  required
                  value={clinicBp.systolic}
                  onChange={(e) => setClinicBp({ ...clinicBp, systolic: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-900"
                />
              </label>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                {isEn ? 'Diastolic' : 'Diastolik'}
                <input
                  type="number"
                  min="30"
                  max="160"
                  required
                  value={clinicBp.diastolic}
                  onChange={(e) => setClinicBp({ ...clinicBp, diastolic: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-900"
                />
              </label>
            </div>
            <label className="block text-[10px] font-bold uppercase text-slate-500">
              {isEn ? 'Pulse' : 'Nadi'}
              <input
                type="number"
                min="30"
                max="220"
                value={clinicBp.pulse}
                onChange={(e) => setClinicBp({ ...clinicBp, pulse: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-[10px] font-bold uppercase text-slate-500">
              {isEn ? 'Note' : 'Catatan'}
              <textarea
                rows="2"
                value={clinicBp.note}
                onChange={(e) => setClinicBp({ ...clinicBp, note: e.target.value })}
                className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              />
            </label>
            <button
              type="submit"
              disabled={savingBp}
              className="w-full rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {savingBp
                ? (isEn ? 'Saving...' : 'Menyimpan...')
                : (isEn ? 'Save Reading' : 'Simpan pengukuran')}
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: Follow-Up & Pharmacotherapy Monitoring Report (PTO) */}
      {activeTab === 'followups' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Form to Record Follow-Up / PTO Report (Hidden on Print) */}
          <form
            onSubmit={handleCreateFollowUp}
            className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3 h-fit print:hidden"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                {isEn ? 'New Follow-Up & PTO Report' : 'Buat Tindak Lanjut & Laporan PTO Baru'}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  {isEn ? 'Evaluation Type' : 'Jenis Evaluasi'}
                </label>
                <select
                  value={ptoForm.type}
                  onChange={(e) => setPtoForm({ ...ptoForm, type: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="PTO_REPORT">{isEn ? 'PTO Report (SOAP)' : 'Laporan PTO (SOAP)'}</option>
                  <option value="FOLLOW_UP">{isEn ? 'Periodic Follow-Up' : 'Tindak Lanjut Berkala'}</option>
                  <option value="COUNSELING">{isEn ? 'Adherence Counseling' : 'Konseling Kepatuhan'}</option>
                  <option value="DRP_INTERVENTION">{isEn ? 'DRP / Side Effect Intervention' : 'Intervensi DRP / Efek Samping'}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  {isEn ? 'Next Follow-Up Date' : 'Jadwal Evaluasi Berikutnya'}
                </label>
                <input
                  type="date"
                  value={ptoForm.nextFollowUpDate}
                  onChange={(e) => setPtoForm({ ...ptoForm, nextFollowUpDate: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                {isEn ? 'Drug-Related Problem (DRP) Category' : 'Kategori Masalah Terapi Obat (DRP)'}
              </label>
              <select
                value={ptoForm.drpCategory}
                onChange={(e) => setPtoForm({ ...ptoForm, drpCategory: e.target.value })}
                className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              >
                {Object.entries(DRP_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{isEn ? v.en : v.id}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                {isEn ? 'Subjective (Patient Symptoms)' : 'Subjective (Keluhan Pasien)'}
              </label>
              <textarea
                rows={2}
                value={ptoForm.subjective}
                onChange={(e) => setPtoForm({ ...ptoForm, subjective: e.target.value })}
                placeholder={isEn ? 'Patient symptoms, timing challenges...' : 'Keluhan pasien, gejala, kendala waktu minum obat...'}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                {isEn ? 'Objective (Adherence & Blood Pressure)' : 'Objective (Data Kepatuhan & Tekanan Darah)'}
              </label>
              <textarea
                rows={2}
                value={ptoForm.objective}
                onChange={(e) => setPtoForm({ ...ptoForm, objective: e.target.value })}
                placeholder={isEn ? 'Latest BP reading, 30-day adherence rate, labs...' : 'Hasil TD terbaru, skor kepatuhan 30 hari, hasil lab...'}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                {isEn ? 'Assessment (Pharmacotherapy Analysis)' : 'Assessment (Analisis Farmakoterapi)'}
              </label>
              <textarea
                rows={2}
                value={ptoForm.assessment}
                onChange={(e) => setPtoForm({ ...ptoForm, assessment: e.target.value })}
                placeholder={isEn ? 'Therapy effectiveness, safety, and adherence evaluation...' : 'Evaluasi efektivitas terapi, keamanan, dan kepatuhan...'}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                {isEn ? 'Plan (Pharmacotherapy Care Plan) *' : 'Plan (Rencana Tindak Lanjut Farmakoterapi) *'}
              </label>
              <textarea
                rows={3}
                required
                value={ptoForm.plan}
                onChange={(e) => setPtoForm({ ...ptoForm, plan: e.target.value })}
                placeholder={isEn ? 'Pharmacist intervention plan, alarm adjustments, counseling...' : 'Rencana intervensi apoteker, penyesuaian jadwal alarm, edukasi...'}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                {isEn ? 'Specific Recommendation for Patient / Clinician' : 'Rekomendasi Spesifik untuk Pasien / Dokter'}
              </label>
              <input
                type="text"
                value={ptoForm.recommendation}
                onChange={(e) => setPtoForm({ ...ptoForm, recommendation: e.target.value })}
                placeholder={isEn ? 'Practical guidance sent to patient...' : 'Saran praktis yang dikirim ke pasien...'}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={ptoForm.sendToChat}
                  onChange={(e) => setPtoForm({ ...ptoForm, sendToChat: e.target.checked })}
                  className="rounded border-slate-300 text-teal-600"
                />
                <span>
                  {isEn ? 'Send summary to patient Consultation Chat' : 'Kirim ringkasan ke ruang Konsultasi Chat pasien'}
                </span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={ptoForm.sendViaWhatsApp}
                  onChange={(e) => setPtoForm({ ...ptoForm, sendViaWhatsApp: e.target.checked })}
                  className="rounded border-slate-300 text-teal-600"
                />
                <span>
                  {isEn ? 'Send automatic follow-up via WhatsApp' : 'Kirim tindak lanjut otomatis ke WhatsApp pasien'}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingPto}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {savingPto
                ? (isEn ? 'Saving PTO Report...' : 'Menyimpan Laporan PTO...')
                : (isEn ? 'Save & Send PTO Follow-Up' : 'Simpan & Kirim Tindak Lanjut PTO')}
            </button>
          </form>

          {/* Right: Printable List of PTO Reports & Follow-Ups */}
          <div className="lg:col-span-7 print:col-span-12 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {isEn
                  ? 'Pharmacotherapy Monitoring (PTO) & Follow-Up Records'
                  : 'Rekam Laporan Pemantauan Farmakoterapi (PTO) & Tindak Lanjut'}
              </h3>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-800 rounded-lg text-xs font-bold hover:bg-teal-100 print:hidden"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isEn ? 'Print / PDF' : 'Cetak / PDF'}</span>
              </button>
            </div>

            {followUps.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center text-slate-400 text-xs">
                {isEn
                  ? 'No pharmacotherapy monitoring records for this patient yet.'
                  : 'Belum ada rekam laporan pemantauan farmakoterapi untuk pasien ini.'}
              </div>
            ) : (
              followUps.map((f) => (
                <div key={f.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3 break-inside-avoid">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full">
                          {f.type}
                        </span>
                        <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                          DRP: {DRP_LABELS[f.drpCategory]?.[isEn ? 'en' : 'id'] || f.drpCategory}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {isEn ? 'By:' : 'Oleh:'} <strong>{f.pharmacist?.name}</strong> •{' '}
                        {new Date(f.createdAt).toLocaleString(dateLocale)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      {f.adherenceRate !== null && (
                        <div>
                          {isEn ? 'Adherence:' : 'Kepatuhan:'} <strong>{Math.round(f.adherenceRate)}%</strong>
                        </div>
                      )}
                      {f.latestBp && (
                        <div>
                          {isEn ? 'BP:' : 'TD:'} <strong>{f.latestBp}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {f.subjective && (
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <strong className="text-slate-800 block mb-0.5">S — Subjective:</strong>
                        <p className="text-slate-600">{f.subjective}</p>
                      </div>
                    )}
                    {f.objective && (
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <strong className="text-slate-800 block mb-0.5">O — Objective:</strong>
                        <p className="text-slate-600">{f.objective}</p>
                      </div>
                    )}
                  </div>

                  {f.assessment && (
                    <div className="p-3 bg-slate-50 rounded-xl text-xs">
                      <strong className="text-slate-800 block mb-0.5">
                        {isEn ? 'A — Assessment (Pharmacotherapy Analysis):' : 'A — Assessment (Analisis Farmakoterapi):'}
                      </strong>
                      <p className="text-slate-700">{f.assessment}</p>
                    </div>
                  )}

                  <div className="p-3.5 bg-teal-50/60 border border-teal-200 rounded-xl text-xs">
                    <strong className="text-teal-950 block mb-0.5">
                      {isEn ? 'P — Plan (Care Plan):' : 'P — Plan (Rencana Tindak Lanjut):'}
                    </strong>
                    <p className="text-teal-900 whitespace-pre-line">{f.plan}</p>
                  </div>

                  {f.recommendation && (
                    <p className="text-xs text-slate-700">
                      <strong>{isEn ? 'Recommendation:' : 'Rekomendasi:'}</strong> {f.recommendation}
                    </p>
                  )}

                  {f.nextFollowUpDate && (
                    <p className="text-[11px] font-semibold text-indigo-700">
                      {isEn ? 'Next Follow-Up Date:' : 'Jadwal Tindak Lanjut Berikutnya:'}{' '}
                      {new Date(f.nextFollowUpDate).toLocaleDateString(dateLocale, { dateStyle: 'long' })}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: Chat & WhatsApp Integration */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 cols: In-App Live Chat */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 h-[550px] flex flex-col">
            <h3 className="font-bold text-slate-900 text-sm mb-2 px-1">
              {isEn ? 'In-App Live Consultation Chat' : 'Ruang Konsultasi Live Chat Aplikasi'}
            </h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-slate-50 rounded-xl">
              {messages.length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-xs">
                  {isEn ? 'No message history yet.' : 'Belum ada riwayat pesan.'}
                </p>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderId === user.id;
                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-slate-400 mb-0.5 px-1">{m.sender?.name}</span>
                      <div
                        className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                          isMe ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                        }`}
                      >
                        <p>{m.body}</p>
                        <span className={`block text-[9px] mt-1 text-right ${isMe ? 'text-teal-200' : 'text-slate-400'}`}>
                          {new Date(m.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
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
                placeholder={isEn ? 'Type a pharmacist reply or instruction...' : 'Ketik balasan atau instruksi apoteker...'}
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

          {/* Right 5 cols: WhatsApp Reminder & Direct Gateway Sender */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    {isEn ? 'Patient WhatsApp Integration' : 'Integrasi WhatsApp Pasien'}
                  </h3>
                </div>
                {waMeUrl && (
                  <a
                    href={waMeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100"
                  >
                    {isEn ? 'Open wa.me ↗' : 'Buka wa.me ↗'}
                  </a>
                )}
              </div>

              <form onSubmit={handleSendWhatsApp} className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500 block">
                  {isEn
                    ? `Send WhatsApp Message / Reminder to ${patient.user.phone || 'Patient'}`
                    : `Kirim Pesan / Pengingat WhatsApp ke ${patient.user.phone || 'Pasien'}`}
                </label>
                <textarea
                  rows={3}
                  value={waInput}
                  onChange={(e) => setWaInput(e.target.value)}
                  placeholder={
                    isEn
                      ? `Hello ${patient.user.name}, this is a reminder from Pharmacist ${user.name} regarding your medication schedule and blood pressure check...`
                      : `Halo ${patient.user.name}, ini pengingat dari Apoteker ${user.name} untuk jadwal obat dan evaluasi tekanan darah Anda...`
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
                />
                <button
                  type="submit"
                  disabled={!waInput.trim() || sendingWa}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {sendingWa
                    ? (isEn ? 'Sending via WhatsApp...' : 'Mengirim ke WhatsApp...')
                    : (isEn ? 'Send WhatsApp Message Now' : 'Kirim Pesan WhatsApp Sekarang')}
                </button>
              </form>

              <div className="pt-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
                  {isEn ? `WhatsApp Delivery Logs (${waLogs.length})` : `Log Pengiriman WhatsApp (${waLogs.length})`}
                </span>
                <div className="space-y-2 max-h-[260px] overflow-y-auto">
                  {waLogs.map((w) => (
                    <div key={w.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px]">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-bold text-emerald-700">{w.category}</span>
                        <span>{new Date(w.createdAt).toLocaleString(dateLocale)} • {w.status}</span>
                      </div>
                      <p className="text-slate-700">{w.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Private Notes & Questionnaires */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {isEn
                  ? 'Pharmacist Intervention & Counseling Notes (Private Team)'
                  : 'Catatan Intervensi & Konseling Farmasi (Privat Tim Peneliti)'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEn
                  ? 'Visible only to pharmacists and administrators; not shown to patients.'
                  : 'Catatan ini hanya dapat dilihat oleh apoteker dan administrator, tidak ditampilkan kepada pasien.'}
              </p>
            </div>

            <textarea
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isEn
                  ? 'Record counseling history, schedule adjustments, side effect notes, or clinical observations...'
                  : 'Tulis riwayat konseling, penyesuaian jadwal obat, keluhan efek samping, atau catatan penting riset...'
              }
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

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">
              {isEn
                ? `Patient Questionnaire History (${responses.length})`
                : `Riwayat Jawaban Kuesioner Pasien (${responses.length})`}
            </h3>
            {responses.length === 0 ? (
              <p className="text-xs text-slate-400">
                {isEn ? 'Patient has not completed any questionnaires yet.' : 'Pasien belum mengisi kuesioner apa pun.'}
              </p>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto">
                {responses.map((resp) => (
                  <div key={resp.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-sm">
                          {isEn
                            ? (resp.questionnaire?.titleEn || resp.questionnaire?.titleId)
                            : (resp.questionnaire?.titleId || resp.questionnaire?.titleEn)}
                        </span>
                        <span className="text-xs text-slate-400 block">
                          {new Date(resp.createdAt).toLocaleString(dateLocale)}
                        </span>
                      </div>
                      {resp.score !== null && (
                        <span className="font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 text-xs">
                          {isEn ? 'Score:' : 'Skor:'} {resp.score}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Medication Modal */}
      {showAddMed && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg">
              {isEn ? 'Add Medication for Patient' : 'Tambah Obat untuk Pasien'}
            </h3>
            <form onSubmit={handleAddMedication} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Medication Name *' : 'Nama Obat *'}
                </label>
                <input
                  type="text"
                  required
                  value={medForm.name}
                  onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                  placeholder={isEn ? 'Low-dose Aspirin' : 'Aspirin dosis rendah'}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Dosage' : 'Dosis'}
                  </label>
                  <input
                    type="text"
                    value={medForm.dosage}
                    onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                    placeholder="80 mg"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    {isEn ? 'Form' : 'Bentuk'}
                  </label>
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
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Alarm Times (comma-separated) *' : 'Jadwal Jam Minum (Pisahkan koma) *'}
                </label>
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
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Patient Instructions' : 'Instruksi Pasien'}
                </label>
                <input
                  type="text"
                  value={medForm.instructions}
                  onChange={(e) => setMedForm({ ...medForm, instructions: e.target.value })}
                  placeholder={isEn ? 'Take with breakfast' : 'Diminum bersama makan pagi'}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {isEn ? 'Link Educational Guide' : 'Tautkan Panduan Edukasi'}
                </label>
                <select
                  value={medForm.articleId}
                  onChange={(e) => setMedForm({ ...medForm, articleId: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="">{isEn ? '-- No Linked Guide --' : '-- Tanpa Panduan Terkait --'}</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>{isEn ? (a.titleEn || a.titleId) : a.titleId}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMed(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                >
                  {isEn ? 'Save Medication' : 'Simpan Obat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
