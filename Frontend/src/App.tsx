/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Menu, 
  User, 
  Bell, 
  LogOut, 
  LayoutDashboard, 
  Send, 
  MapPin, 
  Users, 
  Briefcase, 
  CreditCard, 
  Clock, 
  MessageSquare, 
  BarChart3, 
  Sliders, 
  CheckCircle2, 
  ChevronDown 
} from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import DashboardView from './components/DashboardView';
import TelegramAccountsView from './components/TelegramAccountsView';
import LocationsView from './components/LocationsView';
import ResidentsView from './components/ResidentsView';
import ServicesView from './components/ServicesView';
import ARView from './components/ARView';
import ReminderSchedulerView from './components/ReminderSchedulerView';
import MessageCenterView from './components/MessageCenterView';
import ReportsView from './components/ReportsView';
import logoImage from './assets/images/uk_condo_logo_1781450064023.jpg';

import {
  Location,
  TelegramAccount,
  Resident,
  Bill,
  ServiceItem,
  ReminderConfig,
  MessageQueueItem,
  ActivityLog,
  ChatImportItem,
} from './types';

import { clearStoredToken, getStoredToken, authService, propertyService, customerService, serviceService, billService, telegramService, type PcmcProperty, type PcmcCustomer, type TelegramSession, type PcmcService, type PcmcBillItem } from './lib/api';

import {
  initialTelegramAccounts,
  initialReminderConfigs,
  initialMessageQueue,
  initialActivityLogs,
  formatTemplate
} from './data';

function propertyToLocation(p: PcmcProperty): Location {
  return {
    id: String(p.id),
    name: p.name,
    residentsCount: p.residentsCount,
    outstandingBalance: p.outstandingBalance,
    assignedTelegramSessionId: p.assignedTelegramSessionId,
    assignedTelegramSession: p.assignedTelegramSession,
    lastReminderActivity: p.lastReminderActivity ?? '',
    logo: p.logo,
  };
}

function billToItem(b: PcmcBillItem): Bill {
  return {
    id: String(b.id),
    residentCode: b.residentCode,
    residentName: b.residentName,
    unit: b.unit,
    service: b.service,
    amount: b.amount,
    dueDate: b.dueDate,
    status: b.status as Bill['status'],
    autoSend: b.autoSend,
    locationName: b.locationName,
  };
}

function serviceToItem(s: PcmcService): ServiceItem {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    activeResidents: s.activeResidents,
    outstandingAmount: s.outstandingAmount,
    reminderTemplate: s.reminderTemplate,
  };
}

function customerToResident(c: PcmcCustomer): Resident {
  return {
    code: c.code,
    name: c.name,
    unit: c.unit ?? '',
    telegram: c.telegram ?? '',
    balance: 0,
    status: 'Due',
    locationName: c.locationName ?? '',
    phone: c.phone ?? '',
    chatImported: c.chatImported,
    joinDate: c.joinDate,
    email: c.email ?? '',
    avatar: c.avatar,
    telegramSessionContactId: c.telegramSessionContactId,
    profilePhoto: c.profilePhoto,
  };
}

export default function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getStoredToken());
  const [isCheckingAuth, setIsCheckingAuth] = useState(() => !!getStoredToken());

  useEffect(() => {
    if (!getStoredToken()) return;
    authService.renewAccessToken()
      .then(() => setIsAuthenticated(true))
      .catch(() => { clearStoredToken(); setIsAuthenticated(false); })
      .finally(() => setIsCheckingAuth(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load real domain data after authentication is confirmed
  useEffect(() => {
    if (!isAuthenticated) return;
    propertyService.list()
      .then(props => {
        const locs = props.map(propertyToLocation);
        setLocations(locs);
        if (locs.length > 0) setSelectedLocation(prev => prev || locs[0].name);
      })
      .catch(() => {});
    customerService.list()
      .then(custs => setResidents(custs.map(customerToResident)))
      .catch(() => {});
    telegramService.sessions()
      .then(s => setTelegramSessions(s))
      .catch(() => {});
    setServicesLoading(true);
    serviceService.list()
      .then(s => setServices(s.map(serviceToItem)))
      .catch(() => {})
      .finally(() => setServicesLoading(false));
    setBillsLoading(true);
    billService.list()
      .then(b => setBills(b.map(billToItem)))
      .catch(() => {})
      .finally(() => setBillsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
  
  // Roster Directory Database State
  const [locations, setLocations] = useState<Location[]>([]);
  const [telegramSessions, setTelegramSessions] = useState<TelegramSession[]>([]);
  const [telegramAccounts, setTelegramAccounts] = useState<TelegramAccount[]>(initialTelegramAccounts);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [configs, setConfigs] = useState<ReminderConfig[]>(initialReminderConfigs);
  const [messages, setMessages] = useState<MessageQueueItem[]>(initialMessageQueue);
  const [activities, setActivities] = useState<ActivityLog[]>(initialActivityLogs);

  // Layout context states
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  const [showARImportDialog, setShowARImportDialog] = useState(false);
  const [selectedSinglePreviewItem, setSelectedSinglePreviewItem] = useState<MessageQueueItem | null>(null);

  // Helper log activity
  const addActivity = (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error') => {
    const newLog: ActivityLog = {
      id: 'act-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4),
      action,
      details,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      type
    };
    setActivities(prev => [newLog, ...prev]);
  };

  // Trigger manual imports of direct chats mapping
  const handleImportChats = (locName: string, selectedChats: ChatImportItem[]) => {
    const loc = locations.find(l => l.name === locName);
    const locationId = loc ? parseInt(loc.id) : 0;

    // Persist each imported chat to the database
    selectedChats.forEach(c => {
      customerService.create({
        code: c.code,
        name: c.name,
        unit: c.unit,
        phone: c.phone,
        telegramHandle: c.telegram,
        email: c.email,
        telegramSessionContactId: c.telegramSessionContactId,
        locationId,
      }).catch(() => {});
    });

    // Update local state immediately for UI feedback
    const newResidents: Resident[] = selectedChats.map(c => ({
      code: c.code,
      name: c.name,
      unit: c.unit,
      telegram: c.telegram,
      balance: 0,
      status: 'Due' as const,
      locationName: locName,
      phone: c.phone,
      chatImported: true,
      joinDate: new Date().toISOString().substring(0, 10),
      email: c.email,
      telegramSessionContactId: c.telegramSessionContactId,
      profilePhoto: c.profilePhoto,
    }));
    setResidents(prev => [...newResidents, ...prev.filter(r => !selectedChats.some(c => c.code === r.code))]);

    setLocations(prev => prev.map(l =>
      l.name === locName ? { ...l, residentsCount: l.residentsCount + selectedChats.length } : l
    ));

    addActivity(
      'Telegram Import handshakes',
      `Successfully matched and resolved (${selectedChats.length}) new community chats under ${locName}`,
      'success'
    );
  };

  // Trigger Single Manual Reminder preview mapping
  const handleTriggerSingleReminder = (res: Resident) => {
    // Find due bills matching this resident
    const overdueBills = bills.filter(b => b.residentCode === res.code && b.status !== 'Paid');
    const firstBill = overdueBills[0];
    
    if (!firstBill) return;

    // Compose template draft text
    const matchingConfig = configs.find(c => c.name === 'Reminder 1') || configs[0];
    const computedText = formatTemplate(matchingConfig.template, {
      residentName: res.name,
      unitNumber: res.unit,
      billAmount: firstBill.amount,
      dueDate: firstBill.dueDate,
      serviceName: firstBill.service,
      locationName: res.locationName
    });

    const mockMsg: MessageQueueItem = {
      id: `msg-single-trig-${res.code}-${Math.random().toString(36).substring(2, 5)}`,
      residentCode: res.code,
      residentName: res.name,
      unit: res.unit,
      telegram: res.telegram,
      service: firstBill.service,
      amount: firstBill.amount,
      dueDate: firstBill.dueDate,
      offsetType: 'Manual Trigger',
      text: computedText,
      status: 'Pending',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      locationName: res.locationName
    };

    setMessages(prev => [mockMsg, ...prev]);
    setSelectedSinglePreviewItem(mockMsg);
    setActiveTab('Message Center');
    addActivity('Manual Reminder Queued', `Created direct Message draft target for ${res.name} (${res.telegram})`, 'info');
  };

  // Trigger Mass Batch Reminder Queueing
  const handleMultiBatchReminders = (targetBills: Bill[]) => {
    const newlyQueuedMsgs: MessageQueueItem[] = targetBills.map((b, idx) => {
      // Find matching configuration template
      const cfg = configs.find(c => c.enabled) || configs[0];
      const text = formatTemplate(cfg.template, {
        residentName: b.residentName,
        unitNumber: b.unit,
        billAmount: b.amount,
        dueDate: b.dueDate,
        serviceName: b.service,
        locationName: b.locationName
      });

      return {
        id: `msg-batch-${b.id}-${idx}`,
        residentCode: b.residentCode,
        residentName: b.residentName,
        unit: b.unit,
        telegram: residents.find(r => r.code === b.residentCode)?.telegram || '@username_missing',
        service: b.service,
        amount: b.amount,
        dueDate: b.dueDate,
        offsetType: cfg.name + ' (' + cfg.offset + ')',
        text,
        status: 'Pending',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        locationName: b.locationName
      };
    });

    setMessages(prev => [...newlyQueuedMsgs, ...prev]);
    setActiveTab('Message Center');
    addActivity(
      'Reminders Batch Compiled', 
      `Generated ${newlyQueuedMsgs.length} template handshakes reflecting scheduled intervals.`, 
      'success'
    );
  };

  const handleAddLocation = async (
    data: { name: string; code?: string; assignedTelegramSessionId?: number },
    logoFile?: File,
  ) => {
    const created = await propertyService.create(data, logoFile);
    const loc = propertyToLocation({ ...created, residentsCount: 0, outstandingBalance: 0 });
    setLocations(prev => {
      if (prev.length === 0) setSelectedLocation(loc.name);
      return [...prev, loc];
    });
  };

  const handleUpdateLocation = async (
    id: string,
    data: { name?: string; code?: string; logo?: string; assignedTelegramSessionId?: number | null },
    logoFile?: File,
  ) => {
    const updated = await propertyService.update(parseInt(id), data, logoFile);
    const oldName = locations.find(l => l.id === id)?.name;
    setLocations(prev => prev.map(l =>
      l.id === id
        ? {
            ...l,
            name: updated.name,
            logo: updated.logo ?? undefined,
            assignedTelegramSessionId: updated.assignedTelegramSessionId,
            assignedTelegramSession: updated.assignedTelegramSession,
          }
        : l
    ));
    if (updated.name && oldName && selectedLocation === oldName) {
      setSelectedLocation(updated.name);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    await propertyService.remove(parseInt(id));
    setLocations(prev => {
      const remaining = prev.filter(l => l.id !== id);
      if (selectedLocation === prev.find(l => l.id === id)?.name) {
        setSelectedLocation(remaining[0]?.name ?? '');
      }
      return remaining;
    });
  };

  const handleLogout = () => {
    clearStoredToken();
    setIsAuthenticated(false);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className="text-xs font-mono uppercase tracking-widest">Authenticating…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // Active Telegram account matching default or current context
  const activeTelegramAccount = telegramAccounts.find(t => t.isDefault) || telegramAccounts[0];

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-hidden">
      
      {/* Upper Full-Width Wrapper */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0" id="sidebar-panel">
          
          {/* Logo Brand Header */}
          <div className="h-16 px-5 flex items-center gap-3 shadow-sm shrink-0" id="sidebar-logo-header">
            <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-700 bg-slate-800 shrink-0 flex items-center justify-center">
              <img 
                src={logoImage} 
                alt="UK Condo Logo" 
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-100 tracking-wide uppercase"> UK CONDO</h2>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Property Collection</span>
            </div>
          </div>

          {/* Navigation Links Area */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
            {[
              { name: 'Dashboard', icon: LayoutDashboard },
              { name: 'Telegram Accounts', icon: Send, badge: telegramAccounts.filter(t => t.status === 'Connected').length },
              { name: 'Locations', icon: MapPin },
              { name: 'Residents', icon: Users },
              { name: 'Services', icon: Briefcase },
              { name: 'Accounts Receivable', icon: CreditCard, badge: bills.filter(b => b.status === 'Overdue').length },
              { name: 'Reminder Scheduler', icon: Clock },
              { name: 'Message Center', icon: MessageSquare, badge: messages.filter(m => m.status === 'Pending').length },
              { name: 'Reports', icon: BarChart3 },
              { name: 'Administration', icon: Sliders }
            ].map((item) => {
              const IconComp = item.icon;
              const isSelected = activeTab === item.name;
              
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setActiveTab(item.name);
                    setSelectedSinglePreviewItem(null);
                  }}
                  className={`w-full flex items-start justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition uppercase tracking-wide cursor-pointer text-left ${
                    isSelected 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-205'
                  }`}
                >
                  <span className="flex items-start gap-2.5 text-left min-w-0">
                    <IconComp className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${isSelected ? 'text-emerald-400' : 'text-slate-550'}`} />
                    <span className="leading-normal break-words">{item.name}</span>
                  </span>
                  
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[9px] font-black font-mono px-1.5 py-0.5 rounded-md shrink-0 ml-2 mt-0.5 ${
                      isSelected 
                        ? 'bg-emerald-500/20 text-emerald-300' 
                        : item.name === 'Accounts Receivable' 
                          ? 'bg-rose-500/10 text-rose-400' 
                          : 'bg-slate-800 text-slate-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Account Drawer Info on bottom corner */}
          <div className="p-4 border-t border-slate-150 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-blue-50 border-2 border-blue-500 flex items-center justify-center text-blue-600 font-bold shrink-0">
                <User className="h-4.5 w-4.5" />
              </div>
              <div className="text-xs">
                <strong className="block text-slate-800 font-black tracking-wider text-xs">S. Mean (IT)</strong>
                <span className="text-slate-500 font-mono font-bold text-[9px] tracking-wide uppercase">Operator Active</span>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="p-1 px-2.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition cursor-pointer font-bold border border-slate-200"
              title="Sign Out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </aside>

        {/* MAIN BODY CANVAS ROW */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          
          {/* HEADER TOP BAR */}
          <header className="h-16 bg-slate-900/40 px-6 flex items-center justify-between shrink-0" id="top-bar">
            
            {/* Quick Context selection stats */}
            <div className="flex items-center gap-4">


            </div>

            {/* Quick action badges */}
            <div className="flex items-center gap-3">
              
              {/* Notifications bell */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotificationDrawer(!showNotificationDrawer)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-700 pointer transition cursor-pointer"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400" />
                </button>

                {showNotificationDrawer && (
                  <div className="absolute right-0 mt-2 z-50 bg-slate-900 border border-slate-705 w-64 rounded-xl p-3 shadow-2xl space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block border-b border-slate-800 pb-1 font-bold">Unread Alerts</span>
                    <div className="space-y-2 max-h-[140px] overflow-y-auto no-scrollbar">
                      <div className="p-2 bg-slate-950 rounded border border-slate-850 text-[11px] leading-snug text-slate-300">
                        <strong>Arrears Synced</strong>: 538 new ledger files processed from July template data.
                      </div>
                      <div className="p-2 bg-slate-950 rounded border border-slate-850 text-[11px] leading-snug text-slate-300">
                        <strong>Operator linked</strong>: Manager account paired with database cron broker correctly.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status info */}
              <div className="hidden md:block text-right">
                <span className="text-[10px] block text-slate-550 select-none uppercase tracking-widest font-extrabold">SYSTEM LOGS</span>
                <span className="text-emerald-400 font-bold font-mono text-[10px] truncate">100% ONLINE</span>
              </div>
            </div>
          </header>

          {/* DYNAMIC SCENE CONTAINER */}
          <div className={`flex-1 ${activeTab === 'Locations' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto p-6 space-y-6'}`}>
            
            {activeTab === 'Dashboard' && (
              <DashboardView
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
                locations={locations}
                residents={residents}
                bills={bills}
                messages={messages}
                activities={activities}
                onAddActivity={addActivity}
              />
            )}

            {activeTab === 'Telegram Accounts' && (
              <TelegramAccountsView
                accounts={telegramAccounts}
                setAccounts={setTelegramAccounts}
                onAddActivity={addActivity}
                locations={locations}
              />
            )}

            {activeTab === 'Locations' && (
              <LocationsView
                locations={locations}
                residents={residents}
                bills={bills}
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
                setActiveTab={setActiveTab}
                onImportChats={handleImportChats}
                onAddActivity={addActivity}
                onOpenARImportModal={() => {
                  setActiveTab('Accounts Receivable');
                  setShowARImportDialog(true);
                }}
                telegramSessions={telegramSessions}
                onAddLocation={handleAddLocation}
                onUpdateLocation={handleUpdateLocation}
                onDeleteLocation={handleDeleteLocation}
              />
            )}

            {activeTab === 'Residents' && (
              <ResidentsView
                residents={residents}
                setResidents={setResidents}
                bills={bills}
                setBills={setBills}
                messages={messages}
                setMessages={setMessages}
                selectedLocation={selectedLocation}
                onAddActivity={addActivity}
                onTriggerSingleReminder={handleTriggerSingleReminder}
              />
            )}

            {activeTab === 'Services' && (
              <ServicesView
                services={services}
                setServices={setServices}
                servicesLoading={servicesLoading}
                onAddActivity={addActivity}
              />
            )}

            {activeTab === 'Accounts Receivable' && (
              <ARView
                bills={bills}
                setBills={setBills}
                billsLoading={billsLoading}
                residents={residents}
                setResidents={setResidents}
                locations={locations}
                services={services}
                onAddActivity={addActivity}
                onTriggerBatchReminders={handleMultiBatchReminders}
                showImportModalOnInit={showARImportDialog}
                onCloseImportModalOnInit={() => setShowARImportDialog(false)}
              />
            )}

            {activeTab === 'Reminder Scheduler' && (
              <ReminderSchedulerView
                configs={configs}
                setConfigs={setConfigs}
                onAddActivity={addActivity}
              />
            )}

            {activeTab === 'Message Center' && (
              <MessageCenterView
                messages={messages}
                setMessages={setMessages}
                selectedLocation={selectedLocation}
                onAddActivity={addActivity}
                singleMessagePreviewItem={selectedSinglePreviewItem}
                onClearSinglePreview={() => setSelectedSinglePreviewItem(null)}
              />
            )}

            {activeTab === 'Reports' && (
              <ReportsView
                locations={locations}
                residents={residents}
                bills={bills}
                services={services}
                selectedLocation={selectedLocation}
              />
            )}

            {activeTab === 'Administration' && (
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">ADMIN PORTAL</span>
                  <h1 className="text-2xl font-bold text-slate-100 tracking-tight">System Administration Panel</h1>
                </div>

                <div className="bg-slate-800/40 border border-slate-705 p-6 rounded-2xl max-w-3xl space-y-4">
                  <span className="text-xs font-bold text-slate-300 block pb-2 border-b border-slate-800 uppercase tracking-wider">Operational parameters</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-1">
                      <span className="font-bold text-slate-105 block">Handshake router URL</span>
                      <code className="text-emerald-400 font-mono text-[11px] block text-slate-400">https://api.uk313.cloud/handshake</code>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-1">
                      <span className="font-bold text-slate-105 block">Transmission intervals</span>
                      <strong className="text-slate-100 mt-1 block">Sequenced 1.5 seconds SLA delays</strong>
                    </div>
                  </div>
                  
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-widest block">System Diagnostics</span>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Database Link Active</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Telegram Broker API Key Valid</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" /> SSL Handshake Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

    </div>
  );
}
