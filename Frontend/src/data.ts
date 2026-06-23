/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Location, TelegramAccount, Resident, Bill, ServiceItem, ReminderConfig, MessageQueueItem, ActivityLog } from './types';

import avatarKhmerManModern from './assets/images/khmer_man_modern_1781450079304.jpg';
import avatarKhmerWomanModern from './assets/images/khmer_woman_modern_1781450094010.jpg';
import avatarKhmerManCorporate from './assets/images/khmer_man_corporate_1781450108984.jpg';
import avatarKhmerWomanCreative from './assets/images/khmer_woman_creative_1781450123272.jpg';
import avatarKhmerManYouth from './assets/images/khmer_man_youth_1781450137602.jpg';
import avatarWesternManCasual from './assets/images/western_man_casual_1781450152229.jpg';
import avatarWesternWomanPolished from './assets/images/western_woman_polished_1781450167566.jpg';
import logoImage from './assets/images/uk_condo_logo_1781450064023.jpg';

export const initialLocations: Location[] = [
  {
    id: 'loc-1',
    name: 'UK 313',
    residentsCount: 345,
    outstandingBalance: 45200,
    lastReminderActivity: '2026-06-11 14:30',
    logo: logoImage,
  },
  {
    id: 'loc-2',
    name: 'UK 618',
    residentsCount: 180,
    outstandingBalance: 18400,
    lastReminderActivity: '2026-06-12 09:15',
    logo: logoImage,
  },
  {
    id: 'loc-3',
    name: 'UK 548',
    residentsCount: 220,
    outstandingBalance: 32100,
    lastReminderActivity: '2026-06-10 16:45',
    logo: logoImage,
  },
  {
    id: 'loc-4',
    name: 'UK 271',
    residentsCount: 150,
    outstandingBalance: 28860,
    lastReminderActivity: 'Never',
    logo: logoImage,
  },
];

export const initialTelegramAccounts: TelegramAccount[] = [];

export const initialServices: ServiceItem[] = [
  {
    id: 0,
    name: 'Electricity',
    activeResidents: 850,
    outstandingAmount: 48900,
    reminderTemplate: 'Dear [ResidentName],\n\nYour [ServiceName] bill for Unit [UnitNumber] is $[BillAmount].\nDue Date: [DueDate]\n\nPlease make payment.\n\nThank you.\n[LocationName] Management',
  },
  {
    id: 0,
    name: 'Water',
    activeResidents: 890,
    outstandingAmount: 18400,
    reminderTemplate: 'Dear [ResidentName],\n\nThis is a notification for your [ServiceName] bill of $[BillAmount] for Unit [UnitNumber].\nDue Date: [DueDate]\n\nPlease settle this at your earliest convenience.\n\nBest regards,\n[LocationName] Team',
  },
  {
    id: 0,
    name: 'Maintenance Fee',
    activeResidents: 895,
    outstandingAmount: 42100,
    reminderTemplate: 'Urgent Reminder: [ResidentName],\n\nThe Monthly [ServiceName] for Unit [UnitNumber] is due on [DueDate] for $[BillAmount].\n\nKindly proceed with transfer to bank, and upload receipt.\n\nThank you.',
  },
  {
    id: 0,
    name: 'Parking',
    activeResidents: 430,
    outstandingAmount: 9200,
    reminderTemplate: 'Hi [ResidentName],\n\nUnsettled Parking Fee of $[BillAmount] is recorded for Unit [UnitNumber].\nDue Date: [DueDate]\n\nPlease clear on Telegram.',
  },
  {
    id: 0,
    name: 'Internet',
    activeResidents: 350,
    outstandingAmount: 3800,
    reminderTemplate: 'Dear [ResidentName],\n\nYour [ServiceName] service is active at Unit [UnitNumber]. Current outstanding: $[BillAmount] due [DueDate]. Please clear this to avoid service interruptions.',
  },
  {
    id: 0,
    name: 'Rental',
    activeResidents: 40,
    outstandingAmount: 22160,
    reminderTemplate: 'OFFICIAL NOTICE: [ResidentName],\n\nRental Fee of $[BillAmount] for Unit [UnitNumber] is now OVERDUE as of [DueDate].\n\nPlease transfer immediately to secure your tenancy.\n\nUK 313 Landlord Office',
  },
];

export const initialReminderConfigs: ReminderConfig[] = [
  {
    id: 'rem-1',
    name: 'Reminder 1',
    offset: '-5 Days',
    enabled: true,
    template: 'Dear [ResidentName],\n\nYour [ServiceName] bill for Unit [UnitNumber] is $[BillAmount].\nDue Date: [DueDate] (In 5 Days)\n\nPlease make payment.\n\nThank you.\n[LocationName] Management',
  },
  {
    id: 'rem-2',
    name: 'Reminder 2',
    offset: 'Due Date',
    enabled: true,
    template: 'Dear [ResidentName],\n\nTODAY is the Due Date for Unit [UnitNumber] [ServiceName] bill: $[BillAmount].\nDue Date: [DueDate]\n\nPlease complete your transfer today to avoid penalties.\n\nThank you.',
  },
  {
    id: 'rem-3',
    name: 'Reminder 3',
    offset: '+3 Days',
    enabled: true,
    template: 'OVERDUE: Dear [ResidentName],\n\nYour bill of $[BillAmount] for [ServiceName] (Unit [UnitNumber]) is now 3 days overdue.\nOriginal due date was [DueDate].\n\nPlease submit receipt today. Thank you.',
  },
  {
    id: 'rc-4',
    name: 'Final Notice',
    offset: '+7 Days',
    enabled: false,
    template: 'WARNING: Dear [ResidentName],\n\nUnit [UnitNumber] is now 7 days overdue for [ServiceName] bill of $[BillAmount].\n\nIf payment is not received, we will take subsequent administrative measures.\n\nUK 313 Legal Operations',
  },
];

// Available chats that can be imported manually by the user
export const availableChatsToImport = [
  { code: 'RES-D101', name: 'Mr Samnang', unit: 'A101', telegram: '@john_smith', phone: '+855 12 123 456', email: 'john.smith@gmail.com', avatar: avatarKhmerManModern },
  { code: 'RES-D102', name: 'Ms Vattey', unit: 'A102', telegram: '@david_lee99', phone: '+855 12 234 567', email: 'david.lee@gmail.com', avatar: avatarKhmerWomanModern },
  { code: 'RES-D103', name: 'Ly Soknet', unit: 'A103', telegram: '@emily_chen', phone: '+855 12 345 678', email: 'emily.chen@hotmail.com', avatar: avatarKhmerWomanCreative },
  { code: 'RES-D502', name: 'Mr. Um Sarath', unit: 'B502', telegram: '@sarah_w_estate', phone: '+855 12 456 789', email: 'sarah.wong@outlook.com', avatar: avatarKhmerManCorporate },
  { code: 'RES-D503', name: 'Michael Tan', unit: 'B503', telegram: '@michael_tan_313', phone: '+855 12 567 890', email: 'm.tan@gmail.com', avatar: avatarKhmerManYouth },
];

export const initialResidents: Resident[] = [
  // UK 313 pre-existing
  {
    code: 'RES-D201',
    name: 'Mr Ly Song',
    unit: 'C201',
    telegram: '@ly_song',
    balance: 450,
    status: 'Overdue',
    locationName: 'UK 313',
    phone: '+855 12 991 122',
    email: 'alice.c@gmail.com',
    chatImported: true,
    joinDate: '2025-01-15',
    avatar: avatarKhmerManModern,
  },
  {
    code: 'RES-D202',
    name: 'Alex Johnson',
    unit: 'C202',
    telegram: '@alex_johnson_pm',
    balance: 120,
    status: 'Due',
    locationName: 'UK 313',
    phone: '+855 12 881 122',
    email: 'alex.j@gmail.com',
    chatImported: true,
    joinDate: '2025-02-18',
    avatar: avatarWesternManCasual,
  },
  {
    code: 'RES-D301',
    name: 'Ms Sakona',
    unit: 'D301',
    telegram: '@sakona',
    balance: 0,
    status: 'Paid',
    locationName: 'UK 313',
    phone: '+855 12 771 122',
    email: 'robert@stark.com',
    chatImported: true,
    joinDate: '2025-03-20',
    avatar: avatarKhmerWomanModern,
  },
  {
    code: 'RES-D302',
    name: 'Ms Amanta',
    unit: 'D302',
    telegram: '@amanta',
    balance: 3200,
    status: 'Overdue',
    locationName: 'UK 313',
    phone: '+855 12 661 122',
    email: 'chris.evans@marvel.com',
    chatImported: true,
    joinDate: '2025-04-10',
    avatar: avatarKhmerWomanCreative,
  },
  {
    code: 'RES-D401',
    name: 'Mr Sorn Sarak',
    unit: 'Penthouse A',
    telegram: '@sarak_sorn',
    balance: 15400,
    status: 'Overdue',
    locationName: 'UK 313',
    phone: '+855 12 551 122',
    email: 'tony@starkindustries.com',
    chatImported: true,
    joinDate: '2024-11-01',
    avatar: avatarKhmerManCorporate,
  },

  // UK 618
  {
    code: 'RES-S101',
    name: 'Mr Siha',
    unit: 'S101',
    telegram: '@siha',
    balance: 240,
    status: 'Due',
    locationName: 'UK 618',
    phone: '+855 12 441 122',
    email: 'mark@hulk.com',
    chatImported: true,
    joinDate: '2025-05-12',
    avatar: avatarKhmerManYouth,
  },
  {
    code: 'RES-S202',
    name: 'Scarlett Johansson',
    unit: 'S202',
    telegram: '@widow_scarlett',
    balance: 1850,
    status: 'Overdue',
    locationName: 'UK 618',
    phone: '+855 12 331 122',
    email: 'scarlett@widow.com',
    chatImported: true,
    joinDate: '2025-02-05',
    avatar: avatarWesternWomanPolished,
  },
  {
    code: 'RES-S303',
    name: 'Tom Holland',
    unit: 'S303',
    telegram: '@spidey_tom',
    balance: 0,
    status: 'Paid',
    locationName: 'UK 618',
    phone: '+855 12 221 122',
    email: 'tom.holland@webs.com',
    chatImported: true,
    joinDate: '2025-06-01',
    avatar: avatarWesternManCasual,
  },

  // UK 548
  {
    code: 'RES-G101',
    name: 'Bruce Banner',
    unit: 'Villa G101',
    telegram: '@banner_bruce',
    balance: 3100,
    status: 'Overdue',
    locationName: 'UK 548',
    phone: '+855 12 113 355',
    email: 'banner@avengers.org',
    chatImported: true,
    joinDate: '2024-05-15',
    avatar: avatarWesternManCasual,
  },
  {
    code: 'RES-G205',
    name: 'Natasha Romanoff',
    unit: 'Villa G205',
    telegram: '@nat_romanoff',
    balance: 4500,
    status: 'Overdue',
    locationName: 'UK 548',
    phone: '+855 12 114 455',
    email: 'natasha@shield.gov',
    chatImported: true,
    joinDate: '2024-08-20',
    avatar: avatarWesternWomanPolished,
  },

  // UK 271
  {
    code: 'RES-R110',
    name: 'Stephen Strange',
    unit: 'Estate R110',
    telegram: '@dr_strange',
    balance: 1250,
    status: 'Due',
    locationName: 'UK 271',
    phone: '+855 12 115 599',
    email: 'strange@sanctum.org',
    chatImported: true,
    joinDate: '2024-12-01',
    avatar: avatarWesternManCasual,
  },
  {
    code: 'RES-R120',
    name: 'Wanda Maximoff',
    unit: 'Estate R120',
    telegram: '@scarlet_wanda',
    balance: 8200,
    status: 'Overdue',
    locationName: 'UK 271',
    phone: '+855 12 116 699',
    email: 'wanda@westview.net',
    chatImported: true,
    joinDate: '2025-01-10',
    avatar: avatarWesternWomanPolished,
  }
];

export const initialBills: Bill[] = [
  // UK 313 Pre-existing
  { id: 'bill-1', residentCode: 'RES-D201', residentName: 'Mr Ly Song', unit: 'C201', service: 'Electricity', amount: 150, dueDate: '2026-06-10', status: 'Overdue', autoSend: true, locationName: 'UK 313' },
  { id: 'bill-2', residentCode: 'RES-D201', residentName: 'Mr Ly Song', unit: 'C201', service: 'Water', amount: 80, dueDate: '2026-06-10', status: 'Overdue', autoSend: true, locationName: 'UK 313' },
  { id: 'bill-3', residentCode: 'RES-D201', residentName: 'Mr Ly Song', unit: 'C201', service: 'Maintenance Fee', amount: 220, dueDate: '2026-06-10', status: 'Overdue', autoSend: false, locationName: 'UK 313' },
  
  { id: 'bill-4', residentCode: 'RES-D202', residentName: 'Alex Johnson', unit: 'C202', service: 'Electricity', amount: 120, dueDate: '2026-06-20', status: 'Due', autoSend: true, locationName: 'UK 313' },
  
  { id: 'bill-5', residentCode: 'RES-D302', residentName: 'Ms Amanta', unit: 'D302', service: 'Maintenance Fee', amount: 1200, dueDate: '2026-06-05', status: 'Overdue', autoSend: true, locationName: 'UK 313' },
  { id: 'bill-6', residentCode: 'RES-D302', residentName: 'Ms Amanta', unit: 'D302', service: 'Rental', amount: 2000, dueDate: '2026-06-05', status: 'Overdue', autoSend: true, locationName: 'UK 313' },

  { id: 'bill-7', residentCode: 'RES-D401', residentName: 'Mr Sorn Sarak', unit: 'Penthouse A', service: 'Maintenance Fee', amount: 5400, dueDate: '2026-05-10', status: 'Overdue', autoSend: true, locationName: 'UK 313' },
  { id: 'bill-8', residentCode: 'RES-D401', residentName: 'Mr Sorn Sarak', unit: 'Penthouse A', service: 'Electricity', amount: 4800, dueDate: '2026-06-05', status: 'Overdue', autoSend: true, locationName: 'UK 313' },
  { id: 'bill-9', residentCode: 'RES-D401', residentName: 'Mr Sorn Sarak', unit: 'Penthouse A', service: 'Rental', amount: 5200, dueDate: '2026-05-01', status: 'Overdue', autoSend: false, locationName: 'UK 313' },


  // UK 618 Pre-existing
  { id: 'bill-10', residentCode: 'RES-S101', residentName: 'Mr Siha', unit: 'S101', service: 'Water', amount: 45, dueDate: '2026-06-25', status: 'Due', autoSend: true, locationName: 'UK 618' },
  { id: 'bill-11', residentCode: 'RES-S101', residentName: 'Mr Siha', unit: 'S101', service: 'Electricity', amount: 195, dueDate: '2026-06-25', status: 'Due', autoSend: true, locationName: 'UK 618' },
  
  { id: 'bill-12', residentCode: 'RES-S202', residentName: 'Scarlett Johansson', unit: 'S202', service: 'Rental', amount: 1500, dueDate: '2026-06-01', status: 'Overdue', autoSend: true, locationName: 'UK 618' },
  { id: 'bill-13', residentCode: 'RES-S202', residentName: 'Scarlett Johansson', unit: 'S202', service: 'Maintenance Fee', amount: 350, dueDate: '2026-06-01', status: 'Overdue', autoSend: true, locationName: 'UK 618' },


  // UK 548 Pre-existing
  { id: 'bill-14', residentCode: 'RES-G101', residentName: 'Bruce Banner', unit: 'Villa G101', service: 'Maintenance Fee', amount: 2500, dueDate: '2026-05-15', status: 'Overdue', autoSend: true, locationName: 'UK 548' },
  { id: 'bill-15', residentCode: 'RES-G101', residentName: 'Bruce Banner', unit: 'Villa G101', service: 'Electricity', amount: 600, dueDate: '2026-06-01', status: 'Overdue', autoSend: true, locationName: 'UK 548' },
  
  { id: 'bill-16', residentCode: 'RES-G205', residentName: 'Natasha Romanoff', unit: 'Villa G205', service: 'Rental', amount: 4500, dueDate: '2026-05-10', status: 'Overdue', autoSend: false, locationName: 'UK 548' },


  // UK 271 Pre-existing
  { id: 'bill-17', residentCode: 'RES-R110', residentName: 'Stephen Strange', unit: 'Estate R110', service: 'Electricity', amount: 450, dueDate: '2026-06-18', status: 'Due', autoSend: true, locationName: 'UK 271' },
  { id: 'bill-18', residentCode: 'RES-R110', residentName: 'Stephen Strange', unit: 'Estate R110', service: 'Maintenance Fee', amount: 800, dueDate: '2026-06-18', status: 'Due', autoSend: true, locationName: 'UK 271' },
  
  { id: 'bill-19', residentCode: 'RES-R120', residentName: 'Wanda Maximoff', unit: 'Estate R120', service: 'Rental', amount: 6500, dueDate: '2026-06-02', status: 'Overdue', autoSend: true, locationName: 'UK 271' },
  { id: 'bill-20', residentCode: 'RES-R120', residentName: 'Wanda Maximoff', unit: 'Estate R120', service: 'Electricity', amount: 1700, dueDate: '2026-06-02', status: 'Overdue', autoSend: true, locationName: 'UK 271' }
];

// Sample Pending Reminder Queue that represents un-sent reminders from our scheduler offsets
export const initialMessageQueue: MessageQueueItem[] = [
  {
    id: 'msg-1',
    residentCode: 'RES-D201',
    residentName: 'Mr Ly Song',
    unit: 'C201',
    telegram: '@ly_song',
    service: 'Electricity',
    amount: 150,
    dueDate: '2026-06-10',
    offsetType: 'Reminder 3 (+3 Days)',
    text: 'OVERDUE: Dear Mr Ly Song,\n\nYour bill of $150.00 for Electricity (Unit C201) is now 3 days overdue.\nOriginal due date was 2026-06-10.\n\nPlease submit receipt today. Thank you.\nUK 313 Management',
    status: 'Pending',
    timestamp: '2026-06-13 09:00',
    locationName: 'UK 313'
  },
  {
    id: 'msg-2',
    residentCode: 'RES-D201',
    residentName: 'Mr Ly Song',
    unit: 'C201',
    telegram: '@ly_song',
    service: 'Water',
    amount: 80,
    dueDate: '2026-06-10',
    offsetType: 'Reminder 3 (+3 Days)',
    text: 'OVERDUE: Dear Mr Ly Song,\n\nYour bill of $80.00 for Water (Unit C201) is now 3 days overdue.\nOriginal due date was 2026-06-10.\n\nPlease submit receipt today. Thank you.\nUK 313 Management',
    status: 'Pending',
    timestamp: '2026-06-13 09:02',
    locationName: 'UK 313'
  },
  {
    id: 'msg-3',
    residentCode: 'RES-D302',
    residentName: 'Ms Amanta',
    unit: 'D302',
    telegram: '@amanta',
    service: 'Maintenance Fee',
    amount: 1200,
    dueDate: '2026-06-05',
    offsetType: 'Final Notice (+7 Days)',
    text: 'WARNING: Dear Ms Amanta,\n\nUnit D302 is now 7 days overdue for Maintenance Fee bill of $1200.00.\n\nIf payment is not received, we will take subsequent administrative measures.\n\nUK 313 Legal Operations',
    status: 'Pending',
    timestamp: '2026-06-13 09:10',
    locationName: 'UK 313'
  },
  {
    id: 'msg-4',
    residentCode: 'RES-D401',
    residentName: 'Mr Sorn Sarak',
    unit: 'Penthouse A',
    telegram: '@sarak_sorn',
    service: 'Electricity',
    amount: 4800,
    dueDate: '2026-06-05',
    offsetType: 'Final Notice (+7 Days)',
    text: 'WARNING: Dear Mr Sorn Sarak,\n\nUnit Penthouse A is now 7 days overdue for Electricity bill of $4800.00.\n\nIf payment is not received, we will take subsequent administrative measures.\n\nUK 313 Legal Operations',
    status: 'Pending',
    timestamp: '2026-06-13 09:12',
    locationName: 'UK 313'
  },
  {
    id: 'msg-5',
    residentCode: 'RES-S202',
    residentName: 'Scarlett Johansson',
    unit: 'S202',
    telegram: '@widow_scarlett',
    service: 'Maintenance Fee',
    amount: 350,
    dueDate: '2026-06-01',
    offsetType: 'Final Notice (+7 Days)',
    text: 'WARNING: Dear Scarlett Johansson,\n\nUnit S202 is now 7 days overdue for Maintenance Fee bill of $350.00.\n\nIf payment is not received, we will take subsequent administrative measures.\n\nUK 313 Legal Operations',
    status: 'Pending',
    timestamp: '2026-06-13 10:15',
    locationName: 'UK 618'
  },
  {
    id: 'msg-6',
    residentCode: 'RES-G101',
    residentName: 'Bruce Banner',
    unit: 'Villa G101',
    telegram: '@banner_bruce',
    service: 'Electricity',
    amount: 600,
    dueDate: '2026-06-01',
    offsetType: 'Final Notice (+7 Days)',
    text: 'WARNING: Dear Bruce Banner,\n\nUnit Villa G101 is now 7 days overdue for Electricity bill of $600.00.\n\nIf payment is not received, we will take subsequent administrative measures.\n\nUK 313 Legal Operations',
    status: 'Pending',
    timestamp: '2026-06-13 11:20',
    locationName: 'UK 548'
  },
  {
    id: 'msg-7',
    residentCode: 'RES-R120',
    residentName: 'Wanda Maximoff',
    unit: 'Estate R120',
    telegram: '@scarlet_wanda',
    service: 'Electricity',
    amount: 1700,
    dueDate: '2026-06-02',
    offsetType: 'Final Notice (+7 Days)',
    text: 'WARNING: Dear Wanda Maximoff,\n\nUnit Estate R120 is now 7 days overdue for Electricity bill of $1700.00.\n\nIf payment is not received, we will take subsequent administrative measures.\n\nUK 313 Legal Operations',
    status: 'Pending',
    timestamp: '2026-06-13 11:40',
    locationName: 'UK 271'
  }
];

export const initialActivityLogs: ActivityLog[] = [
  { id: 'act-1', action: 'Telegram Account Connection', details: 'UK 313 connected successfully using @condo_diamond_bot', timestamp: '2026-06-13 08:15', type: 'success' },
  { id: 'act-2', action: 'System Backup Complete', details: 'Automated UK 313 database snapshot pushed to server secure backup.', timestamp: '2026-06-13 06:00', type: 'info' },
  { id: 'act-3', action: 'Reminder Schedule Triggered', details: '34 reminders automatically queued by system scheduler for original due dates.', timestamp: '2026-06-12 18:00', type: 'info' },
  { id: 'act-4', action: 'Outstanding Report Sent', details: 'Daily collection logs exported successfully as Excel structure by System Daemon.', timestamp: '2026-06-12 17:30', type: 'success' },
];

export const fileImportTemplates = {
  arFileName: 'July_2026_Bills.xlsx',
  arRecords: [
    { residentCode: 'RES-D101', residentName: 'Mr Samnang', unit: 'A101', location: 'UK 313', service: 'Electricity', amount: 35.50, dueDate: '2026-07-10', autoSend: true },
    { residentCode: 'RES-D101', residentName: 'Mr Samnang', unit: 'A101', location: 'UK 313', service: 'Water', amount: 15.00, dueDate: '2026-07-10', autoSend: true },
    { residentCode: 'RES-D102', residentName: 'Ms Vattey', unit: 'A102', location: 'UK 313', service: 'Electricity', amount: 82.10, dueDate: '2026-07-10', autoSend: true },
    { residentCode: 'RES-D103', residentName: 'Ly Soknet', unit: 'A103', location: 'UK 313', service: 'Maintenance Fee', amount: 220.00, dueDate: '2026-07-10', autoSend: true },
    { residentCode: 'RES-D502', residentName: 'Mr. Um Sarath', unit: 'B502', location: 'UK 313', service: 'Parking', amount: 50.00, dueDate: '2026-07-10', autoSend: false },
    { residentCode: 'RES-D503', residentName: 'Michael Tan', unit: 'B503', location: 'UK 313', service: 'Electricity', amount: 98.40, dueDate: '2026-07-10', autoSend: true },
    { residentCode: 'RES-S101', residentName: 'Mr Siha', unit: 'S101', location: 'UK 618', service: 'Electricity', amount: 140.20, dueDate: '2026-07-10', autoSend: true },
    { residentCode: 'RES-G101', residentName: 'Bruce Banner', unit: 'Villa G101', location: 'UK 548', service: 'Maintenance Fee', amount: 2500.00, dueDate: '2026-07-10', autoSend: true },
  ]
};

export const avatarMap: Record<string, string> = Object.fromEntries([
  ...initialResidents
    .filter(r => r.avatar)
    .map(r => [r.code, r.avatar as string]),
  ...availableChatsToImport
    .filter(c => c.avatar)
    .map(c => [c.code, c.avatar as string]),
]);

// Generates message text dynamically based on variables
export function formatTemplate(template: string, vars: { residentName: string; unitNumber: string; billAmount: number | string; dueDate: string; serviceName: string; locationName: string }): string {
  return template
    .replace(/\[ResidentName\]/g, vars.residentName)
    .replace(/\[UnitNumber\]/g, vars.unitNumber)
    .replace(/\[BillAmount\]/g, Number(vars.billAmount).toFixed(2))
    .replace(/\[DueDate\]/g, vars.dueDate)
    .replace(/\[ServiceName\]/g, vars.serviceName)
    .replace(/\[LocationName\]/g, vars.locationName);
}
