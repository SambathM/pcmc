import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  LoginResult,
  RequestResponse,
  TelegramSession,
  TgQrCodeResponse,
  PhoneLoginState,
  TelegramContactItem,
  PcmcProperty,
  PcmcCustomer,
  PcmcService,
  PcmcBillItem,
  PcmcCustomerServiceAssignment,
  UnitItem,
  IApiToken,
  ReminderConfig,
  BillRule,
} from '../models/types';
import { environment } from '../../../environments/environment';
import { TokenHelper } from '../helpers/token-helper';

const API_BASE = `${environment.apiBaseUrl}/api`;
const TG_BASE = `${environment.apiBaseUrl}/telegram`;

@Injectable({ providedIn: 'root' })
export class ApiService {

  constructor(
    private readonly http: HttpClient,
  ) { }

  private get apiToken(): IApiToken | null {
    return TokenHelper.getToken();
  }

  private get accessToken(): string | null {
    const token = this.apiToken?.accessToken;
    return token ?? null;
  }

  private headers(extra: Record<string, string> = {}): HttpHeaders {
    const token = this.accessToken;
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    });
  }

  private async req<T>(url: string, options: {
    method?: string; body?: string; headers?: HttpHeaders
  } = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const headers = options.headers ?? this.headers();
    const obs = this.http.request<T>(method, url, {
      body: options.body,
      headers,
      responseType: 'json' as const,
    });
    return firstValueFrom(obs);
  }

  private authFormHeaders(): HttpHeaders {
    const token = this.accessToken;
    return new HttpHeaders({ ...(token ? { Authorization: `Bearer ${token}` } : {}) });
  }

  // ---- Auth ----
  async login(username: string, password: string): Promise<LoginResult> {
    const result = await this.req<LoginResult>(`${API_BASE}/login/login`, {
      method: 'POST', body: JSON.stringify({ username, password }),
    });
    if (result.status && result.tokens?.accessToken)
      TokenHelper.setToken(result.tokens);
    return result;
  }

  // Exchange the (HttpOnly) refresh token for a fresh access token. Returns true
  // when a new access token was issued, false when the refresh token is gone/invalid.
  // withCredentials lets the refresh cookie ride along on this cross-origin call.
  async renewAccessToken(): Promise<boolean> {
    try {
      const result = await firstValueFrom(
        this.http.get<RequestResponse>(`${API_BASE}/token/renew`, {
          headers: this.headers(
            {
              [environment.headers.XRefreshToken]: this.apiToken?.refreshToken ?? ''
            }),
          withCredentials: true,
        })
      );
      if (result?.status && result.message) {
        // Renew only returns a new access token — keep the existing refresh token so
        // the next expiry can renew again (otherwise the 2nd 401 would force re-login).
        TokenHelper.setToken({ accessToken: result.message, refreshToken: this.apiToken?.refreshToken ?? '' });
        return true;
      }
      return false;
    } catch (err) {
      // Only a 401 means the refresh token is genuinely invalid (→ caller logs in).
      // Network failure / 404 / 5xx is a server problem, not an expired session —
      // rethrow so the caller surfaces an error instead of logging the user out.
      if (err instanceof HttpErrorResponse && err.status === 401) return false;
      throw err;
    }
  }

  // Ends the current session server-side (deletes it + clears the auth cookies).
  // withCredentials lets the refresh cookie ride along and the Set-Cookie deletions
  // take effect; the bearer access token identifies the session when no cookie is sent.
  async logout(): Promise<void> {
    await firstValueFrom(
      this.http.post<RequestResponse>(`${API_BASE}/token/logout`, {}, {
        headers: this.headers(), withCredentials: true,
      })
    );
    TokenHelper.clearToken();
  }

  // ---- Telegram ----
  sessions() { return this.req<TelegramSession[]>(`${TG_BASE}/sessions`); }
  session() { return this.req<TelegramSession | null>(`${TG_BASE}/session`); }
  // Multi-session: poll the status of ONE login attempt by its instance id.
  // Returns the authorized session bound to that instance once login completes, else null.
  loginStatus(instanceId: string) { return this.req<TelegramSession | null>(`${TG_BASE}/loginStatus/${instanceId}`); }
  startup() { return this.req<void>(`${TG_BASE}/session/startup`); }
  disconnect() { return this.req<void>(`${TG_BASE}/disconnect`); }
  qrCode() { return this.req<TgQrCodeResponse>(`${TG_BASE}/qrCode`); }

  submitQrPassword(password: string, instanceId: string) {
    return this.req<RequestResponse>(`${TG_BASE}/inputQrCodePassword`, {
      method: 'POST', body: JSON.stringify({ password, instanceId }),
    });
  }

  loginPhone(phone: string) {
    return this.req<PhoneLoginState>(`${TG_BASE}/loginPhone`, {
      method: 'POST', body: JSON.stringify({ phone }),
    });
  }

  // Multi-session: instanceId routes the code/password to the correct in-flight login attempt.
  submitPhoneCode(code: string, instanceId: string) {
    return this.req<RequestResponse>(`${TG_BASE}/loginPhoneCode`, {
      method: 'POST', body: JSON.stringify({ code, instanceId }),
    });
  }

  submitPhonePassword(password: string, instanceId: string) {
    return this.req<RequestResponse>(`${TG_BASE}/loginPhonePassword`, {
      method: 'POST', body: JSON.stringify({ password, instanceId }),
    });
  }

  sessionContacts(sessionId: number) {
    return this.req<TelegramContactItem[]>(`${TG_BASE}/session/${sessionId}/contacts`);
  }

  async clientId(): Promise<string> {
    const res = await this.req<RequestResponse>(`${TG_BASE}/client-id`);
    return res.message;
  }

  // ---- Properties ----
  listProperties() { return this.req<PcmcProperty[]>(`${environment.apiBaseUrl}/property`); }

  async createProperty(data: { name: string; code?: string; assignedTelegramSessionId?: number }, logoFile?: File): Promise<PcmcProperty> {
    const fd = new FormData();
    fd.append('name', data.name);
    if (data.code) fd.append('code', data.code);
    if (data.assignedTelegramSessionId != null) fd.append('assignedTelegramSessionId', String(data.assignedTelegramSessionId));
    if (logoFile) fd.append('logoFile', logoFile, logoFile.name);
    const r = await firstValueFrom(
      this.http.post<{ status: boolean; data: PcmcProperty; }>(`${environment.apiBaseUrl}/property`, fd, { headers: this.authFormHeaders() })
    );
    return r.data;
  }

  async updateProperty(id: number, data: { name?: string; code?: string; logo?: string; assignedTelegramSessionId?: number | null; lastReminderActivity?: string }, logoFile?: File): Promise<PcmcProperty> {
    const fd = new FormData();
    if (data.name) fd.append('name', data.name);
    if (data.code !== undefined) fd.append('code', data.code ?? '');
    if (data.logo !== undefined) fd.append('logo', data.logo ?? '');
    if (data.lastReminderActivity) fd.append('lastReminderActivity', data.lastReminderActivity);
    if (data.assignedTelegramSessionId !== undefined)
      fd.append('assignedTelegramSessionId', data.assignedTelegramSessionId != null ? String(data.assignedTelegramSessionId) : '');
    if (logoFile) fd.append('logoFile', logoFile, logoFile.name);
    const r = await firstValueFrom(
      this.http.put<{ status: boolean; data: PcmcProperty; }>(`${environment.apiBaseUrl}/property/${id}`, fd, { headers: this.authFormHeaders() })
    );
    return r.data;
  }

  async removeProperty(id: number) {
    await firstValueFrom(this.http.delete<void>(`${environment.apiBaseUrl}/property/${id}`, { headers: this.headers() }));
  }

  // ---- Customers ----
  listCustomers(locationId?: number) {
    const qs = locationId != null ? `?locationId=${locationId}` : '';
    return this.req<PcmcCustomer[]>(`${environment.apiBaseUrl}/customer${qs}`);
  }

  createCustomer(data: { code: string; name: string; unit?: string; phone?: string; telegramHandle?: string; email?: string; telegramSessionContactId?: number; locationId: number }) {
    return this.req<PcmcCustomer>(`${environment.apiBaseUrl}/customer`, { method: 'POST', body: JSON.stringify(data) });
  }

  updateCustomer(id: number, data: Partial<{ name: string; unit: string; phone: string; telegramHandle: string; email: string; avatar: string; chatImported: boolean }>) {
    return this.req<void>(`${environment.apiBaseUrl}/customer/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  removeCustomer(id: number) {
    return this.req<void>(`${environment.apiBaseUrl}/customer/${id}`, { method: 'DELETE' });
  }

  // ---- Services ----
  listServices() { return this.req<PcmcService[]>(`${environment.apiBaseUrl}/service`); }

  async createService(data: { name: string; description?: string; reminderTemplate?: string }) {
    const r = await this.req<{ status: boolean; data: PcmcService; }>(`${environment.apiBaseUrl}/service`, {
      method: 'POST', body: JSON.stringify(data),
    });
    return r.data;
  }

  updateService(id: number, data: { name?: string; description?: string; reminderTemplate?: string }) {
    return this.req<void>(`${environment.apiBaseUrl}/service/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  removeService(id: number) {
    return this.req<void>(`${environment.apiBaseUrl}/service/${id}`, { method: 'DELETE' });
  }

  getAssignedCustomers(serviceId: number) {
    return this.req<PcmcCustomerServiceAssignment[]>(`${environment.apiBaseUrl}/service/${serviceId}/customers`);
  }

  assignCustomers(serviceId: number, customerIds: number[]) {
    return this.req<{ status: boolean; assigned: number; skipped: number }>(`${environment.apiBaseUrl}/service/${serviceId}/customers`, {
      method: 'POST', body: JSON.stringify({ customerIds }),
    });
  }

  unassignCustomer(serviceId: number, customerId: number) {
    return this.req<void>(`${environment.apiBaseUrl}/service/${serviceId}/customers/${customerId}`, { method: 'DELETE' });
  }

  // ---- Units ----
  listUnits(locationId?: number) {
    const qs = locationId != null ? `?locationId=${locationId}` : '';
    return this.req<UnitItem[]>(`${environment.apiBaseUrl}/unit${qs}`);
  }

  async createUnit(data: { code: string; floor?: string; building?: string; note?: string; locationId: number }) {
    const r = await this.req<{ status: boolean; data: UnitItem; }>(`${environment.apiBaseUrl}/unit`, {
      method: 'POST', body: JSON.stringify(data),
    });
    return r.data;
  }

  updateUnit(id: number, data: { code?: string; floor?: string; building?: string; note?: string; locationId?: number }) {
    return this.req<void>(`${environment.apiBaseUrl}/unit/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  removeUnit(id: number) {
    return this.req<void>(`${environment.apiBaseUrl}/unit/${id}`, { method: 'DELETE' });
  }

  importUnits(rows: { locationCode: string; unitCode: string }[]) {
    return this.req<{ status: boolean; imported: number; skipped: number; errors: string[] }>(`${environment.apiBaseUrl}/unit/import`, {
      method: 'POST', body: JSON.stringify({ rows }),
    });
  }

  // ---- Bills ----
  async createBill(data: {
    residentCode: string; residentName: string; service?: string;
    amount: number; dueDate: string; status?: string; autoSend?: boolean;
    unitId: number; customerId?: number;
  }): Promise<number> {
    const r = await this.req<{ status: boolean; data: { id: number; }; }>(`${environment.apiBaseUrl}/bill`, {
      method: 'POST', body: JSON.stringify(data),
    });
    return r.data.id;
  }

  listBills(filters?: { locationId?: number; status?: string; service?: string }) {
    const params = new URLSearchParams();
    if (filters?.locationId != null) params.set('locationId', String(filters.locationId));
    if (filters?.status) params.set('status', filters.status);
    if (filters?.service) params.set('service', filters.service);
    const qs = params.toString();
    return this.req<PcmcBillItem[]>(`${environment.apiBaseUrl}/bill${qs ? '?' + qs : ''}`);
  }

  updateBill(id: number, data: {
    autoSend?: boolean; status?: string; unitId?: number;
    residentCode?: string; residentName?: string;
    service?: string; amount?: number; dueDate?: string;
  }) {
    return this.req<void>(`${environment.apiBaseUrl}/bill/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  removeBill(id: number) {
    return this.req<void>(`${environment.apiBaseUrl}/bill/${id}`, { method: 'DELETE' });
  }

  importBills(rows: {
    locationCode: string; residentCode: string; residentPhone: string; unitCode: string;
    unitStatus: 'matched' | 'new' | 'unset'; service: string;
    amount: number; dueDate: string; autoSend: boolean;
  }[]): Promise<{ status: boolean; imported: number; skipped: number; errors: string[]; newUnits: { id: number; code: string; locationId: number; locationName: string }[] }> {
    return this.req(`${environment.apiBaseUrl}/bill/import`, {
      method: 'POST', body: JSON.stringify({ rows }),
    });
  }

  // ---- Bill Rules ----
  getBillRule() {
    return this.req<BillRule>(`${environment.apiBaseUrl}/bill-rule`);
  }

  updateBillRule(data: { preparingDays: number; overdueDays: number }) {
    return this.req<BillRule>(`${environment.apiBaseUrl}/bill-rule`, {
      method: 'PUT', body: JSON.stringify(data),
    });
  }

  // ---- Reminder Configs ----
  listReminderConfigs() {
    return this.req<ReminderConfig[]>(`${environment.apiBaseUrl}/reminderconfig`);
  }

  updateReminderConfig(id: number, data: { enabled?: boolean; template?: string }) {
    return this.req<void>(`${environment.apiBaseUrl}/reminderconfig/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  // ---- Upload ----
  async uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await firstValueFrom(
      this.http.post<{ url: string }>(`${environment.apiBaseUrl}/upload/image`, fd, { headers: this.authFormHeaders() })
    );
    return res.url;
  }
}
