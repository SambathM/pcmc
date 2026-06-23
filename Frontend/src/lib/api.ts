const API_BASE = '/api';
const TG_BASE = '/telegram';
const TOKEN_KEY = 'pcmc_access_token';

// ---- Token storage ----

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ---- Internal HTTP clients ----

async function request<T>(url: string, options: RequestInit = {}, _skipRenew = false): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { ...options, headers });

  // Auto-renew on 401 (expired access token) — retry once with fresh token
  if (res.status === 401 && !_skipRenew && getStoredToken()) {
    try {
      const renewed = await request<RequestResponse>(`${API_BASE}/token/renew`, {}, true);
      if (renewed?.status && renewed.message) {
        setStoredToken(renewed.message);
        return request<T>(url, options, true);
      }
    } catch {
      // renewal failed — fall through and surface the 401
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}: ${res.statusText}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// Multipart form data — no Content-Type header (browser sets it with the boundary)
async function requestForm<T>(url: string, method: string, formData: FormData, _skipRenew = false): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { method, headers, body: formData });

  if (res.status === 401 && !_skipRenew && getStoredToken()) {
    try {
      const renewed = await request<RequestResponse>(`${API_BASE}/token/renew`, {}, true);
      if (renewed?.status && renewed.message) {
        setStoredToken(renewed.message);
        return requestForm<T>(url, method, formData, true);
      }
    } catch {
      // renewal failed — fall through
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}: ${res.statusText}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ---- Types ----

export interface LoginResult {
  status: boolean;
  code: number;
  message?: string;
  error?: string;
  tokens?: {
    sessionId?: string;
    accessToken: string;
    refreshToken: string;
  };
}

export interface TgQrCodeResponse {
  status: number;
  instanceId: string;
  qrCode: string;
}

export interface RequestResponse {
  status: boolean;
  message: string;
}

export interface PhoneLoginState {
  message?: string;
  state: number; // 0 = code sent, 1 = 2FA needed
}

export interface TelegramSession {
  id: number;
  code?: string;
  phoneNumber?: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  countryCode?: string;
  isAuthorized: boolean;
  profilePhoto?: string;
  authRestart: boolean;
  lastUpdatedOn: string;
  lastLoadContacts?: string;
}

export interface TelegramSessionContact {
  id: number;
  firstName?: string;
  lastName?: string;
}

export interface TelegramContactItem {
  id: number;
  firstName?: string;
  lastName?: string;
  phone?: string;
  username?: string;
  profilePhoto?: string;
}

export interface TelegramSyncStatus {
  status: number;
  message?: string;
  data?: string; // photo URL on success
}

export interface PcmcPropertyTelegramSession {
  id: number;
  firstName?: string;
  lastName?: string;
  userName?: string;
  phoneNumber?: string;
  profilePhoto?: string;
  isAuthorized: boolean;
}

export interface PcmcProperty {
  id: number;
  name: string;
  code?: string;
  logo?: string;
  assignedTelegramSessionId?: number;
  assignedTelegramSession?: PcmcPropertyTelegramSession;
  lastReminderActivity?: string;
  residentsCount: number;
  outstandingBalance: number;
}

export interface PcmcCustomer {
  id: number;
  code: string;
  name: string;
  unit?: string;
  phone?: string;
  telegram?: string;
  email?: string;
  avatar?: string;
  telegramSessionContactId?: number;
  profilePhoto?: string;
  locationId: number;
  locationName?: string;
  isActive: boolean;
  chatImported: boolean;
  joinDate: string;
}

// ---- AuthService ----

class AuthService {
  async login(username: string, password: string): Promise<LoginResult> {
    const result = await request<LoginResult>(`${API_BASE}/login/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (result.status && result.tokens?.accessToken) {
      setStoredToken(result.tokens.accessToken);
    }
    return result;
  }

  // /api/token/renew — despite the name, this endpoint issues a fresh access token from the session.
  async renewAccessToken(): Promise<void> {
    const result = await request<RequestResponse>(`${API_BASE}/token/renew`, {}, true);
    if (result?.status && result.message) {
      setStoredToken(result.message);
    }
  }
}

// ---- TelegramService ----

class TelegramService {
  async sessions(): Promise<TelegramSession[]> {
    return request<TelegramSession[]>(`${TG_BASE}/sessions`);
  }

  async session(): Promise<TelegramSession | null> {
    return request<TelegramSession | null>(`${TG_BASE}/session`);
  }

  async startup(): Promise<void> {
    return request<void>(`${TG_BASE}/session/startup`);
  }

  async disconnect(): Promise<void> {
    return request<void>(`${TG_BASE}/disconnect`);
  }

  async lastAccount(): Promise<TelegramSession | null> {
    return request<TelegramSession | null>(`${TG_BASE}/GetLastAccountTlg`);
  }

  async qrCode(): Promise<TgQrCodeResponse> {
    return request<TgQrCodeResponse>(`${TG_BASE}/qrCode`);
  }

  async submitQrPassword(password: string, instanceId: string): Promise<RequestResponse> {
    return request<RequestResponse>(`${TG_BASE}/inputQrCodePassword`, {
      method: 'POST',
      body: JSON.stringify({ password, instanceId }),
    });
  }

  async loginPhone(phone: string): Promise<PhoneLoginState> {
    return request<PhoneLoginState>(`${TG_BASE}/loginPhone`, {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async submitPhoneCode(code: string): Promise<RequestResponse> {
    return request<RequestResponse>(`${TG_BASE}/loginPhoneCode`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async submitPhonePassword(password: string): Promise<RequestResponse> {
    return request<RequestResponse>(`${TG_BASE}/loginPhonePassword`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async contacts(): Promise<TelegramSessionContact[]> {
    return request<TelegramSessionContact[]>(`${TG_BASE}/contacts`);
  }

  async isAlertChangeNumber(phoneNumber: string): Promise<boolean> {
    return request<boolean>(`${TG_BASE}/IsAlertChangeNumber/${encodeURIComponent(phoneNumber)}`);
  }

  async clearSession(phone: string, userId: number): Promise<void> {
    return request<void>(`${TG_BASE}/clearSession/${encodeURIComponent(phone)}/${userId}`);
  }

  async sessionContacts(sessionId: number): Promise<TelegramContactItem[]> {
    return request<TelegramContactItem[]>(`${TG_BASE}/session/${sessionId}/contacts`);
  }

  async syncContactPhoto(contactId: number): Promise<TelegramSyncStatus> {
    return request<TelegramSyncStatus>(`${TG_BASE}/session-contact/${contactId}/sync-photo`, { method: 'POST' });
  }

  async clientId(): Promise<string> {
    const res = await request<RequestResponse>(`${TG_BASE}/client-id`);
    return res.message;
  }
}

// ---- PropertyService ----

class PropertyService {
  async list(): Promise<PcmcProperty[]> {
    return request<PcmcProperty[]>('/property');
  }

  async create(
    data: { name: string; code?: string; assignedTelegramSessionId?: number },
    logoFile?: File,
  ): Promise<PcmcProperty> {
    const fd = new FormData();
    fd.append('name', data.name);
    if (data.code) fd.append('code', data.code);
    if (data.assignedTelegramSessionId != null) fd.append('assignedTelegramSessionId', String(data.assignedTelegramSessionId));
    if (logoFile) fd.append('logoFile', logoFile, logoFile.name);
    const res = await requestForm<{ status: boolean; data: PcmcProperty }>('/property', 'POST', fd);
    return res.data;
  }

  async update(
    id: number,
    data: { name?: string; code?: string; logo?: string; assignedTelegramSessionId?: number | null; lastReminderActivity?: string },
    logoFile?: File,
  ): Promise<PcmcProperty> {
    const fd = new FormData();
    if (data.name) fd.append('name', data.name);
    if (data.code !== undefined) fd.append('code', data.code ?? '');
    if (data.logo !== undefined) fd.append('logo', data.logo ?? '');
    if (data.lastReminderActivity) fd.append('lastReminderActivity', data.lastReminderActivity);
    // undefined = field absent (don't change); null = "" (unassign); number = assign
    if (data.assignedTelegramSessionId !== undefined)
      fd.append('assignedTelegramSessionId', data.assignedTelegramSessionId != null ? String(data.assignedTelegramSessionId) : '');
    if (logoFile) fd.append('logoFile', logoFile, logoFile.name);
    const res = await requestForm<{ status: boolean; data: PcmcProperty }>(`/property/${id}`, 'PUT', fd);
    return res.data;
  }

  async remove(id: number): Promise<void> {
    return request<void>(`/property/${id}`, { method: 'DELETE' });
  }
}

// ---- CustomerService ----

class CustomerService {
  async list(locationId?: number): Promise<PcmcCustomer[]> {
    const qs = locationId != null ? `?locationId=${locationId}` : '';
    return request<PcmcCustomer[]>(`/customer${qs}`);
  }

  async create(data: { code: string; name: string; unit?: string; phone?: string; telegramHandle?: string; email?: string; telegramSessionContactId?: number; locationId: number }): Promise<PcmcCustomer> {
    return request<PcmcCustomer>('/customer', { method: 'POST', body: JSON.stringify(data) });
  }

  async update(id: number, data: Partial<{ name: string; unit: string; phone: string; telegramHandle: string; email: string; avatar: string; chatImported: boolean }>): Promise<void> {
    return request<void>(`/customer/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async remove(id: number): Promise<void> {
    return request<void>(`/customer/${id}`, { method: 'DELETE' });
  }
}

// ---- ServiceService ----

export interface PcmcService {
  id: number;
  name: string;
  description?: string;
  reminderTemplate: string;
  activeResidents: number;
  outstandingAmount: number;
}

export interface PcmcCustomerServiceAssignment {
  id: number;
  customerId: number;
  assignedOn: string;
  customerCode: string;
  customerName: string;
  unit?: string;
}

class ServiceService {
  async list(): Promise<PcmcService[]> {
    return request<PcmcService[]>('/service');
  }

  async create(data: { name: string; description?: string; reminderTemplate?: string }): Promise<PcmcService> {
    return request<{ status: boolean; data: PcmcService }>('/service', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(r => r.data);
  }

  async update(id: number, data: { name?: string; description?: string; reminderTemplate?: string }): Promise<void> {
    return request<void>(`/service/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async remove(id: number): Promise<void> {
    return request<void>(`/service/${id}`, { method: 'DELETE' });
  }

  async getAssignedCustomers(serviceId: number): Promise<PcmcCustomerServiceAssignment[]> {
    return request<PcmcCustomerServiceAssignment[]>(`/service/${serviceId}/customers`);
  }

  async assignCustomers(serviceId: number, customerIds: number[]): Promise<{ status: boolean; assigned: number; skipped: number }> {
    return request(`/service/${serviceId}/customers`, {
      method: 'POST',
      body: JSON.stringify({ customerIds }),
    });
  }

  async unassignCustomer(serviceId: number, customerId: number): Promise<void> {
    return request<void>(`/service/${serviceId}/customers/${customerId}`, { method: 'DELETE' });
  }
}

// ---- BillService ----

export interface PcmcBillItem {
  id: number;
  residentCode: string;
  residentName: string;
  unit: string;
  service: string;
  amount: number;
  dueDate: string;
  status: string;
  autoSend: boolean;
  locationId: number;
  locationName: string;
  customerId?: number;
  paidDate?: string;
}

class BillService {
  async create(data: {
    residentCode: string;
    residentName: string;
    unit?: string;
    service?: string;
    amount: number;
    dueDate: string;
    status?: string;
    autoSend?: boolean;
    locationId: number;
    customerId?: number;
  }): Promise<number> {
    const res = await request<{ status: boolean; data: { id: number } }>('/bill', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data.id;
  }

  async list(filters?: { locationId?: number; status?: string; service?: string }): Promise<PcmcBillItem[]> {
    const params = new URLSearchParams();
    if (filters?.locationId != null) params.set('locationId', String(filters.locationId));
    if (filters?.status) params.set('status', filters.status);
    if (filters?.service) params.set('service', filters.service);
    const qs = params.toString();
    return request<PcmcBillItem[]>(`/bill${qs ? '?' + qs : ''}`);
  }

  async update(id: number, data: { autoSend?: boolean; status?: string }): Promise<void> {
    return request<void>(`/bill/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async remove(id: number): Promise<void> {
    return request<void>(`/bill/${id}`, { method: 'DELETE' });
  }
}

// ---- UploadService ----

class UploadService {
  async image(file: File): Promise<string> {
    const token = getStoredToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/upload/image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Upload failed: ${res.status}`);
    }
    const data = await res.json();
    return data.url as string;
  }
}

// ---- Singletons ----

export const authService = new AuthService();
export const telegramService = new TelegramService();
export const propertyService = new PropertyService();
export const customerService = new CustomerService();
export const serviceService = new ServiceService();
export const billService = new BillService();
export const uploadService = new UploadService();
