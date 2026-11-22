export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let inMemoryAccessToken: string | null = null;
let activeTenantHeader: string | null = null;

export function setSessionTokens(accessToken: string | null, tenantId?: string | null) {
  inMemoryAccessToken = accessToken;
  if (tenantId !== undefined) activeTenantHeader = tenantId;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `dm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function rawFetch(endpoint: string, options: RequestInit = {}, retryOn401 = true): Promise<Response> {
  const isMutation = ['POST', 'PUT', 'PATCH'].includes((options.method || 'GET').toUpperCase());
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(inMemoryAccessToken ? { Authorization: `Bearer ${inMemoryAccessToken}` } : {}),
    ...(activeTenantHeader ? { 'X-Tenant-Id': activeTenantHeader } : {}),
    ...(isMutation ? { 'Idempotency-Key': createIdempotencyKey() } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    credentials: 'include', // Uses HttpOnly cookies on Web; seamlessly works alongside Bearer
    headers,
  });

  // Silent refresh token rotation on 401
  if (res.status === 401 && retryOn401 && !endpoint.startsWith('/auth/')) {
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (refreshRes.ok) {
      const refreshed = (await refreshRes.json()) as { accessToken?: string };
      if (refreshed.accessToken) {
        inMemoryAccessToken = refreshed.accessToken;
      }
      return rawFetch(endpoint, options, false);
    }
  }

  return res;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await rawFetch(endpoint, options);
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    if (!res.ok) throw new ApiError(res.status, 'EXPORT_FAILED', 'CSV export failed');
    return (await res.blob()) as unknown as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.code || 'INTERNAL_ERROR', data.message || 'Request failed', data.details);
  }
  return data as T;
}

export const api = {
  // Auth
  login: (payload: { login: string; password: string }) =>
    request<{ accessToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ ...payload, transport: 'cookie' }),
    }),
  register: (payload: Record<string, unknown>) =>
    request<{ accessToken: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: '{}' }),
  getMe: () => request<{ user: AuthUser }>('/auth/me'),
  updateMe: (data: Record<string, unknown>) =>
    request<{ user: Partial<AuthUser> }>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMe: () => request<{ ok: boolean }>('/auth/me', { method: 'DELETE' }),

  // Tenants & QR Invite
  getCurrentTenant: () => request<{ tenant: TenantInfo }>('/tenants/current'),
  joinByInvite: (inviteCode: string) =>
    request<{ enrollment: unknown }>('/tenants/join-by-invite', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    }),

  // Patients & Pharmacist Dashboard
  getDashboardSummary: (days: 7 | 30 = 7, mine = false) =>
    request<DashboardSummary>(`/patients/dashboard-summary?days=${days}&mine=${mine ? '1' : '0'}`),
  getPatients: (q = '', mine = false) =>
    request<{ patients: PatientRow[]; nextCursor: string | null }>(
      `/patients?${new URLSearchParams({ ...(q ? { q } : {}), mine: mine ? '1' : '0' }).toString()}`,
    ),
  getPatient: (id = 'me') => request<{ patient: PatientDetail }>(`/patients/${id}`),
  addCaregiver: (patientId: string, data: Record<string, unknown>) =>
    request<{ caregiver: unknown }>(`/patients/${patientId}/caregivers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Medications & Doses
  getMedications: (patientId = 'me', all = false) =>
    request<{ medications: MedicationItem[]; spacingWarnings: SpacingWarning[] }>(
      `/patients/${patientId}/medications?all=${all ? '1' : '0'}`,
    ),
  createMedication: (patientId: string, data: Record<string, unknown>) =>
    request<{ medication: MedicationItem; spacingWarnings: SpacingWarning[] }>(
      `/patients/${patientId}/medications`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
  versionMedication: (id: string, data: Record<string, unknown>) =>
    request<{ medication: MedicationItem }>(`/medications/${id}/version`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getDoses: (patientId = 'me', from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request<{ timezone: string; doses: DoseItem[] }>(`/patients/${patientId}/doses?${q.toString()}`);
  },
  confirmDose: (doseId: string, status: 'TAKEN' | 'SKIPPED' | 'PENDING', note?: string) =>
    request<{ dose: DoseItem }>(`/doses/${doseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note, clientConfirmedAt: new Date().toISOString() }),
    }),

  // Health Monitoring (Section B)
  getBloodPressures: (patientId = 'me', days = 30) =>
    request<BpResponse>(`/patients/${patientId}/blood-pressure?days=${days}`),
  recordBloodPressure: (patientId: string, data: Record<string, unknown>) =>
    request<{ log: BpLogItem }>(`/patients/${patientId}/blood-pressure`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  acknowledgeCriticalBp: (id: string) =>
    request<{ log: BpLogItem; responseSeconds: number }>(`/blood-pressure/${id}/acknowledge`, {
      method: 'POST',
      body: '{}',
    }),
  getHealthParameters: (patientId = 'me') =>
    request<{ logs: HealthParamItem[] }>(`/patients/${patientId}/health-parameters`),
  recordHealthParameter: (patientId: string, data: Record<string, unknown>) =>
    request<{ log: HealthParamItem }>(`/patients/${patientId}/health-parameters`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCheckups: (patientId = 'me') =>
    request<{ reminders: CheckupItem[] }>(`/patients/${patientId}/checkups`),
  createCheckup: (patientId: string, data: Record<string, unknown>) =>
    request<{ reminder: CheckupItem }>(`/patients/${patientId}/checkups`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCheckup: (id: string, data: Record<string, unknown>) =>
    request<{ reminder: CheckupItem }>(`/checkups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Education, Care Services & Chat
  getEducation: (params: { locale: string; mediaType?: 'ARTICLE' | 'VIDEO'; category?: string; q?: string }) => {
    const q = new URLSearchParams();
    q.set('locale', params.locale);
    if (params.mediaType) q.set('mediaType', params.mediaType);
    if (params.category) q.set('category', params.category);
    if (params.q) q.set('q', params.q);
    return request<{ articles: ArticleItem[]; categories: string[] }>(`/education?${q.toString()}`);
  },
  getServices: (locale: string) => request<{ services: ServiceItem[] }>(`/services?locale=${locale}`),
  getMessages: (patientId = 'me') => request<{ messages: ChatMessage[] }>(`/patients/${patientId}/messages`),
  sendMessage: (patientId: string, body: string) =>
    request<{ message: ChatMessage }>(`/patients/${patientId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  downloadExport: async (type: 'patients' | 'blood-pressure', anonymize = true) => {
    const blob = await request<Blob>(`/export/${type}.csv?anonymize=${anonymize ? '1' : '0'}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doselynx-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ---- Shared Frontend Response Interfaces ----
export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: string;
  locale: 'id' | 'en';
  timezone: string;
  privacyMode: boolean;
  whatsappOptIn?: boolean;
  patientProfileId: string | null;
  estimatedDueDate?: string | null;
  activeTenantId: string | null;
  enrollments?: Array<{
    id: string;
    tenant: { id: string; name: string; inviteCode: string };
    pharmacist: { id: string; name: string; phone: string | null } | null;
  }>;
  tenants?: Array<{ id: string; name: string; slug: string; role: string; inviteCode: string; currency: string }>;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  countryCode: string;
  defaultCurrency: string;
  quota?: { planCode: string; maxPatients: number; monthlyWaLimit: number; monthlyWaUsed: number };
}

export interface MedicationItem {
  id: string;
  displayName: string;
  activeIngredient: string | null;
  drugCode: string | null;
  dosage: string | null;
  form: string | null;
  instructions: string | null;
  times: string[];
  scheduleRule: { type: string; mealRelation: string };
  active: boolean;
}

export interface SpacingWarning {
  code: string;
  medA: string;
  medB: string;
  minGapMinutes: number;
  actualGapMinutes: number;
}

export interface DoseItem {
  id: string;
  localDate: string;
  localTime: string;
  scheduledAt: string;
  status: 'PENDING' | 'TAKEN' | 'SKIPPED' | 'MISSED';
  takenAt: string | null;
  medication: {
    id: string;
    displayName: string;
    dosage: string | null;
    form: string | null;
    instructions: string | null;
  };
}

export interface BpLogItem {
  id: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  measuredAt: string;
  note: string | null;
  source: string;
  category: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' | 'LOW';
  controlled: boolean;
  alertStatus: 'NONE' | 'PENDING_ACK' | 'ACKNOWLEDGED' | 'ESCALATED';
}

export interface BpResponse {
  citation: string;
  logs: BpLogItem[];
  summary: {
    count: number;
    controlRate: number | null;
    average: { systolic: number; diastolic: number } | null;
    latest: BpLogItem | null;
  };
}

export interface HealthParamItem {
  id: string;
  type: string;
  value: number;
  unit: string;
  note: string | null;
  measuredAt: string;
}

export interface CheckupItem {
  id: string;
  title: string;
  type: string;
  scheduledAt: string;
  location: string | null;
  notes: string | null;
  status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
}

export interface ArticleItem {
  id: string;
  slug: string;
  category: string;
  mediaType: 'ARTICLE' | 'VIDEO';
  coverImage: string | null;
  videoUrl: string | null;
  durationLabel: string | null;
  drugName: string | null;
  title: string;
  summary: string | null;
}

export interface ServiceItem {
  id: string;
  code: string;
  category: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  name: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  sender: { id: string; name: string; globalRole: string };
}

export interface PatientDetail {
  id: string;
  diagnosis: string | null;
  allergies: Array<{ id: string; substanceName: string; severity: string; reaction: string | null }>;
  caregivers: Array<{ id: string; inviteTarget: string; relationship: string; receiveCriticalAlerts: boolean }>;
  enrollments: Array<{
    id: string;
    tenant: { id: string; name: string; inviteCode: string };
    pharmacist: { id: string; name: string; phone: string | null } | null;
  }>;
}

export interface PatientRow {
  id: string;
  studyCode: string | null;
  diagnosis: string | null;
  user: { id: string; name: string; phone: string | null; email: string | null };
  activeMedications: number;
  adherence30: number | null;
  latestBloodPressure: {
    systolic: number;
    diastolic: number;
    category: string;
    alertStatus: string;
  } | null;
}

export interface DashboardSummary {
  tenantId: string;
  kpis: {
    totalPatients: number;
    activePatients: number;
    needsFollowUp: number;
    avgAdherence30d: number | null;
  };
  atRiskPatients: Array<{
    patientId: string;
    name: string;
    studyCode: string | null;
    adherence30: number | null;
    latestBp: { id: string; systolic: number; diastolic: number; category: string | null; alertStatus: string } | null;
  }>;
  trend: Array<{ date: string; adherenceRate: number | null; bpControlRate: number | null }>;
  recentActivity: Array<{
    id: string;
    kind: 'DOSE' | 'BP' | 'MESSAGE';
    patientId: string;
    patientName: string;
    detail: string;
    timestamp: string;
  }>;
}
