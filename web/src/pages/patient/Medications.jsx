import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Pill, Clock, BookOpen, Plus, Edit3, Trash2, Bell, CheckCircle2,
  XCircle, AlertCircle, Calendar, FileText
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import { dateTimeInputInZone } from '../../utils/date';

export default function PatientMedications() {
  const { user } = useAuth();
  const { t, lang, localize } = useLanguage();
  const { triggerAlarm } = useSocket();

  const [activeTab, setActiveTab] = useState('schedule'); // schedule | history | followups
  const [medications, setMedications] = useState([]);
  const [dosesHistory, setDosesHistory] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [followUps, setFollowUps] = useState([]);
  const [historyDays, setHistoryDays] = useState(14);
  const [loading, setLoading] = useState(true);

  // Add / Edit Medication Schedule Modal
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [medForm, setMedForm] = useState({
    name: '',
    dosage: '',
    form: 'Tablet',
    times: '07:00',
    instructions: '',
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const todayStr = dateTimeInputInZone(new Date(), user.timezone).slice(0, 10);
      const fromDate = new Date(Date.now() - (historyDays - 1) * 86400000);
      const fromStr = dateTimeInputInZone(fromDate, user.timezone).slice(0, 10);

      const [medsRes, dosesRes, adhRes, fRes] = await Promise.all([
        api.getMedications('me', true),
        api.getDoses('me', fromStr, todayStr),
        api.getAdherence('me', 30),
        api.getFollowUps('me').catch(() => ({ followUps: [] })),
      ]);
      setMedications(medsRes.medications || []);
      setDosesHistory((dosesRes.doses || []).slice().reverse());
      setAdherence(adhRes);
      setFollowUps(fRes.followUps || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.timezone, historyDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setEditingMed(null);
    setMedForm({
      name: '',
      dosage: '',
      form: 'Tablet',
      times: '07:00, 19:00',
      instructions: '',
    });
    setShowModal(true);
  };

  const openEditModal = (med) => {
    setEditingMed(med);
    setMedForm({
      name: med.name || '',
      dosage: med.dosage || '',
      form: med.form || 'Tablet',
      times: (med.times || []).join(', '),
      instructions: med.instructions || '',
    });
    setShowModal(true);
  };

  const handleSaveMedication = async (e) => {
    e.preventDefault();
    const timesArray = medForm.times
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!medForm.name || timesArray.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        name: medForm.name,
        dosage: medForm.dosage || undefined,
        form: medForm.form || undefined,
        times: timesArray,
        instructions: medForm.instructions || undefined,
      };
      if (editingMed) {
        await api.updateMedication(editingMed.id, payload);
      } else {
        await api.createMedication('me', payload);
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      alert(err.message || (lang === 'en' ? 'Failed to save medication schedule' : 'Gagal menyimpan jadwal obat'));
    } finally {
      setSaving(false);
    }
  };

  const handleStopMedication = async (med) => {
    const confirmMsg =
      lang === 'id'
        ? `Nonaktifkan jadwal pengingat untuk ${localize(med.name)}? Riwayat konsumsi tetap tersimpan.`
        : `Stop reminders for ${localize(med.name)}? Dose history will be preserved.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.deleteMedication(med.id);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {t.common.loading}
      </div>
    );
  }

  const activeMeds = medications.filter((m) => m.active);
  const inactiveMeds = medications.filter((m) => !m.active);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
      {/* Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t.patient.myMedsTitle}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t.patient.myMedsSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              triggerAlarm({
                medication: localize(activeMeds[0]?.name || 'Aspirin dosis rendah'),
                dosage: activeMeds[0]?.dosage || '80 mg',
                instructions: localize(activeMeds[0]?.instructions) || (lang === 'en' ? 'Take after meal' : 'Minum sesudah makan'),
                title: lang === 'id' ? 'Uji Alarm Obat 💊' : 'Medication Alarm Test 💊',
                message:
                  lang === 'id'
                    ? `Saatnya minum ${localize(activeMeds[0]?.name || 'Obat Anda')}`
                    : `Time to take ${localize(activeMeds[0]?.name || 'Your Medication')}`,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition"
          >
            <Bell className="w-4 h-4 text-amber-600" />
            <span>{lang === 'id' ? 'Uji Alarm' : 'Test Alarm'}</span>
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t.patient.addMedication}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition ${
            activeTab === 'schedule'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {lang === 'id'
            ? `Jadwal & Alarm Obat (${activeMeds.length})`
            : `Schedule & Alarms (${activeMeds.length})`}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition ${
            activeTab === 'history'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {lang === 'id'
            ? `Riwayat Penggunaan Obat (${dosesHistory.length})`
            : `Medication Use History (${dosesHistory.length})`}
        </button>
        <button
          onClick={() => setActiveTab('followups')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition ${
            activeTab === 'followups'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {lang === 'id'
            ? `Laporan & Evaluasi Apoteker (${followUps.length})`
            : `Pharmacist PTO Reports (${followUps.length})`}
        </button>
      </div>

      {/* TAB 1: Active Schedule & Alarms */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeMeds.map((med) => (
              <div
                key={med.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-teal-300 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                        <Pill className="w-5 h-5 transform -rotate-45" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg leading-tight">
                          {localize(med.name)}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {med.dosage && (
                            <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full">
                              {med.dosage}
                            </span>
                          )}
                          {med.form && (
                            <span className="text-xs text-slate-500">{med.form}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(med)}
                        className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                        title={t.common.edit}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStopMedication(med)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title={t.common.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {med.instructions && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1">
                      <span className="font-semibold block text-slate-900">
                        {t.patient.instructions}:
                      </span>
                      <p>{localize(med.instructions)}</p>
                    </div>
                  )}

                  {/* Scheduled alarm times pills */}
                  <div className="mt-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      {t.patient.scheduleTimes}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(med.times || []).map((time) => (
                        <span
                          key={time}
                          className="inline-flex items-center gap-1 text-xs font-bold text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200"
                        >
                          <Bell className="w-3 h-3 text-teal-600" />
                          {time}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {med.article && (
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <Link
                      to={`/education/${med.article.slug || med.article.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{t.patient.readGuide}</span>
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>

          {inactiveMeds.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                {lang === 'id' ? 'Obat yang Telah Selesai / Dihentikan' : 'Completed / Discontinued Medications'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-65">
                {inactiveMeds.map((med) => (
                  <div key={med.id} className="bg-slate-100 rounded-xl p-4 border border-slate-200">
                    <h4 className="font-semibold text-slate-700 text-sm">
                      {localize(med.name)} {med.dosage}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {lang === 'id' ? 'Status: Tidak aktif' : 'Status: Inactive'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Medication Use History */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          {/* Adherence per Medication Summary */}
          {adherence?.byMedication?.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'id' ? 'Ringkasan Kepatuhan per Obat (30 Hari)' : '30-Day Adherence by Medication'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {adherence.byMedication.map((m) => (
                  <div key={m.medicationId} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{m.name}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {lang === 'id'
                          ? `Diminum: ${m.TAKEN} • Dilewati: ${m.SKIPPED} • Terlewat: ${m.MISSED}`
                          : `Taken: ${m.TAKEN} • Skipped: ${m.SKIPPED} • Missed: ${m.MISSED}`}
                      </span>
                    </div>
                    <span className="font-extrabold text-sm text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                      {m.rate !== null ? `${Math.round(m.rate)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Period & Dose History List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {lang === 'id' ? 'Log Riwayat Penggunaan Obat' : 'Medication Consumption History Log'}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setHistoryDays(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      historyDays === d
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d} {lang === 'id' ? 'Hari' : 'Days'}
                  </button>
                ))}
              </div>
            </div>

            {dosesHistory.length === 0 ? (
              <p className="p-10 text-center text-xs text-slate-400">
                {lang === 'id' ? 'Belum ada riwayat penggunaan obat.' : 'No medication history recorded.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                {dosesHistory.map((d) => {
                  const schedStr = new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: user.timezone,
                  }).format(new Date(d.scheduledAt));
                  const delayMin =
                    d.status === 'TAKEN' && d.takenAt
                      ? Math.round((new Date(d.takenAt) - new Date(d.scheduledAt)) / 60000)
                      : null;

                  return (
                    <div key={d.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{localize(d.medication?.name)}</span>
                          {d.medication?.dosage && (
                            <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                              {d.medication.dosage}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {schedStr}
                          {delayMin !== null && delayMin > 0 ? ` • +${delayMin} ${lang === 'en' ? 'min' : 'mnt'}` : ''}
                        </p>
                        {d.note && <p className="text-xs italic text-slate-600 mt-1">"{localize(d.note)}"</p>}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                          d.status === 'TAKEN'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : d.status === 'SKIPPED'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : d.status === 'MISSED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {d.status === 'TAKEN' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {d.status === 'SKIPPED' && <XCircle className="w-3.5 h-3.5" />}
                        {d.status === 'MISSED' && <AlertCircle className="w-3.5 h-3.5" />}
                        <span>
                          {d.status === 'TAKEN'
                            ? t.patient.statusTaken
                            : d.status === 'SKIPPED'
                            ? t.patient.statusSkipped
                            : d.status === 'MISSED'
                            ? t.patient.statusMissed
                            : t.patient.statusPending}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Pharmacist Follow-Up & PTO Reports */}
      {activeTab === 'followups' && (
        <div className="space-y-4">
          {followUps.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center text-slate-400 text-sm">
              {lang === 'id'
                ? 'Belum ada laporan evaluasi farmakoterapi dari apoteker Anda.'
                : 'No pharmacotherapy evaluation reports from your pharmacist yet.'}
            </div>
          ) : (
            followUps.map((f) => (
              <div key={f.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-slate-900 text-sm">
                      {lang === 'id' ? 'Evaluasi Pemantauan Terapi Obat (PTO)' : 'Pharmacotherapy Monitoring Report'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {f.pharmacist?.name} • {new Date(f.createdAt).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US')}
                  </span>
                </div>

                {f.assessment && (
                  <div className="text-xs text-slate-700">
                    <strong className="text-slate-900 block mb-0.5">
                      {lang === 'id' ? 'Penilaian Apoteker (Assessment):' : 'Pharmacist Assessment:'}
                    </strong>
                    {localize(f.assessment)}
                  </div>
                )}

                <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-950 space-y-1">
                  <strong className="block">
                    {lang === 'id' ? 'Rencana Tindak Lanjut Terapi (Plan):' : 'Care Plan:'}
                  </strong>
                  <p className="whitespace-pre-line">{localize(f.plan)}</p>
                </div>

                {f.recommendation && (
                  <p className="text-xs text-slate-700">
                    <strong>{lang === 'id' ? 'Saran untuk Pasien:' : 'Patient Recommendation:'}</strong> {localize(f.recommendation)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add / Edit Medication Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              {editingMed
                ? (lang === 'id' ? 'Ubah Jadwal Pengobatan' : 'Edit Medication Schedule')
                : t.patient.addMedication}
            </h3>

            <form onSubmit={handleSaveMedication} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {lang === 'id' ? 'Nama Obat / Suplemen *' : 'Medication Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={medForm.name}
                  onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                  placeholder={lang === 'en' ? 'e.g., Low-dose Aspirin / Calcium' : 'Contoh: Aspirin dosis rendah / Kalsium'}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">{t.patient.dosage}</label>
                  <input
                    type="text"
                    value={medForm.dosage}
                    onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                    placeholder="500 mg"
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">{t.patient.form}</label>
                  <input
                    type="text"
                    value={medForm.form}
                    onChange={(e) => setMedForm({ ...medForm, form: e.target.value })}
                    placeholder={lang === 'en' ? 'Tablet / Capsule' : 'Tablet / Kapsul'}
                    className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {lang === 'id' ? 'Jam Alarm Obat (pisahkan koma, format HH:mm) *' : 'Alarm Times (comma-separated HH:mm) *'}
                </label>
                <input
                  type="text"
                  required
                  value={medForm.times}
                  onChange={(e) => setMedForm({ ...medForm, times: e.target.value })}
                  placeholder="07:00, 19:00"
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">{t.patient.instructions}</label>
                <input
                  type="text"
                  value={medForm.instructions}
                  onChange={(e) => setMedForm({ ...medForm, instructions: e.target.value })}
                  placeholder={lang === 'id' ? 'Diminum sesudah makan' : 'Take after meal'}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? t.common.loading : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
