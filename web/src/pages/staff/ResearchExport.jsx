import { useState } from 'react';
import {
  FileSpreadsheet, Download, ShieldCheck, Users, Pill, ClipboardList,
  MessageSquare, HeartPulse, Activity
} from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function ResearchExport() {
  const { t, lang } = useLanguage();
  const [anonymize, setAnonymize] = useState(true);
  const [downloading, setDownloading] = useState({});

  const handleDownload = async (type) => {
    setDownloading((prev) => ({ ...prev, [type]: true }));
    try {
      await api.downloadExport(type, { anonymize: anonymize ? '1' : '0' });
    } catch (err) {
      alert(err.message || (lang === 'id' ? 'Gagal mengunduh berkas' : 'Failed to download file'));
    } finally {
      setDownloading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const exports = [
    {
      id: 'patients',
      title: lang === 'id' ? 'Dataset Partisipan Pasien (patients.csv)' : 'Patient Cohort Dataset (patients.csv)',
      desc: lang === 'id'
        ? 'Kode studi, kelompok intervensi/kontrol, demografi, HPL, faktor risiko, tekanan darah awal, kepatuhan 7/30 hari, dan kontrol TD.'
        : 'Study code, intervention/control arm, demographics, EDD, risk factors, baseline BP, 7/30-day adherence, and BP control rate.',
      icon: Users,
    },
    {
      id: 'blood-pressure',
      title: lang === 'id' ? 'Log Tekanan Darah (blood-pressure.csv)' : 'Blood Pressure Log (blood-pressure.csv)',
      desc: lang === 'id'
        ? 'Seluruh pengukuran sistolik, diastolik, nadi, MAP, klasifikasi triase, status <140/90 mmHg, sumber, dan catatan.'
        : 'All systolic, diastolic, pulse, MAP, triage classification, <140/90 mmHg control flag, source, and patient notes.',
      icon: HeartPulse,
    },
    {
      id: 'health-parameters',
      title: lang === 'id' ? 'Parameter Kesehatan Lain (health-parameters.csv)' : 'Other Health Parameters (health-parameters.csv)',
      desc: lang === 'id'
        ? 'Catatan berat badan, denyut nadi, SpO₂, suhu tubuh, gerakan janin, edema, dan parameter pemantauan lainnya.'
        : 'Body weight, resting heart rate, SpO₂, temperature, fetal movement, edema grade, and other health tracking logs.',
      icon: Activity,
    },
    {
      id: 'doses',
      title: lang === 'id' ? 'Log Kepatuhan & Konfirmasi Dosis (doses.csv)' : 'Medication Adherence & Dose Log (doses.csv)',
      desc: lang === 'id'
        ? 'Setiap jadwal minum obat, status (diminum/lewat/lupa), waktu konfirmasi aktual, serta deviasi keterlambatan dalam menit.'
        : 'Every scheduled dose, status (taken/skipped/missed), actual confirmation timestamp, and intake delay in minutes.',
      icon: Pill,
    },
    {
      id: 'follow-ups',
      title: lang === 'id' ? 'Laporan Pemantauan Farmakoterapi / PTO (follow-ups.csv)' : 'Pharmaceutical Care & PTO Reports (follow-ups.csv)',
      desc: lang === 'id'
        ? 'Rekam evaluasi SOAP, kategori masalah terapi obat (DRP), rekomendasi apoteker, dan jadwal tindak lanjut.'
        : 'SOAP clinical evaluations, Drug-Related Problem (DRP) categories, pharmacist recommendations, and follow-up schedules.',
      icon: FileSpreadsheet,
    },
    {
      id: 'responses',
      title: lang === 'id' ? 'Hasil Kuesioner Kepatuhan (responses.csv)' : 'Questionnaire Responses (responses.csv)',
      desc: lang === 'id'
        ? 'Data jawaban kuesioner per butir pertanyaan beserta total skor untuk analisis penelitian.'
        : 'Item-level questionnaire answers and computed total adherence scores for clinical & research analysis.',
      icon: ClipboardList,
    },
    {
      id: 'messages',
      title: lang === 'id' ? 'Transkrip Konsultasi Farmasi (messages.csv)' : 'Pharmacist Consultation Transcripts (messages.csv)',
      desc: lang === 'id'
        ? 'Riwayat percakapan konsultasi antara pasien dan apoteker untuk evaluasi layanan telefarmasi.'
        : 'Chat consultation logs between patients and clinical pharmacists for telepharmacy service review.',
      icon: MessageSquare,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.staff.exportTitle}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t.staff.exportSubtitle}</p>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">{t.staff.anonymizeTitle}</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{t.staff.anonymizeDesc}</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={anonymize}
              onChange={(e) => setAnonymize(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600" />
          </label>
        </div>

        <div className="pt-1 text-xs font-bold text-teal-800 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          <span>{anonymize ? t.staff.anonymizeOn : t.staff.anonymizeOff}</span>
        </div>
      </div>

      <div className="space-y-3.5">
        {exports.map((item) => {
          const Icon = item.icon;
          const isBusy = downloading[item.id];
          return (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-5 border border-teal-100/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-teal-300 transition"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">{item.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">{item.desc}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDownload(item.id)}
                disabled={isBusy}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-full text-xs font-bold shadow-sm transition shrink-0 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isBusy ? t.common.loading : t.staff.downloadCsv}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
