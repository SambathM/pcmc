import { TelegramAccount, ReminderConfig, MessageQueueItem, ActivityLog, CountryEntry } from '../libs/models/types';

export const initialTelegramAccounts: TelegramAccount[] = [];

export const initialReminderConfigs: ReminderConfig[] = [
  { id: 1, name: 'Reminder 1', offset: '-5 Days', enabled: true, sortOrder: 1,
    template: 'Dear [ResidentName],\n\nYour [ServiceName] bill for Unit [UnitNumber] is $[BillAmount].\nDue Date: [DueDate] (In 5 Days)\n\nPlease make payment.\n\nThank you.\n[LocationName] Management' },
  { id: 2, name: 'Reminder 2', offset: 'Due Date', enabled: true, sortOrder: 2,
    template: 'Dear [ResidentName],\n\nTODAY is the Due Date for Unit [UnitNumber] [ServiceName] bill: $[BillAmount].\nDue Date: [DueDate]\n\nPlease complete your transfer today to avoid penalties.\n\nThank you.' },
  { id: 3, name: 'Reminder 3', offset: '+3 Days', enabled: true, sortOrder: 3,
    template: 'OVERDUE: Dear [ResidentName],\n\nYour bill of $[BillAmount] for [ServiceName] (Unit [UnitNumber]) is now 3 days overdue.\nOriginal due date was [DueDate].\n\nPlease submit receipt today. Thank you.' },
  { id: 4, name: 'Final Notice', offset: '+7 Days', enabled: false, sortOrder: 4,
    template: 'WARNING: Dear [ResidentName],\n\nUnit [UnitNumber] is now 7 days overdue for [ServiceName] bill of $[BillAmount].\n\nIf payment is not received, we will take subsequent administrative measures.\n\nUK 313 Legal Operations' },
];

export const initialMessageQueue: MessageQueueItem[] = [
  {
    id: 'msg-1', residentCode: 'RES-D201', residentName: 'Mr Ly Song', unit: 'C201',
    telegram: '@ly_song', service: 'Electricity', amount: 150, dueDate: '2026-06-10',
    offsetType: 'Reminder 3 (+3 Days)',
    text: 'OVERDUE: Dear Mr Ly Song,\n\nYour bill of $150.00 for Electricity (Unit C201) is now 3 days overdue.\nPlease submit receipt today. Thank you.\nUK 313 Management',
    status: 'Pending', timestamp: '2026-06-13 09:00', locationName: 'UK 313',
  },
  {
    id: 'msg-2', residentCode: 'RES-D201', residentName: 'Mr Ly Song', unit: 'C201',
    telegram: '@ly_song', service: 'Water', amount: 80, dueDate: '2026-06-10',
    offsetType: 'Reminder 3 (+3 Days)',
    text: 'OVERDUE: Dear Mr Ly Song,\n\nYour bill of $80.00 for Water (Unit C201) is now 3 days overdue.\nPlease submit receipt today.\nUK 313 Management',
    status: 'Pending', timestamp: '2026-06-13 09:02', locationName: 'UK 313',
  },
];

export const initialActivityLogs: ActivityLog[] = [
  { id: 'act-1', action: 'Telegram Account Connection', details: 'UK 313 connected successfully using @condo_diamond_bot', timestamp: '2026-06-13 08:15', type: 'success' },
  { id: 'act-2', action: 'System Backup Complete', details: 'Automated UK 313 database snapshot pushed to server secure backup.', timestamp: '2026-06-13 06:00', type: 'info' },
  { id: 'act-3', action: 'Reminder Schedule Triggered', details: '34 reminders automatically queued by system scheduler.', timestamp: '2026-06-12 18:00', type: 'info' },
  { id: 'act-4', action: 'Outstanding Report Sent', details: 'Daily collection logs exported successfully as Excel structure.', timestamp: '2026-06-12 17:30', type: 'success' },
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
  ],
};

export function formatTemplate(template: string, vars: {
  residentName: string; unitNumber: string; billAmount: number | string;
  dueDate: string; serviceName: string; locationName: string;
}): string {
  return template
    .replace(/\[ResidentName\]/g, vars.residentName)
    .replace(/\[UnitNumber\]/g, vars.unitNumber)
    .replace(/\[BillAmount\]/g, Number(vars.billAmount).toFixed(2))
    .replace(/\[DueDate\]/g, vars.dueDate)
    .replace(/\[ServiceName\]/g, vars.serviceName)
    .replace(/\[LocationName\]/g, vars.locationName);
}

export const COUNTRIES: CountryEntry[] = [
  { name: 'Argentina', iso: 'AR', code: '+54', flag: '🇦🇷' },
  { name: 'Australia', iso: 'AU', code: '+61', flag: '🇦🇺' },
  { name: 'Austria', iso: 'AT', code: '+43', flag: '🇦🇹' },
  { name: 'Bangladesh', iso: 'BD', code: '+880', flag: '🇧🇩' },
  { name: 'Belgium', iso: 'BE', code: '+32', flag: '🇧🇪' },
  { name: 'Brazil', iso: 'BR', code: '+55', flag: '🇧🇷' },
  { name: 'Cambodia', iso: 'KH', code: '+855', flag: '🇰🇭', default: true },
  { name: 'Canada', iso: 'CA', code: '+1', flag: '🇨🇦' },
  { name: 'China', iso: 'CN', code: '+86', flag: '🇨🇳' },
  { name: 'Denmark', iso: 'DK', code: '+45', flag: '🇩🇰' },
  { name: 'Egypt', iso: 'EG', code: '+20', flag: '🇪🇬' },
  { name: 'Finland', iso: 'FI', code: '+358', flag: '🇫🇮' },
  { name: 'France', iso: 'FR', code: '+33', flag: '🇫🇷' },
  { name: 'Germany', iso: 'DE', code: '+49', flag: '🇩🇪' },
  { name: 'Hong Kong', iso: 'HK', code: '+852', flag: '🇭🇰' },
  { name: 'India', iso: 'IN', code: '+91', flag: '🇮🇳' },
  { name: 'Indonesia', iso: 'ID', code: '+62', flag: '🇮🇩' },
  { name: 'Israel', iso: 'IL', code: '+972', flag: '🇮🇱' },
  { name: 'Italy', iso: 'IT', code: '+39', flag: '🇮🇹' },
  { name: 'Japan', iso: 'JP', code: '+81', flag: '🇯🇵' },
  { name: 'Kenya', iso: 'KE', code: '+254', flag: '🇰🇪' },
  { name: 'Laos', iso: 'LA', code: '+856', flag: '🇱🇦' },
  { name: 'Malaysia', iso: 'MY', code: '+60', flag: '🇲🇾' },
  { name: 'Mexico', iso: 'MX', code: '+52', flag: '🇲🇽' },
  { name: 'Myanmar', iso: 'MM', code: '+95', flag: '🇲🇲' },
  { name: 'Nepal', iso: 'NP', code: '+977', flag: '🇳🇵' },
  { name: 'Netherlands', iso: 'NL', code: '+31', flag: '🇳🇱' },
  { name: 'New Zealand', iso: 'NZ', code: '+64', flag: '🇳🇿' },
  { name: 'Nigeria', iso: 'NG', code: '+234', flag: '🇳🇬' },
  { name: 'Norway', iso: 'NO', code: '+47', flag: '🇳🇴' },
  { name: 'Pakistan', iso: 'PK', code: '+92', flag: '🇵🇰' },
  { name: 'Philippines', iso: 'PH', code: '+63', flag: '🇵🇭' },
  { name: 'Poland', iso: 'PL', code: '+48', flag: '🇵🇱' },
  { name: 'Portugal', iso: 'PT', code: '+351', flag: '🇵🇹' },
  { name: 'Russia', iso: 'RU', code: '+7', flag: '🇷🇺' },
  { name: 'Saudi Arabia', iso: 'SA', code: '+966', flag: '🇸🇦' },
  { name: 'Singapore', iso: 'SG', code: '+65', flag: '🇸🇬' },
  { name: 'South Africa', iso: 'ZA', code: '+27', flag: '🇿🇦' },
  { name: 'South Korea', iso: 'KR', code: '+82', flag: '🇰🇷' },
  { name: 'Spain', iso: 'ES', code: '+34', flag: '🇪🇸' },
  { name: 'Sri Lanka', iso: 'LK', code: '+94', flag: '🇱🇰' },
  { name: 'Sweden', iso: 'SE', code: '+46', flag: '🇸🇪' },
  { name: 'Switzerland', iso: 'CH', code: '+41', flag: '🇨🇭' },
  { name: 'Taiwan', iso: 'TW', code: '+886', flag: '🇹🇼' },
  { name: 'Thailand', iso: 'TH', code: '+66', flag: '🇹🇭' },
  { name: 'Turkey', iso: 'TR', code: '+90', flag: '🇹🇷' },
  { name: 'UAE', iso: 'AE', code: '+971', flag: '🇦🇪' },
  { name: 'United Kingdom', iso: 'GB', code: '+44', flag: '🇬🇧' },
  { name: 'United States', iso: 'US', code: '+1', flag: '🇺🇸' },
  { name: 'Vietnam', iso: 'VN', code: '+84', flag: '🇻🇳' },
];
