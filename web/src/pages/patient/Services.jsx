import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope, HeartPulse, MessageSquare, Calendar, ShieldCheck, Clock,
  CheckCircle2, Plus, Phone, Award, Building2, AlertCircle
} from 'lucide-react';
import { api } from '../../api/client';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSocket } from '../../context/SocketContext';

const ICONS = {
  HeartPulse,
  MessageSquare,
  Calendar,
  ShieldCheck,
  Stethoscope,
};

export default function PatientServices() {
  const { lang } = useLanguage();
  const { socket } = useSocket();
  const [services, setServices] = useState([]);
  const [pharmacists, setPharmacists] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedService, setSelectedService] = useState(null);
  const [form, setForm] = useState({
    pharmacistId: '',
    preferredDate: '',
    complaint: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [svcRes, reqRes] = await Promise.all([
        api.getServices(false),
        api.getServiceRequests(),
      ]);
      setServices(svcRes.services || []);
      setPharmacists(svcRes.pharmacists || []);
      setRequests(reqRes.requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => loadData();
    socket.on('service:updated', onUpdate);
    return () => socket.off('service:updated', onUpdate);
  }, [socket, loadData]);

  const handleOpenBooking = (svc) => {
    setSelectedService(svc);
    setForm({
      pharmacistId: pharmacists[0]?.id || '',
      preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      complaint: '',
    });
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!selectedService) return;
    setSubmitting(true);
    try {
      await api.createServiceRequest({
        serviceId: selectedService.id,
        pharmacistId: form.pharmacistId || undefined,
        preferredDate: form.preferredDate || undefined,
        complaint: form.complaint || undefined,
      });
      setSelectedService(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Gagal mengajukan permintaan layanan');
    } finally {
      setSubmitting(false);
    }
  };

  const formatWaUrl = (phone, name) => {
    if (!phone) return null;
    let digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
    const text =
      lang === 'id'
        ? `Halo Apoteker ${name}, saya pasien DoseLynx ingin berkonsultasi mengenai terapi obat saya.`
        : `Hello Pharmacist ${name}, I am a DoseLynx patient and would like to consult about my medication.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        {lang === 'id' ? 'Memuat layanan farmasi...' : 'Loading pharmacy services...'}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-sm">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full">
          <Stethoscope className="w-3.5 h-3.5" />
          {lang === 'id' ? 'Layanan Kefarmasian Digital' : 'Digital Pharmacy Services'}
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
          {lang === 'id'
            ? 'Pilih Layanan Farmasi & Konsultasi Apoteker'
            : 'Pharmacy Services & Clinical Pharmacist Care'}
        </h1>
        <p className="text-teal-100 text-sm mt-1 max-w-2xl">
          {lang === 'id'
            ? 'Dapatkan layanan pemantauan terapi obat (PTO), rekonsiliasi jadwal minum obat, konseling kepatuhan, dan telefarmasi langsung bersama apoteker berlisensi resmi.'
            : 'Access pharmacotherapy monitoring (PTO), medication schedule reconciliation, adherence counseling, and telepharmacy with licensed clinical pharmacists.'}
        </p>
      </div>

      {/* Services Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900">
          {lang === 'id' ? 'Daftar Layanan Kefarmasian' : 'Available Pharmacy Services'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((svc) => {
            const IconComp = ICONS[svc.icon] || Stethoscope;
            return (
              <div
                key={svc.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-teal-300 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                          {svc.category}
                        </span>
                        <h3 className="font-bold text-slate-900 text-base mt-1 leading-snug">
                          {lang === 'id' ? svc.nameId : svc.nameEn}
                        </h3>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                    {lang === 'id' ? svc.descriptionId : svc.descriptionEn}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {svc.durationMinutes} {lang === 'id' ? 'menit' : 'mins'}
                    </span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {svc.priceIDR === 0
                        ? (lang === 'id' ? 'Gratis / Program Studi' : 'Free / Study Program')
                        : `Rp ${svc.priceIDR.toLocaleString('id-ID')}`}
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenBooking(svc)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'id' ? 'Ajukan Layanan' : 'Request Service'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verified Pharmacists Directory */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            {lang === 'id' ? 'Tim Apoteker Klinis Terverifikasi' : 'Verified Clinical Pharmacists'}
          </h2>
          <p className="text-xs text-slate-500">
            {lang === 'id'
              ? 'Setiap apoteker telah diverifikasi identitas dan kredensial resminya (STRA & SIPA).'
              : 'Every pharmacist has verified professional credentials and practice licenses (STRA & SIPA).'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pharmacists.map((ph) => {
            const prof = ph.pharmacistProfile;
            const isVerified = prof?.verificationStatus === 'VERIFIED';
            const waUrl = formatWaUrl(ph.phone, ph.name);
            return (
              <div key={ph.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white font-extrabold text-lg flex items-center justify-center">
                      {ph.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm">{ph.name}</h3>
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            {lang === 'id' ? 'Terverifikasi' : 'Verified'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-teal-700 font-semibold mt-0.5">
                        {prof?.specialization || (lang === 'id' ? 'Apoteker Klinis' : 'Clinical Pharmacist')}
                      </p>
                    </div>
                  </div>
                </div>

                {prof && (
                  <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1 border border-slate-100">
                    {prof.workplace && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{prof.workplace}</span>
                      </div>
                    )}
                    {prof.straNumber && (
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span><strong>STRA:</strong> {prof.straNumber}</span>
                      </div>
                    )}
                    {prof.sipaNumber && (
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span><strong>SIPA:</strong> {prof.sipaNumber}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Link
                    to="/chat"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{lang === 'id' ? 'Chat di Aplikasi' : 'In-App Chat'}</span>
                  </Link>
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Patient's Submitted Service Requests */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          {lang === 'id' ? 'Riwayat Permintaan Layanan Saya' : 'My Service Requests'}
        </h2>
        {requests.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            {lang === 'id'
              ? 'Belum ada permintaan layanan farmasi yang diajukan.'
              : 'No pharmacy service requests submitted yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">
                      {lang === 'id' ? r.service?.nameId : r.service?.nameEn}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {r.pharmacist?.name ? `Apoteker: ${r.pharmacist.name} • ` : ''}
                      {new Date(r.createdAt).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      r.status === 'CONFIRMED'
                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : r.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : r.status === 'CANCELLED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                {r.complaint && (
                  <p className="text-xs text-slate-700">
                    <strong>{lang === 'id' ? 'Keluhan / Catatan:' : 'Notes:'}</strong> {r.complaint}
                  </p>
                )}
                {r.pharmacistReply && (
                  <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg text-xs text-teal-900">
                    <strong>{lang === 'id' ? 'Tanggapan Apoteker:' : 'Pharmacist Response:'}</strong>{' '}
                    {r.pharmacistReply}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Service Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              {lang === 'id' ? selectedService.nameId : selectedService.nameEn}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'id' ? selectedService.descriptionId : selectedService.descriptionEn}
            </p>

            <form onSubmit={handleSubmitRequest} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {lang === 'id' ? 'Pilih Apoteker' : 'Select Pharmacist'}
                </label>
                <select
                  value={form.pharmacistId}
                  onChange={(e) => setForm({ ...form, pharmacistId: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  {pharmacists.map((ph) => (
                    <option key={ph.id} value={ph.id}>
                      {ph.name} {ph.pharmacistProfile?.verificationStatus === 'VERIFIED' ? '✓' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {lang === 'id' ? 'Waktu Konsultasi yang Diinginkan' : 'Preferred Date & Time'}
                </label>
                <input
                  type="datetime-local"
                  value={form.preferredDate}
                  onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  {lang === 'id' ? 'Keluhan / Pertanyaan Terapi Obat' : 'Medication Questions / Notes'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.complaint}
                  onChange={(e) => setForm({ ...form, complaint: e.target.value })}
                  placeholder={
                    lang === 'id'
                      ? 'Tuliskan obat yang sedang diminum, keluhan efek samping, atau jadwal yang ingin dikonsultasikan...'
                      : 'Describe your current medications, side effects, or schedule questions...'
                  }
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  {lang === 'id' ? 'Batal' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {submitting
                    ? (lang === 'id' ? 'Mengirim...' : 'Submitting...')
                    : (lang === 'id' ? 'Kirim Permintaan' : 'Submit Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
