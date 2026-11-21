const API_BASE = '/api';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('rara_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !endpoint.startsWith('/auth/login')) {
    localStorage.removeItem('rara_token');
    localStorage.removeItem('rara_user');
    window.location.href = '/login';
    throw new ApiError(401, 'Unauthorized');
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    if (!res.ok) throw new ApiError(res.status, 'Export failed');
    return res.blob();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'Request failed', data.details);
  }
  return data;
}

export const api = {
  // Auth
  login: (login, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => request('/auth/me'),
  updateMe: (data) => request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  // Patients & Pharmacist Dashboard Analytics
  getPatients: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/patients${q ? `?${q}` : ''}`);
  },
  getDashboardSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/patients/dashboard-summary${q ? `?${q}` : ''}`);
  },
  createPatient: (data) => request('/patients', { method: 'POST', body: JSON.stringify(data) }),
  getPatient: (id) => request(`/patients/${id}`),
  updatePatient: (id, data) => request(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetPatientPassword: (id, password) =>
    request(`/patients/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  getAdherence: (id, days = 30) => request(`/patients/${id}/adherence?days=${days}`),

  // Blood pressure monitoring
  getBloodPressures: (patientId = 'me', days = 30, limit = 60) =>
    request(`/patients/${patientId}/blood-pressure?days=${days}&limit=${limit}`),
  recordBloodPressure: (patientId, data) =>
    request(`/patients/${patientId}/blood-pressure`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteBloodPressure: (id) =>
    request(`/blood-pressure/${id}`, { method: 'DELETE' }),

  // Other Health Parameters & Check-Up Reminders (Section B)
  getHealthParameters: (patientId = 'me', params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/patients/${patientId}/health-parameters${q ? `?${q}` : ''}`);
  },
  recordHealthParameter: (patientId, data) =>
    request(`/patients/${patientId}/health-parameters`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteHealthParameter: (id) =>
    request(`/health-parameters/${id}`, { method: 'DELETE' }),

  getCheckups: (patientId = 'me') =>
    request(`/patients/${patientId}/checkups`),
  createCheckup: (patientId, data) =>
    request(`/patients/${patientId}/checkups`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCheckup: (id, data) =>
    request(`/checkups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCheckup: (id) =>
    request(`/checkups/${id}`, { method: 'DELETE' }),

  // Doses & Medications
  getDoses: (patientId = 'me', from, to) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString();
    return request(`/patients/${patientId}/doses${q ? `?${q}` : ''}`);
  },
  updateDoseStatus: (doseId, status, note) =>
    request(`/doses/${doseId}`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),

  getMedications: (patientId = 'me', all = false) =>
    request(`/patients/${patientId}/medications${all ? '?all=1' : ''}`),
  createMedication: (patientId, data) =>
    request(`/patients/${patientId}/medications`, { method: 'POST', body: JSON.stringify(data) }),
  updateMedication: (id, data) =>
    request(`/medications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMedication: (id) =>
    request(`/medications/${id}`, { method: 'DELETE' }),

  // Follow-ups & Pharmacotherapy Monitoring Reports (PTO)
  getFollowUps: (patientId = 'me') =>
    request(`/patients/${patientId}/follow-ups`),
  createFollowUp: (patientId, data) =>
    request(`/patients/${patientId}/follow-ups`, { method: 'POST', body: JSON.stringify(data) }),
  deleteFollowUp: (id) =>
    request(`/follow-ups/${id}`, { method: 'DELETE' }),

  // WhatsApp Integration (Patient-scoped)
  getPatientWhatsAppLogs: (patientId = 'me') =>
    request(`/patients/${patientId}/whatsapp-logs`),
  sendPatientWhatsApp: (patientId, data) =>
    request(`/patients/${patientId}/whatsapp-send`, { method: 'POST', body: JSON.stringify(data) }),

  // Pharmacy Services & Bookings
  getServices: (all = false) =>
    request(`/services${all ? '?all=1' : ''}`),
  createService: (data) =>
    request('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id, data) =>
    request(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteService: (id) =>
    request(`/services/${id}`, { method: 'DELETE' }),
  getServiceRequests: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/services/requests${q ? `?${q}` : ''}`);
  },
  createServiceRequest: (data) =>
    request('/services/requests', { method: 'POST', body: JSON.stringify(data) }),
  updateServiceRequest: (id, data) =>
    request(`/services/requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Chat & Messages
  getMessages: (patientId = 'me', limit = 50) =>
    request(`/patients/${patientId}/messages?limit=${limit}`),
  sendMessage: (patientId = 'me', body) =>
    request(`/patients/${patientId}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  markMessagesRead: (patientId = 'me') =>
    request(`/patients/${patientId}/messages/read`, { method: 'POST' }),
  getConversations: () => request('/conversations'),

  // Educational Articles & Videos
  getArticles: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/articles${q ? `?${q}` : ''}`);
  },
  getArticle: (key) => request(`/articles/${key}`),
  createArticle: (data) => request('/articles', { method: 'POST', body: JSON.stringify(data) }),
  updateArticle: (id, data) => request(`/articles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteArticle: (id) => request(`/articles/${id}`, { method: 'DELETE' }),

  // Questionnaires
  getQuestionnaires: (all = false) => request(`/questionnaires${all ? '?all=1' : ''}`),
  getQuestionnaire: (id) => request(`/questionnaires/${id}`),
  submitQuestionnaire: (id, answers) =>
    request(`/questionnaires/${id}/responses`, { method: 'POST', body: JSON.stringify({ answers }) }),
  getPatientResponses: (patientId = 'me') =>
    request(`/patients/${patientId}/responses`),
  getQuestionnaireResponses: (id) =>
    request(`/questionnaires/${id}/responses`),

  // Push notifications
  getVapidKey: () => request('/push/public-key'),
  subscribePush: (subscription) => request('/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
  unsubscribePush: (endpoint) => request('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),
  testPush: () => request('/push/test', { method: 'POST' }),

  // Staff & Admin Management
  getStaffList: () => request('/users/staff'),
  getAdminOverview: () => request('/admin/overview'),
  getAdminUsers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/users${q ? `?${q}` : ''}`);
  },
  createAdminUser: (data) =>
    request('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminUser: (id, data) =>
    request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  verifyPharmacist: (userId, data) =>
    request(`/admin/pharmacists/${userId}/verify`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAdminSystem: () => request('/admin/system'),
  updateSystemConfig: (data) =>
    request('/admin/system/config', { method: 'PUT', body: JSON.stringify(data) }),
  sendAdminWhatsApp: (data) =>
    request('/admin/whatsapp/send', { method: 'POST', body: JSON.stringify(data) }),

  // Authenticated CSV export download (never puts JWT in URL query)
  downloadExport: async (type, params = {}) => {
    const q = new URLSearchParams(params).toString();
    const blob = await request(`/export/${type}.csv${q ? `?${q}` : ''}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dosemate-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
