/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Building,
  Search,
  Users,
  UserPlus,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  SearchCode,
  Plus,
  Sparkles,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  MessageSquare
} from 'lucide-react';
import { Location, Resident, Bill, ChatImportItem } from '../types';
import { TelegramSession, TelegramContactItem, telegramService } from '../lib/api';

interface LocationsViewProps {
  locations: Location[];
  residents: Resident[];
  bills: Bill[];
  selectedLocation: string;
  setSelectedLocation: (name: string) => void;
  setActiveTab: (tab: string) => void;
  onImportChats: (locationName: string, selectedChats: ChatImportItem[]) => void;
  onAddActivity: (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenARImportModal: () => void;
  telegramSessions: TelegramSession[];
  onAddLocation: (data: { name: string; code?: string; assignedTelegramSessionId?: number }, logoFile?: File) => Promise<void>;
  onUpdateLocation: (id: string, data: { name?: string; code?: string; logo?: string; assignedTelegramSessionId?: number | null }, logoFile?: File) => Promise<void>;
  onDeleteLocation: (id: string) => Promise<void>;
}

interface LocationForm {
  name: string;
  code: string;
  logo: string;
  assignedTelegramSessionId: number | null;
}

export default function LocationsView({
  locations,
  residents,
  bills,
  selectedLocation,
  setSelectedLocation,
  setActiveTab,
  onImportChats,
  onAddActivity,
  onOpenARImportModal,
  telegramSessions,
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation,
}: LocationsViewProps) {
  const [condoSearchQuery, setCondoSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedChatCodes, setSelectedChatCodes] = useState<string[]>([]);
  const [telegramChats, setTelegramChats] = useState<TelegramContactItem[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [syncedContactIds, setSyncedContactIds] = useState<Set<number>>(new Set());
  const [importSearchQuery, setImportSearchQuery] = useState('');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncActiveRef = useRef(false);

  const stopPhotoSync = () => {
    syncActiveRef.current = false;
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  };

  const startPhotoSync = (chats: TelegramContactItem[]) => {
    stopPhotoSync();
    const pending = chats.filter(c => !c.profilePhoto);
    if (pending.length === 0) return;
    syncActiveRef.current = true;
    let index = 0;
    const syncNext = () => {
      if (!syncActiveRef.current || index >= pending.length) return;
      const contact = pending[index++];
      telegramService.syncContactPhoto(contact.id)
        .then(res => {
          if (res.data && typeof res.data === 'string') {
            setTelegramChats(prev =>
              prev.map(c => c.id === contact.id ? { ...c, profilePhoto: res.data as string } : c)
            );
          }
        })
        .catch(() => {})
        .finally(() => {
          setSyncedContactIds(prev => new Set([...prev, contact.id]));
          if (syncActiveRef.current && index < pending.length) {
            syncTimerRef.current = setTimeout(syncNext, 2500);
          }
        });
    };
    syncNext();
  };

  useEffect(() => {
    return () => stopPhotoSync();
  }, []);

  const [sendConfigs, setSendConfigs] = useState<Record<string, 'auto' | 'sent' | 'unconfigured' | 'sending'>>({
    'RES-D201': 'auto',
    'RES-D202': 'sent',
    'RES-D301': 'sent',
    'RES-D302': 'unconfigured',
    'RES-D401': 'sending',
    'RES-S101': 'auto',
    'RES-S202': 'sent',
    'RES-S303': 'unconfigured',
    'RES-G101': 'auto',
    'RES-G205': 'unconfigured',
    'RES-R110': 'sent',
    'RES-R120': 'auto',
  });

  const [openDropdownCode, setOpenDropdownCode] = useState<string | null>(null);

  // CRUD state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationForm, setLocationForm] = useState<LocationForm>({ name: '', code: '', logo: '', assignedTelegramSessionId: null });
  const [showTgDropdown, setShowTgDropdown] = useState(false);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const updateSendConfig = (code: string, newStatus: 'auto' | 'sent' | 'unconfigured' | 'sending') => {
    setSendConfigs(prev => ({ ...prev, [code]: newStatus }));
    onAddActivity(
      'Updated dispatch strategy',
      `Modified resident ${code} delivery status to ${
        newStatus === 'auto' ? 'Auto Schedule Send' :
        newStatus === 'sent' ? 'Marked as Sent' :
        newStatus === 'sending' ? 'Sending in Progress' : 'Unconfigured'
      }.`,
      'info'
    );
  };

  const activeCondoName = locations.some(l => l.name === selectedLocation)
    ? selectedLocation
    : (locations[0]?.name || '');
  const activeLoc = locations.find(l => l.name === activeCondoName) || locations[0];

  const filteredCondos = locations.filter(loc =>
    loc.name.toLowerCase().includes(condoSearchQuery.toLowerCase())
  );

  const activeResidents = residents.filter(r => r.locationName === activeCondoName);
  const filteredChats = activeResidents.filter(res =>
    res.name.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
    res.telegram.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
    res.unit.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
    res.phone.toLowerCase().includes(chatSearchQuery.toLowerCase())
  );

  const getChatsStatus = (locName: string) => {
    const importedCount = residents.filter(r => r.locationName === locName && r.chatImported).length;
    return { importedCount, allImported: false };
  };

  const { importedCount, allImported } = getChatsStatus(activeCondoName);

  const filteredImportChats = telegramChats.filter(c => {
    if (!importSearchQuery) return true;
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || c.phone || '';
    const q = importSearchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.username || '').toLowerCase().includes(q);
  });
  const importNonImported = filteredImportChats.filter(c => !residents.some(
    r => (c.phone && r.phone === c.phone) || (c.username && r.telegram === `@${c.username.replace(/^@/, '')}`)
  ));
  const importAllSelected = importNonImported.length > 0 && importNonImported.every(c => selectedChatCodes.includes(String(c.id)));
  const importSomeSelected = !importAllSelected && importNonImported.some(c => selectedChatCodes.includes(String(c.id)));
  const importListRef = useRef<HTMLDivElement>(null);
  const importVirtualizer = useVirtualizer({
    count: filteredImportChats.length,
    getScrollElement: () => importListRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  const startImportChats = async () => {
    const sessionId = activeLoc?.assignedTelegramSessionId;
    stopPhotoSync();
    setTelegramChats([]);
    setSelectedChatCodes([]);
    setSyncedContactIds(new Set());
    setImportSearchQuery('');
    setShowImportModal(true);
    if (!sessionId) return;
    setChatsLoading(true);
    try {
      const contacts = await telegramService.sessionContacts(sessionId);
      setTelegramChats(contacts);
      startPhotoSync(contacts);
    } catch {
      setTelegramChats([]);
    } finally {
      setChatsLoading(false);
    }
  };

  const handleToggleChatSelect = (code: string) => {
    if (selectedChatCodes.includes(code)) {
      setSelectedChatCodes(selectedChatCodes.filter(c => c !== code));
    } else {
      setSelectedChatCodes([...selectedChatCodes, code]);
    }
  };

  const executeImport = () => {
    const selected = telegramChats.filter(c => selectedChatCodes.includes(String(c.id)));
    if (selected.length === 0) return;
    const chatsToPush: ChatImportItem[] = selected.map(c => ({
      code: `TG-${c.id}`,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || c.phone || 'Unknown',
      unit: '',
      telegram: c.username ? `@${c.username.replace(/^@/, '')}` : '',
      phone: c.phone ?? '',
      email: '',
      telegramSessionContactId: c.id,
      profilePhoto: c.profilePhoto,
    }));
    onImportChats(activeCondoName, chatsToPush);
    stopPhotoSync();
    setShowImportModal(false);
    onAddActivity(
      'Telegram Chats Synchronized',
      `Manually synced & imported ${chatsToPush.length} active resident channels into ${activeCondoName} resident directory.`,
      'success'
    );
  };

  const handleSelectCondo = (condoName: string) => {
    setSelectedLocation(condoName);
    setChatSearchQuery('');
    onAddActivity('Property Context Switched', `Active workspace changed to ${condoName}`, 'info');
  };

  // CRUD handlers
  const openAddModal = () => {
    setEditingLocation(null);
    setLocationForm({ name: '', code: '', logo: '', assignedTelegramSessionId: null });
    setLogoFile(null);
    setLogoPreview('');
    setShowLocationModal(true);
  };

  const openEditModal = (loc: Location) => {
    setEditingLocation(loc);
    setLocationForm({
      name: loc.name,
      code: '',
      logo: loc.logo || '',
      assignedTelegramSessionId: loc.assignedTelegramSessionId ?? null,
    });
    setLogoFile(null);
    setLogoPreview('');
    setOpenCardMenuId(null);
    setShowLocationModal(true);
  };

  const tgSessionLabel = (s: TelegramSession) =>
    [s.firstName, s.lastName].filter(Boolean).join(' ') || s.userName || s.phoneNumber || 'Unknown';

  const tgSessionInitials = (s: TelegramSession) =>
    tgSessionLabel(s).substring(0, 2).toUpperCase();

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    if (logoFileInputRef.current) logoFileInputRef.current.value = '';
  };

  const handleSaveLocation = async () => {
    if (!locationForm.name.trim()) return;
    setSaving(true);
    try {
      if (editingLocation) {
        await onUpdateLocation(
          editingLocation.id,
          {
            name: locationForm.name.trim(),
            code: locationForm.code.trim() || undefined,
            logo: locationForm.logo,
            assignedTelegramSessionId: locationForm.assignedTelegramSessionId,
          },
          logoFile ?? undefined,
        );
        onAddActivity('Property Updated', `Updated property "${locationForm.name}"`, 'success');
      } else {
        await onAddLocation(
          {
            name: locationForm.name.trim(),
            code: locationForm.code.trim() || undefined,
            assignedTelegramSessionId: locationForm.assignedTelegramSessionId ?? undefined,
          },
          logoFile ?? undefined,
        );
        onAddActivity('Property Created', `Added new property "${locationForm.name}"`, 'success');
      }
      setShowLocationModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingLocationId) return;
    const loc = locations.find(l => l.id === deletingLocationId);
    setSaving(true);
    try {
      await onDeleteLocation(deletingLocationId);
      onAddActivity('Property Deleted', `Removed property "${loc?.name}"`, 'warning');
      setDeletingLocationId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] w-full divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden bg-slate-950" id="locations-view-panel">

      {/* LEFT SIDEBAR */}
      <div className="w-full lg:w-[304px] shrink-0 flex flex-col h-full bg-slate-900/15 overflow-hidden">

        {/* Search + Add button header */}
        <div className="px-3 h-[55px] border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10 shrink-0 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-[10px] h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search properties..."
              value={condoSearchQuery}
              onChange={(e) => setCondoSearchQuery(e.target.value)}
              className="w-full bg-slate-955 border border-slate-800 text-slate-200 text-xs rounded-lg pl-8 pr-3 h-[35px] focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={openAddModal}
            title="Add Property"
            className="h-[35px] w-[35px] shrink-0 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center transition cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable property list */}
        <div className="p-3 space-y-1 overflow-y-auto flex-1">
          {filteredCondos.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No properties match your filter.
            </div>
          ) : (
            filteredCondos.map((loc) => {
              const isActive = activeCondoName === loc.name;

              const initials = loc.name
                .replace('Condo ', '')
                .replace('Borey ', '')
                .replace('Estate ', '')
                .split(' ')
                .map(word => word[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

              const colors = [
                'bg-blue-500/10 text-blue-400 border-blue-500/20',
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'bg-purple-500/10 text-purple-400 border-purple-500/20',
                'bg-amber-500/10 text-amber-500 border-amber-500/20'
              ];
              const bgType = colors[loc.name.length % colors.length];

              const locOutstanding = bills
                .filter(b => b.locationName === loc.name && b.status !== 'Paid')
                .reduce((sum, b) => sum + b.amount, 0);

              const locActiveChats = residents.filter(r => r.locationName === loc.name).length;

              return (
                <div
                  key={loc.id}
                  className={`relative w-full rounded-xl border transition-all group ${
                    isActive
                      ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-100 shadow-sm shadow-blue-200/50'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  {/* Clickable selection area */}
                  <div
                    onClick={() => handleSelectCondo(loc.name)}
                    className="p-3.5 flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {loc.logo ? (
                        <img
                          src={loc.logo}
                          alt={loc.name}
                          className={`h-10 w-10 rounded-full object-cover border shrink-0 bg-white ${isActive ? 'border-blue-400' : 'border-slate-200'}`}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-black text-xs border shrink-0 ${bgType}`}>
                          {initials}
                        </div>
                      )}

                      <div className="min-w-0">
                        <span className={`font-black block text-sm tracking-wide truncate ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>{loc.name}</span>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-[11px] font-bold text-slate-500">
                          <span className={`flex items-center gap-1 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-600'}`}>
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            {locActiveChats} Chats
                          </span>
                          <span className="text-slate-400 font-normal">•</span>
                          <span className="font-mono text-emerald-600 font-extrabold shrink-0">
                            ${locOutstanding ? locOutstanding.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center shrink-0 mr-5">
                      {isActive ? (
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-md shadow-blue-500/50 animate-pulse" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* 3-dot action menu */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenCardMenuId(openCardMenuId === loc.id ? null : loc.id);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Actions"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>

                  {openCardMenuId === loc.id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setOpenCardMenuId(null)} />
                      <div className="absolute right-2 top-8 z-30 w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1 overflow-hidden">
                        <button
                          onClick={() => openEditModal(loc)}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5 text-blue-500" />
                          Edit Property
                        </button>
                        <button
                          onClick={() => { setDeletingLocationId(loc.id); setOpenCardMenuId(null); }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">

        {/* Sub top navbar */}
        <div className="px-3 h-[55px] border-b border-slate-800 bg-slate-900/40 flex items-center justify-between gap-4 sticky top-0 z-10 shrink-0">

          <div className="flex flex-col md:flex-row md:items-center gap-4 min-w-0 flex-1">
            {(() => {
              const tg = activeLoc?.assignedTelegramSession;
              const tgName = tg
                ? ([tg.firstName, tg.lastName].filter(Boolean).join(' ') || tg.phoneNumber || 'Unknown')
                : null;
              const tgInitials = tgName ? tgName.substring(0, 2).toUpperCase() : null;
              return (
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="relative shrink-0">
                    {tg?.profilePhoto ? (
                      <img
                        src={tg.profilePhoto}
                        alt={tgName ?? ''}
                        className="h-[35px] w-[35px] rounded-full object-cover border border-slate-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-[35px] w-[35px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center text-[11px] font-black">
                        {tgInitials ?? <MessageSquare className="h-4 w-4" />}
                      </div>
                    )}
                    {tg && (
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${tg.isAuthorized ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase tracking-wider text-blue-600/95 font-extrabold block leading-none">Telegram Account</span>
                    <span className="text-xs font-black text-slate-900 block truncate mt-0.5 tracking-wide">
                      {tgName ?? 'No Account Assigned'}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="relative w-full md:w-56">
              <Search className="absolute left-2.5 top-[10px] h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter linked threads..."
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-lg pl-8 pr-3 h-[35px] focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <button
              disabled={allImported}
              onClick={startImportChats}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer leading-none h-7 transition shadow-lg shadow-blue-500/5 disabled:opacity-40"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Sync Thread Chats</span>
              {importedCount > 0 && (
                <span className="text-[8px] bg-slate-950 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded font-mono font-bold">
                  +{importedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Resident chat list */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Mapped Telegram Chats ({activeResidents.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-600 font-mono font-bold">
              Showing {filteredChats.length} of {activeResidents.length} mapped
            </span>
          </div>

          {filteredChats.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-slate-200 rounded-xl space-y-2">
              <SearchCode className="h-10 w-10 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600 font-bold">No linked Telegram threads found.</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Type a different search term or use the <strong className="text-blue-600 cursor-pointer" onClick={startImportChats}>Sync Thread Chats</strong> button to link new active resident chats.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 select-none uppercase tracking-wider font-semibold bg-slate-50">
                      <th className="py-3 px-4">Resident / Thread Link</th>
                      <th className="py-3 px-4">Unpaid Balance</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right pr-6">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredChats.map((chat) => {
                      const residentBills = bills.filter(b => b.residentCode === chat.code && b.status !== 'Paid');
                      const totalUnpaid = residentBills.reduce((accBill, b) => accBill + b.amount, 0);

                      const userInitials = chat.name
                        .split(' ')
                        .map(word => word[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase();

                      const status = sendConfigs[chat.code] || 'unconfigured';
                      const photoUrl = chat.profilePhoto || chat.avatar;

                      return (
                        <tr key={chat.code} className="hover:bg-slate-50 transition">
                          <td className="py-3.5 px-4 flex items-center gap-3">
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={chat.name}
                                className="h-10 w-10 rounded-full object-cover border border-slate-200 shrink-0 shadow-sm"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs border border-slate-200 bg-slate-50 text-slate-705 shrink-0 shadow-sm">
                                {userInitials}
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-[13px] sm:text-sm text-slate-900 tracking-wide block">{chat.name}</span>
                                <span className="text-[9px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-black uppercase border border-blue-100">
                                  Unit {chat.unit}
                                </span>
                              </div>
                              <div className="text-slate-500 font-mono text-[10.5px] flex items-center gap-1.5 mt-1 font-bold">
                                <span className="text-slate-400">Phone:</span>
                                <span className="text-slate-800 font-black">{chat.phone}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {totalUnpaid > 0 ? (
                              <span className="font-bold text-rose-600 font-mono text-sm">
                                ${totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="h-2.5 w-2.5" />
                                Paid & Cleared
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="relative inline-block text-left">
                              {status === 'auto' && (
                                <button
                                  onClick={() => setOpenDropdownCode(openDropdownCode === chat.code ? null : chat.code)}
                                  className="flex items-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-full text-[11px] font-extrabold border border-blue-100 transition shadow-sm cursor-pointer"
                                >
                                  <Sparkles className="h-3 w-3 shrink-0 text-blue-500 animate-pulse" />
                                  <span>Sending in 4 days</span>
                                </button>
                              )}

                              {status === 'sending' && (
                                <button
                                  onClick={() => setOpenDropdownCode(openDropdownCode === chat.code ? null : chat.code)}
                                  className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-full text-[11px] font-extrabold border border-indigo-100 transition shadow-sm cursor-pointer"
                                >
                                  <Loader2 className="h-3.5 w-3.5 text-indigo-500 shrink-0 animate-spin" />
                                  <span>Sending</span>
                                </button>
                              )}

                              {status === 'sent' && (
                                <button
                                  onClick={() => setOpenDropdownCode(openDropdownCode === chat.code ? null : chat.code)}
                                  className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-full text-[11px] font-extrabold border border-emerald-100 transition shadow-sm cursor-pointer"
                                >
                                  <div className="h-3.5 w-3.5 rounded bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                    <Check className="h-2.5 w-2.5 stroke-[3px]" />
                                  </div>
                                  <span>Sent</span>
                                </button>
                              )}

                              {status === 'unconfigured' && (
                                <button
                                  onClick={() => setOpenDropdownCode(openDropdownCode === chat.code ? null : chat.code)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg uppercase transition cursor-pointer"
                                >
                                  <Plus className="h-3.5 w-3.5 text-amber-600" />
                                  <span>Configure</span>
                                </button>
                              )}

                              {openDropdownCode === chat.code && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownCode(null)} />
                                  <div className="absolute left-0 mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-xl z-25 py-1 divide-y divide-slate-100 overflow-hidden">
                                    <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-slate-400 font-extrabold select-none">
                                      Dispatch Strategy
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => { updateSendConfig(chat.code, 'auto'); setOpenDropdownCode(null); }}
                                      className={`w-full text-left px-3 py-2 text-[11px] font-bold flex items-center gap-2 hover:bg-blue-50 transition cursor-pointer ${status === 'auto' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}
                                    >
                                      <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      <span>Auto Schedule Send</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { updateSendConfig(chat.code, 'sending'); setOpenDropdownCode(null); }}
                                      className={`w-full text-left px-3 py-2 text-[11px] font-bold flex items-center gap-2 hover:bg-indigo-50 transition cursor-pointer ${status === 'sending' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'}`}
                                    >
                                      <Loader2 className="h-3.5 w-3.5 text-indigo-500 shrink-0 animate-spin" />
                                      <span>Sending in Progress</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { updateSendConfig(chat.code, 'sent'); setOpenDropdownCode(null); }}
                                      className={`w-full text-left px-3 py-2 text-[11px] font-bold flex items-center gap-2 hover:bg-emerald-50 transition cursor-pointer ${status === 'sent' ? 'text-emerald-600 bg-emerald-50/50' : 'text-slate-700'}`}
                                    >
                                      <div className="h-3.5 w-3.5 rounded bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                        <Check className="h-2.5 w-2.5 stroke-[3px]" />
                                      </div>
                                      <span>Mark as Sent</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { updateSendConfig(chat.code, 'unconfigured'); setOpenDropdownCode(null); }}
                                      className={`w-full text-left px-3 py-2 text-[11px] font-bold flex items-center gap-2 hover:bg-slate-50 transition cursor-pointer ${status === 'unconfigured' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-700'}`}
                                    >
                                      <Plus className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                      <span>Unconfigured</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right pr-6">
                            <button
                              onClick={() => {
                                setSelectedLocation(chat.locationName);
                                setActiveTab('Message Center');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 text-[10px] font-bold rounded-lg uppercase transition cursor-pointer"
                            >
                              <span>Chat Stream</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sync Thread Chats modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-55 flex flex-col bg-slate-900">
          <div className="flex flex-col h-full w-full p-6 gap-4 overflow-hidden">

            <div className="pb-3 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <UserPlus className="h-4.5 w-4.5 text-blue-500" />
                  Link Telegram Chat threads to Roster
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Property Destination: <strong className="text-blue-400 font-semibold">{activeCondoName}</strong>
                </p>
              </div>
              <button
                onClick={() => { stopPhotoSync(); setShowImportModal(false); }}
                className="text-slate-500 hover:text-slate-350 bg-slate-800 p-2 rounded-lg text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Search box */}
            <div className="relative">
              <Search className="absolute left-2.5 top-[9px] h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search contacts…"
                value={importSearchQuery}
                onChange={e => setImportSearchQuery(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-3 h-[34px] focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-slate-600"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-2.5 px-1 pb-2">
                <input
                  id="import-select-all"
                  type="checkbox"
                  checked={importAllSelected}
                  ref={el => { if (el) el.indeterminate = importSomeSelected; }}
                  onChange={() => {
                    if (importAllSelected) {
                      setSelectedChatCodes(prev => prev.filter(id => !importNonImported.some(c => String(c.id) === id)));
                    } else {
                      setSelectedChatCodes(prev => [...new Set([...prev, ...importNonImported.map(c => String(c.id))])]);
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-blue-500 cursor-pointer"
                />
                <label htmlFor="import-select-all" className="text-[10px] uppercase font-mono font-bold text-slate-500 cursor-pointer select-none">Select All</label>
              </div>

              {chatsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading contacts…
                </div>
              ) : (
                <div ref={importListRef} className="flex-1 overflow-y-auto pr-1">
                  <div style={{ height: `${importVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                    {importVirtualizer.getVirtualItems().map(vRow => {
                      const chat = filteredImportChats[vRow.index];
                      const key = String(chat.id);
                      const chatName = [chat.firstName, chat.lastName].filter(Boolean).join(' ') || chat.username || chat.phone || 'Unknown';
                      const isSelected = selectedChatCodes.includes(key);
                      const isAlreadyPresent = residents.some(
                        r => (chat.phone && r.phone === chat.phone) ||
                             (chat.username && r.telegram === `@${chat.username.replace(/^@/, '')}`)
                      );
                      return (
                        <div
                          key={vRow.key}
                          data-index={vRow.index}
                          ref={importVirtualizer.measureElement}
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)`, paddingBottom: '8px' }}
                        >
                          <div
                            onClick={() => !isAlreadyPresent && handleToggleChatSelect(key)}
                            className={`p-3 rounded-xl border text-xs flex justify-between items-center select-none transition ${
                              isAlreadyPresent
                                ? 'bg-emerald-500/5 border-emerald-500/10 text-slate-500 opacity-60 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-slate-800 border-blue-500/40 text-slate-100 cursor-pointer'
                                  : 'bg-slate-950/40 border-slate-850 text-slate-300 hover:border-slate-700 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                isAlreadyPresent
                                  ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                  : isSelected
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'border-slate-600 bg-slate-900'
                              }`}>
                                {(isSelected || isAlreadyPresent) && (
                                  <span className="text-[10px] font-black">✓</span>
                                )}
                              </div>
                              {(() => {
                                const isSynced = syncedContactIds.has(chat.id);
                                if (chat.profilePhoto) {
                                  return (
                                    <div className="relative h-8 w-8 shrink-0">
                                      <div className="skeleton-avatar absolute inset-0 rounded-full" />
                                      <img
                                        src={chat.profilePhoto}
                                        alt={chatName}
                                        className="absolute inset-0 h-8 w-8 rounded-full object-cover border border-slate-200 opacity-0 transition-opacity duration-300"
                                        referrerPolicy="no-referrer"
                                        onLoad={e => { (e.currentTarget as HTMLImageElement).style.opacity = '1'; }}
                                      />
                                    </div>
                                  );
                                }
                                if (!isSynced) {
                                  return <div className="skeleton-avatar h-8 w-8 rounded-full shrink-0" />;
                                }
                                return (
                                  <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                                    {chatName.substring(0, 2).toUpperCase()}
                                  </div>
                                );
                              })()}
                              <div>
                                <span className="font-semibold text-slate-100">{chatName}</span>
                                {chat.phone && (
                                  <span className="ml-2 font-mono text-[10px] text-slate-500 bg-slate-900 py-0.5 px-2 rounded-md border border-slate-850">
                                    {chat.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              {chat.username && <span className="font-mono text-slate-400 text-[11px]">@{chat.username.replace(/^@/, '')}</span>}
                              {isAlreadyPresent && (
                                <span className="text-[10px] font-semibold text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  Imported
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => { stopPhotoSync(); setShowImportModal(false); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={selectedChatCodes.length === 0}
                onClick={executeImport}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer disabled:opacity-40"
              >
                Import Thread Channels ({selectedChatCodes.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Property modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">

            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">
                {editingLocation ? 'Edit Property' : 'Add New Property'}
              </h3>
              <button
                onClick={() => setShowLocationModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Property Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. UK 313, Borey Peng Huoth"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Property Code <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={locationForm.code}
                  onChange={(e) => setLocationForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. UK313"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Logo <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
                <div className="flex items-center gap-3">
                  {/* Preview circle */}
                  <div className="h-14 w-14 rounded-full border-2 border-dashed border-slate-300 shrink-0 overflow-hidden bg-slate-50 flex items-center justify-center">
                    {(logoPreview || locationForm.logo) ? (
                      <img
                        src={logoPreview || locationForm.logo}
                        alt="logo"
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Building className="h-6 w-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition cursor-pointer"
                    >
                      {(logoPreview || locationForm.logo) ? 'Change Logo' : 'Upload Logo'}
                    </button>
                    {(logoPreview || locationForm.logo) && (
                      <button
                        type="button"
                        onClick={() => { setLogoFile(null); setLogoPreview(''); setLocationForm(f => ({ ...f, logo: '' })); }}
                        className="block text-[11px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400">JPEG, PNG, GIF or WebP · max 5 MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Assigned Telegram Account <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  {(() => {
                    const selected = telegramSessions.find(s => s.id === locationForm.assignedTelegramSessionId);
                    return (
                      <button
                        type="button"
                        onClick={() => setShowTgDropdown(v => !v)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-left flex items-center gap-2 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
                      >
                        {selected ? (
                          <>
                            {selected.profilePhoto ? (
                              <img src={selected.profilePhoto} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">
                                {tgSessionInitials(selected)}
                              </div>
                            )}
                            <span className="flex-1 truncate text-slate-800 font-semibold">{tgSessionLabel(selected)}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 border ${selected.isAuthorized ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                              {selected.isAuthorized ? 'Active' : 'Offline'}
                            </span>
                          </>
                        ) : (
                          <span className="flex-1 text-slate-400">No account assigned</span>
                        )}
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      </button>
                    );
                  })()}

                  {showTgDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowTgDropdown(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => { setLocationForm(f => ({ ...f, assignedTelegramSessionId: null })); setShowTgDropdown(false); }}
                          className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 border-b border-slate-100 font-semibold"
                        >
                          None / Unassign
                        </button>
                        {telegramSessions.length === 0 ? (
                          <div className="px-3 py-4 text-xs text-slate-400 text-center">No Telegram accounts configured</div>
                        ) : (
                          telegramSessions.map(session => (
                            <button
                              key={session.id}
                              type="button"
                              onClick={() => { setLocationForm(f => ({ ...f, assignedTelegramSessionId: session.id })); setShowTgDropdown(false); }}
                              className={`w-full px-3 py-2.5 text-left flex items-center gap-2.5 hover:bg-slate-50 transition ${locationForm.assignedTelegramSessionId === session.id ? 'bg-blue-50' : ''}`}
                            >
                              {session.profilePhoto ? (
                                <img src={session.profilePhoto} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black shrink-0">
                                  {tgSessionInitials(session)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-800 truncate">{tgSessionLabel(session)}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{session.phoneNumber ?? session.userName}</div>
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 border ${session.isAuthorized ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                {session.isAuthorized ? 'Active' : 'Offline'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLocation}
                disabled={!locationForm.name.trim() || saving}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingLocation ? 'Save Changes' : 'Create Property'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deletingLocationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Delete Property?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  This will permanently remove <strong className="text-slate-800">{locations.find(l => l.id === deletingLocationId)?.name}</strong> and cannot be undone. All linked residents will lose their location reference.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingLocationId(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={saving}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Property
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
