import { useState } from 'react';
import { FileSpreadsheet, Download, ShieldCheck, Users, Pill, ClipboardList, MessageSquare, Check, HeartPulse } from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';

export default function ResearchExport() {
  const { t } = useLanguage();
  const [anonymize, setAnonymize] = useState(true);
  const [downloading, setDownloading] = useState({});

  const handleDownload = async (type) => {
    setDownloading((prev) => ({ ...prev, [type]: true }));
    try {
      await api.downloadExport(type, { anonymize: anonymize ? '1' : '0' });
    } catch (err) {
      alert(err.message || 'Gagal mengunduh berkas');
    } finally {
      setDownloading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const exports = [
    {
      id: 'patients',
      title: 'Dataset Partisipan Pasien (patients.csv)',
      desc: 'Kode studi, kelompok intervensi/kontrol, demografi, HPL, faktor risiko preeklampsia, tekanan darah awal, kepatuhan 7/30 hari, dan proporsi tekanan darah terkontrol.',
      icon: Users,
      color: 'teal',
    },
    {
      id: 'blood-pressure',
      title: 'Log Tekanan Darah (blood-pressure.csv)',
      desc: 'Seluruh pengukuran sistolik, diastolik, nadi, MAP, klasifikasi, status <140/90 mmHg, sumber mandiri/klinik, dan catatan untuk analisis luaran.',
      icon: HeartPulse,
      color: 'rose',
    },
    {
      id: 'doses',
      title: 'Log Kepatuhan & Konfirmasi Dosis (doses.csv)',
      desc: 'Setiap butir jadwal minum obat, jam terjadwal, status (diminum/lewat/lupa), jam konfirmasi, serta deviasi keterlambatan dalam menit.',
      icon: Pill,
      color: 'emerald',
    },
    {
      id: 'follow-ups',
      title: 'Laporan Pemantauan Farmakoterapi / PTO & Tindak Lanjut (follow-ups.csv)',
      desc: 'Seluruh rekam evaluasi SOAP (Subjective, Objective, Assessment, Plan), kategori masalah terapi obat (DRP), rekomendasi apoteker, dan jadwal tindak lanjut.',
      icon: FileSpreadsheet,
      color: 'teal',
    },
    {
      id: 'responses',
      title: 'Hasil Kuesioner Penelitian (responses.csv)',
      desc: 'Data jawaban kuesioner terperinci per pertanyaan (misal ADHERENCE-8, survei pengetahuan obat pre/post) beserta perhitungan total skor.',
      icon: ClipboardList,
      color: 'indigo',
    },
    {
      id: 'messages',
      title: 'Transkrip Konsultasi Farmasi (messages.csv)',
      desc: 'Riwayat percakapan konsultasi chat antara pasien dan tim apoteker untuk evaluasi frekuensi dan jenis intervensi farmasi klinis.',
      icon: MessageSquare,
      color: 'amber',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.staff.exportTitle}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t.staff.exportSubtitle}
        </p>
      </div>

      {/* Ethics / Anonymization Toggle Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Protokol Kelaikan Etik Penelitian (Bioethics Anonymization)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Saat diaktifkan, data pribadi pasien (Nama asli, Nomor WhatsApp/HP, dan Alamat email) akan dihilangkan dan diganti dengan Kode Studi Samaran (seperti P-001, P-002) untuk menjaga kerahasiaan subjek penelitian.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={anonymize}
              onChange={(e) => setAnonymize(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600" />
          </label>
        </div>

        <div className="pt-2 text-xs font-semibold text-teal-800 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          Status:{' '}
          {anonymize
            ? 'Anonim (Aman untuk publikasi tesis / jurnal ilmiah)'
            : 'Lengkap dengan Identitas Pasien'}
        </div>
      </div>

      {/* Export List */}
      <div className="space-y-4">
        {exports.map((item) => {
          const Icon = item.icon;
          const isBusy = downloading[item.id];

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-teal-300 transition"
            >
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDownload(item.id)}
                disabled={isBusy}
                className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition shrink-0 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isBusy ? t.common.loading : 'Unduh CSV'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
