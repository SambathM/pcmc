export interface AssignedTelegramSession {
  id: number;
  firstName?: string;
  lastName?: string;
  userName?: string;
  phoneNumber?: string;
  profilePhoto?: string;
  isAuthorized: boolean;
}

export interface Location {
  id: string;
  name: string;
  code?: string;
  residentsCount: number;
  outstandingBalance: number;
  assignedTelegramSessionId?: number;
  assignedTelegramSession?: AssignedTelegramSession;
  lastReminderActivity: string;
  logo?: string;
}

export interface TelegramAccount {
  id: string;
  name: string;
  username: string;
  phone: string;
  status: 'Connected' | 'Disconnected';
  isDefault: boolean;
  logo?: string;
}

export interface Resident {
  code: string;
  name: string;
  unit: string;
  telegram: string;
  balance: number;
  status: 'Paid' | 'Due' | 'Overdue';
  locationName: string;
  locationIds?: number[];
  phone: string;
  chatImported: boolean;
  joinDate: string;
  email: string;
  avatar?: string;
  telegramSessionContactId?: number;
  profilePhoto?: string;
}

export type BillStatus = 'Preparing' | 'Due' | 'Overdue' | 'Paid';

export interface BillRule {
  id: number;
  preparingDays: number;
  overdueDays: number;
  updatedOn: string;
}
export type BillOperationOutcome = 'Success' | 'Failed' | 'Pending';

export interface StatusLogEntry {
  statusName: BillStatus;
  operationDate: string;   // ISO datetime
  outcome: BillOperationOutcome;
  reason?: string;
}

export interface Bill {
  id: string;
  residentCode: string;
  residentName: string;
  unit: string;
  service: string;
  amount: number;
  dueDate: string;
  status: BillStatus;
  autoSend: boolean;
  locationName: string;
  statusLogs?: StatusLogEntry[];
}

export interface ServiceItem {
  id: number;
  name: string;
  description?: string;
  activeResidents: number;
  outstandingAmount: number;
  reminderTemplate: string;
}

export interface ReminderConfig {
  id: number;
  name: string;
  offset: string;
  enabled: boolean;
  template: string;
  sortOrder: number;
}

export interface MessageQueueItem {
  id: string;
  residentCode: string;
  residentName: string;
  unit: string;
  telegram: string;
  service: string;
  amount: number;
  dueDate: string;
  offsetType: string;
  text: string;
  status: 'Pending' | 'Sent' | 'Delivered' | 'Failed';
  timestamp: string;
  locationName: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface ChatImportItem {
  code: string;
  name: string;
  unit: string;
  telegram: string;
  phone: string;
  email: string;
  avatar?: string;
  telegramSessionContactId?: number;
  profilePhoto?: string;
}

// API response shapes
export interface LoginResult {
  status: boolean;
  code: number;
  message?: string;
  error?: string;
  tokens?: { sessionId?: string; accessToken: string; refreshToken: string };
}

export interface RequestResponse {
  status: boolean;
  message: string;
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

export interface PcmcProperty {
  id: number;
  name: string;
  code?: string;
  logo?: string;
  assignedTelegramSessionId?: number;
  assignedTelegramSession?: AssignedTelegramSession;
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
  locationId?: number;
  locationIds?: number[];
  locationName?: string;
  isActive: boolean;
  chatImported: boolean;
  joinDate: string;
}

export interface PcmcService {
  id: number;
  name: string;
  description?: string;
  reminderTemplate: string;
  activeResidents: number;
  outstandingAmount: number;
}

export interface UnitItem {
  id: number;
  code: string;
  floor?: string | null;
  building?: string | null;
  note?: string | null;
  locationId: number;
  locationName?: string;
}

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

export interface TgQrCodeResponse {
  status: number;
  instanceId: string;
  qrCode: string;
}

export interface PhoneLoginState {
  message?: string;
  state: number;
}

export interface TelegramContactItem {
  id: number;
  firstName?: string;
  lastName?: string;
  phone?: string;
  username?: string;
  profilePhoto?: string;
  isSelected?: boolean; // For import selection state
}

export interface TelegramSyncStatus {
  status: number;
  message?: string;
  data?: string;
}

export interface PcmcCustomerServiceAssignment {
  id: number;
  customerId: number;
  assignedOn: string;
  customerCode: string;
  customerName: string;
  unit?: string;
}

export interface CountryEntry {
  name: string;
  iso: string;
  code: string;
  flag: string;
  default?: boolean;
}

export interface IApiToken {
  accessToken: string;
  refreshToken: string;
}
