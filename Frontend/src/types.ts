/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  code: string; // e.g. RES-001
  name: string;
  unit: string;
  telegram: string; // e.g. @john_smith
  balance: number;
  status: 'Paid' | 'Due' | 'Overdue';
  locationName: string;
  phone: string;
  chatImported: boolean;
  joinDate: string;
  email: string;
  avatar?: string;
  telegramSessionContactId?: number;
  profilePhoto?: string;
}

export interface Bill {
  id: string;
  residentCode: string;
  residentName: string;
  unit: string;
  service: string;
  amount: number;
  dueDate: string;
  status: 'Paid' | 'Due' | 'Overdue';
  autoSend: boolean;
  locationName: string;
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
  id: string;
  name: string;
  offset: string;
  enabled: boolean;
  template: string;
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
