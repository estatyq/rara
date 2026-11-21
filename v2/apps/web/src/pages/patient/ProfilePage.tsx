import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, QrCode, Trash2, Users } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export default function ProfilePage() {
  const { t } = useTranslation(['patient', 'common', 'auth']);
  const { user, refreshUser, logout } = useAuth();
  const qc = useQueryClient();

  const [inviteCode, setInviteCode] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [relationship, setRelationship] = useState('Spouse / Family');

  const { data: detail } = useQuery({
    queryKey: ['patient', 'me'],
    queryFn: () => api.getPatient('me'),
  });

  const togglePrivacy = async () => {
    await api.updateMe({ privacyMode: !user?.privacyMode });
    await refreshUser();
    toast.success(t('common:save'));
  };

  const joinPharmacy = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.joinByInvite(inviteCode.trim());
      setInviteCode('');
      await refreshUser();
      await qc.invalidateQueries({ queryKey: ['patient', 'me'] });
      toast.success('Enrolled with pharmacy!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const inviteCaregiver = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.addCaregiver('me', { caregiverPhone, relationship });
      setCaregiverPhone('');
      await qc.invalidateQueries({ queryKey: ['patient', 'me'] });
      toast.success('Caregiver linked!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t('patient:deleteAccountDesc'))) return;
    await api.deleteMe();
    await logout();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm">
        <h1 className="text-xl font-extrabold text-slate-900">{user?.name}</h1>
        <p className="text-xs text-slate-500 mt-0.5">{user?.phone || user?.email} • {user?.timezone}</p>
      </div>

      {/* Lock-Screen PHI Privacy Toggle */}
      <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">{t('patient:privacyLockTitle')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('patient:privacyLockDesc')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void togglePrivacy()}
          className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition shrink-0 ${
            user?.privacyMode ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'
          }`}
        >
          {user?.privacyMode ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Pharmacy QR Invite Enrollment */}
      <form onSubmit={joinPharmacy} className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <QrCode className="w-5 h-5 text-teal-600" />
          <span>{t('auth:inviteCode')}</span>
        </div>
        <div className="flex gap-2">
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="DOSE-MKS-01"
            className="flex-1 px-4 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm font-mono"
          />
          <button type="submit" className="px-5 py-2.5 rounded-full bg-teal-600 text-white text-xs font-bold">
            {t('common:submit')}
          </button>
        </div>
        {(detail?.patient.enrollments ?? []).map((e) => (
          <div key={e.id} className="text-xs text-teal-800 bg-teal-50 px-3 py-2 rounded-xl font-semibold">
            ✓ {e.tenant.name} ({e.tenant.inviteCode})
          </div>
        ))}
      </form>

      {/* Caregiver / Family Mode */}
      <form onSubmit={inviteCaregiver} className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <Users className="w-5 h-5 text-teal-600" />
          <span>{t('patient:caregiverTitle')}</span>
        </div>
        <p className="text-xs text-slate-500">{t('patient:caregiverDesc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            value={caregiverPhone}
            onChange={(e) => setCaregiverPhone(e.target.value)}
            placeholder="+62812..."
            required
            className="px-4 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm"
          />
          <input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-[#F6FBFA] border border-teal-100 text-sm"
          />
        </div>
        <button type="submit" className="px-5 py-2.5 rounded-full bg-teal-600 text-white text-xs font-bold">
          {t('common:save')}
        </button>
        {(detail?.patient.caregivers ?? []).map((c) => (
          <div key={c.id} className="text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-xl">
            {c.relationship}: <strong>{c.inviteTarget}</strong>
          </div>
        ))}
      </form>

      {/* App Store Guideline 5.1.1 & UU PDP Self-Service Account Deletion */}
      <div className="bg-rose-50/70 rounded-3xl p-6 border border-rose-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold text-rose-900">{t('patient:deleteAccountTitle')}</h2>
          <p className="text-xs text-rose-700 mt-1">{t('patient:deleteAccountDesc')}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleDeleteAccount()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t('common:delete')}</span>
        </button>
      </div>
    </div>
  );
}
