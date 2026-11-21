import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, HeartPulse, Info, Plus, ShieldAlert,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import { dateTimeInputInZone, localDateTimeToISO } from '../../utils/date';

const copy = {
  id: {
    title: 'Tekanan Darah',
    subtitle: 'Catat hasil pengukuran secara rutin agar tim apoteker dapat memantau perubahan tekanan darah Anda.',
    latest: 'Pengukuran terakhir',
    average: 'Rata-rata',
    control: 'Terkontrol',
    controlHint: 'Pengukuran <140/90 mmHg',
    formTitle: 'Tambah pengukuran',
    formHint: 'Duduk tenang selama 5 menit sebelum mengukur. Gunakan lengan yang sama.',
    systolic: 'Sistolik (mmHg)',
    diastolic: 'Diastolik (mmHg)',
    pulse: 'Denyut nadi (opsional)',
    measuredAt: 'Tanggal & waktu ukur',
    note: 'Catatan (opsional)',
    save: 'Simpan pengukuran',
    saving: 'Menyimpan...',
    history: 'Riwayat pengukuran',
    empty: 'Belum ada pengukuran pada periode ini.',
    trend: 'Tren 14 pengukuran terakhir',
    range: '30 hari',
    normal: 'Normal',
    elevated: 'Sedikit tinggi',
    high: 'Tinggi',
    critical: 'Sangat tinggi',
    low: 'Rendah',
    sourceSelf: 'Mandiri',
    sourceClinic: 'Klinik',
    criticalTitle: 'Tekanan darah sangat tinggi',
    criticalText: 'Segera hubungi tenaga kesehatan atau fasilitas kesehatan terdekat. Jangan menunggu sampai keluhan memburuk.',
    highTitle: 'Tekanan darah perlu ditinjau',
    highText: 'Hubungi dokter atau apoteker untuk evaluasi. Segera cari bantuan jika disertai sakit kepala berat, gangguan penglihatan, nyeri perut, atau sesak napas.',
    lowTitle: 'Tekanan darah rendah',
    lowText: 'Istirahat dan hubungi tenaga kesehatan jika Anda merasa pusing berat, lemas, atau nyaris pingsan.',
    safety: 'Catatan ini membantu pemantauan dan bukan pengganti pemeriksaan dokter.',
    error: 'Pengukuran belum dapat disimpan.',
  },
  en: {
    title: 'Blood Pressure',
    subtitle: 'Record regular measurements so your pharmacist can follow changes in your blood pressure.',
    latest: 'Latest reading',
    average: 'Average',
    control: 'Controlled',
    controlHint: 'Readings below 140/90 mmHg',
    formTitle: 'Add a measurement',
    formHint: 'Rest quietly for 5 minutes before measuring. Use the same arm each time.',
    systolic: 'Systolic (mmHg)',
    diastolic: 'Diastolic (mmHg)',
    pulse: 'Pulse (optional)',
    measuredAt: 'Date & time',
    note: 'Note (optional)',
    save: 'Save reading',
    saving: 'Saving...',
    history: 'Measurement history',
    empty: 'No readings in this period.',
    trend: 'Last 14 readings',
    range: '30 days',
    normal: 'Normal',
    elevated: 'Elevated',
    high: 'High',
    critical: 'Very high',
    low: 'Low',
    sourceSelf: 'Self',
    sourceClinic: 'Clinic',
    criticalTitle: 'Very high blood pressure',
    criticalText: 'Contact a healthcare professional or the nearest health facility now. Do not wait for symptoms to worsen.',
    highTitle: 'Blood pressure needs review',
    highText: 'Contact your doctor or pharmacist. Seek help immediately with a severe headache, vision changes, abdominal pain, or shortness of breath.',
    lowTitle: 'Low blood pressure',
    lowText: 'Rest and contact a healthcare professional if you feel very dizzy, weak, or close to fainting.',
    safety: 'This record supports monitoring and does not replace assessment by a healthcare professional.',
    error: 'The reading could not be saved.',
  },
};

const categoryStyle = {
  NORMAL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ELEVATED: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
  LOW: 'bg-sky-50 text-sky-700 border-sky-200',
};

function PressureChart({ logs, text, timeZone }) {
  const points = [...logs].sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)).slice(-14);
  if (points.length < 2) return null;

  const width = 660;
  const height = 210;
  const pad = { top: 18, right: 18, bottom: 28, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const minY = 50;
  const maxY = 180;
  const x = (index) => pad.left + (plotW * index) / Math.max(points.length - 1, 1);
  const y = (value) => pad.top + ((maxY - value) / (maxY - minY)) * plotH;
  const path = (key) => points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point[key])}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[560px] w-full" role="img" aria-label={text.trend}>
        {[60, 90, 120, 150, 180].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} y1={y(tick)} x2={width - pad.right} y2={y(tick)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.left - 9} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#64748b">{tick}</text>
          </g>
        ))}
        <line x1={pad.left} y1={y(140)} x2={width - pad.right} y2={y(140)} stroke="#fb923c" strokeDasharray="6 5" strokeWidth="1.5" />
        <line x1={pad.left} y1={y(90)} x2={width - pad.right} y2={y(90)} stroke="#38bdf8" strokeDasharray="6 5" strokeWidth="1.5" />
        <path d={path('systolic')} fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path('diastolic')} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.id}>
            <circle cx={x(index)} cy={y(point.systolic)} r="4" fill="#fff" stroke="#dc2626" strokeWidth="2.5" />
            <circle cx={x(index)} cy={y(point.diastolic)} r="4" fill="#fff" stroke="#0f766e" strokeWidth="2.5" />
            <text x={x(index)} y={height - 8} textAnchor="middle" fontSize="9" fill="#64748b">
              {new Intl.DateTimeFormat(undefined, { timeZone, day: '2-digit', month: 'short' }).format(new Date(point.measuredAt))}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-center gap-5 text-[11px] font-semibold text-slate-600 -mt-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-rose-600 rounded" />{text.systolic.replace(' (mmHg)', '')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-teal-700 rounded" />{text.diastolic.replace(' (mmHg)', '')}</span>
      </div>
    </div>
  );
}

export default function BloodPressure() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { socket } = useSocket();
  const text = copy[lang] || copy.id;
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    systolic: '',
    diastolic: '',
    pulse: '',
    measuredAt: dateTimeInputInZone(new Date(), user.timezone),
    note: '',
  });

  const load = useCallback(async () => {
    try {
      const data = await api.getBloodPressures('me', 30, 60);
      setLogs(data.logs || []);
      setSummary(data.summary);
      setError('');
    } catch (err) {
      setError(err.message || text.error);
    } finally {
      setLoading(false);
    }
  }, [text.error]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onChange = () => load();
    socket.on('blood-pressure:changed', onChange);
    return () => socket.off('blood-pressure:changed', onChange);
  }, [socket, load]);

  const latest = summary?.latest;
  const alert = useMemo(() => {
    if (!latest) return null;
    if (latest.category === 'CRITICAL') return { title: text.criticalTitle, message: text.criticalText, tone: 'critical' };
    if (latest.category === 'HIGH') return { title: text.highTitle, message: text.highText, tone: 'high' };
    if (latest.category === 'LOW') return { title: text.lowTitle, message: text.lowText, tone: 'low' };
    return null;
  }, [latest, text]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.recordBloodPressure('me', {
        systolic: Number(form.systolic),
        diastolic: Number(form.diastolic),
        pulse: form.pulse ? Number(form.pulse) : undefined,
        measuredAt: localDateTimeToISO(form.measuredAt, user.timezone),
        note: form.note || undefined,
      });
      setForm({
        systolic: '',
        diastolic: '',
        pulse: '',
        measuredAt: dateTimeInputInZone(new Date(), user.timezone),
        note: '',
      });
      await load();
    } catch (err) {
      setError(err.message || text.error);
    } finally {
      setSaving(false);
    }
  };

  const label = (category) => text[category.toLowerCase()] || category;

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Memuat data tekanan darah...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-teal-700 text-xs font-bold uppercase tracking-[0.16em]">
          <Activity className="w-4 h-4" /> {text.range}
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{text.title}</h1>
        <p className="mt-1 text-sm text-slate-500 max-w-2xl">{text.subtitle}</p>
      </div>

      {alert && (
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${
          alert.tone === 'critical'
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : alert.tone === 'low'
              ? 'bg-sky-50 border-sky-200 text-sky-900'
              : 'bg-orange-50 border-orange-200 text-orange-900'
        }`}>
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">{alert.title}</p>
            <p className="text-xs mt-1 leading-relaxed">{alert.message}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{text.latest}</span>
            <HeartPulse className="w-5 h-5 text-rose-500" />
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{latest ? latest.systolic : '—'}</span>
            <span className="text-2xl font-bold text-slate-300 pb-0.5">/</span>
            <span className="text-3xl font-extrabold text-slate-900">{latest ? latest.diastolic : '—'}</span>
            <span className="text-xs text-slate-500 pb-1.5">mmHg</span>
          </div>
          {latest && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className={`text-[11px] font-bold border rounded-full px-2.5 py-1 ${categoryStyle[latest.category]}`}>
                {label(latest.category)}
              </span>
              <span className="text-[11px] text-slate-400">
                {new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', {
                  timeZone: user.timezone,
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(latest.measuredAt))}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{text.average}</span>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {summary?.average ? `${summary.average.systolic}/${summary.average.diastolic}` : '—'}
            <span className="text-xs font-medium text-slate-400 ml-2">mmHg</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">{summary?.count || 0} {text.range}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{text.control}</span>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-3xl font-extrabold text-teal-700">
              {summary?.controlRate == null ? '—' : `${summary.controlRate}%`}
            </span>
            {summary?.controlRate >= 80 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          </div>
          <p className="mt-3 text-xs text-slate-500">{text.controlHint}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form onSubmit={submit} className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-slate-900">{text.formTitle}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{text.formHint}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{text.systolic}</span>
              <input
                type="number"
                inputMode="numeric"
                min="60"
                max="260"
                required
                value={form.systolic}
                onChange={(event) => setForm({ ...form, systolic: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{text.diastolic}</span>
              <input
                type="number"
                inputMode="numeric"
                min="30"
                max="160"
                required
                value={form.diastolic}
                onChange={(event) => setForm({ ...form, diastolic: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{text.pulse}</span>
            <input
              type="number"
              inputMode="numeric"
              min="30"
              max="220"
              value={form.pulse}
              onChange={(event) => setForm({ ...form, pulse: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{text.measuredAt}</span>
            <input
              type="datetime-local"
              required
              value={form.measuredAt}
              onChange={(event) => setForm({ ...form, measuredAt: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{text.note}</span>
            <textarea
              rows="2"
              maxLength="500"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition disabled:opacity-50"
          >
            {saving ? text.saving : text.save}
          </button>

          <p className="text-[11px] leading-relaxed text-slate-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {text.safety}
          </p>
        </form>

        <div className="lg:col-span-3 space-y-6">
          {logs.length >= 2 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-bold text-slate-900 mb-2">{text.trend}</h2>
              <PressureChart logs={logs} text={text} timeZone={user.timezone} />
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">{text.history}</h2>
              <span className="text-xs text-slate-400">{logs.length}</span>
            </div>
            {logs.length === 0 ? (
              <div className="px-5 py-14 text-center text-sm text-slate-400">
                <HeartPulse className="w-9 h-9 mx-auto mb-2 text-slate-200" />
                {text.empty}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      log.category === 'NORMAL' ? 'bg-emerald-500'
                        : log.category === 'ELEVATED' ? 'bg-amber-500'
                          : log.category === 'LOW' ? 'bg-sky-500' : 'bg-rose-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-extrabold text-slate-900">{log.systolic}/{log.diastolic}</span>
                        <span className="text-[11px] text-slate-400">mmHg</span>
                        {log.pulse && <span className="text-[11px] text-slate-500 ml-1">{log.pulse} bpm</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        {new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', {
                          timeZone: user.timezone,
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(log.measuredAt))}
                        <span>·</span>
                        <span>{log.source === 'CLINIC' ? text.sourceClinic : text.sourceSelf}</span>
                      </div>
                      {log.note && <p className="text-xs text-slate-500 mt-1 truncate">{log.note}</p>}
                    </div>
                    <span className={`text-[10px] font-bold border rounded-full px-2 py-1 shrink-0 ${categoryStyle[log.category]}`}>
                      {label(log.category)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
