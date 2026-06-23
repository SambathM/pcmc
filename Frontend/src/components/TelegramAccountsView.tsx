/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, Key, Check, QrCode, Building, MapPin, Phone, Search, Smartphone, RefreshCw } from 'lucide-react';
import QRCode from 'react-qr-code';
import { TelegramAccount, Location } from '../types';
import { telegramService, type TgQrCodeResponse, type TelegramSession } from '../lib/api';
import { signalRService, TgEvent, type QrChangePayload } from '../lib/signalr';

interface TelegramAccountsViewProps {
  accounts: TelegramAccount[];
  setAccounts: (accounts: TelegramAccount[]) => void;
  onAddActivity: (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  locations: Location[];
}

function sessionToAccount(session: TelegramSession): TelegramAccount {
  const rawName = [session.firstName, session.lastName].filter(Boolean).join(' ').trim();
  const name = rawName || session.userName || `Account ${session.id}`;
  const username = session.userName
    ? (session.userName.startsWith('@') ? session.userName : '@' + session.userName)
    : '';
  return {
    id: String(session.id),
    name,
    username,
    phone: session.phoneNumber ?? '',
    status: session.isAuthorized ? 'Connected' : 'Disconnected',
    isDefault: true,
    logo: session.profilePhoto,
  };
}

export default function TelegramAccountsView({
  accounts,
  setAccounts,
  onAddActivity,
  locations,
}: TelegramAccountsViewProps) {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectSuccess, setConnectSuccess] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountPhone, setNewAccountPhone] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  // Connect modal states
  const [loginTab, setLoginTab] = useState<'qr' | 'phone'>('phone');
  const [qrData, setQrData] = useState<TgQrCodeResponse | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'idle' | 'code' | '2fa'>('idle');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [connectError, setConnectError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accountsRef = useRef<TelegramAccount[]>(accounts);
  useEffect(() => { accountsRef.current = accounts; });
  const [qrStep, setQrStep] = useState<'qr' | 'password'>('qr');
  const [qrPassword, setQrPassword] = useState('');

  const [attachedLocationsModal, setAttachedLocationsModal] = useState<{
    accountName: string;
    locationsList: Location[];
  } | null>(null);

  // Load real session and connect SignalR on mount
  useEffect(() => {
    setIsLoadingAccounts(true);
    telegramService.sessions()
      .then(sessions => setAccounts(sessions.map(sessionToAccount)))
      .catch(() => setAccounts([]))
      .finally(() => setIsLoadingAccounts(false));

    telegramService.clientId()
      .then(groupName => signalRService.connect(groupName))
      .catch(() => {});

    const onQrChange = (payload: QrChangePayload) => {
      setQrData(prev => prev ? { ...prev, qrCode: payload.qrCode } : null);
      setConnectError('');
    };

    const onQrTimeout = () => {
      stopQrPoll();
      setConnectError('QR code expired. Click "Refresh QR" to generate a new one.');
    };

    const onPasswordState = () => setQrStep('password');

    const onLoggedIn = (session: TelegramSession) => {
      stopQrPoll();
      const acc = sessionToAccount(session);
      setAccounts([acc, ...accountsRef.current.filter(a => a.id !== acc.id)]);
      setConnectSuccess(true);
      setShowConnectModal(true);
      setTimeout(() => {
        setShowConnectModal(false);
        setConnectSuccess(false);
      }, 1400);
      onAddActivity('Telegram Account Connected', `Connected ${acc.name} (${acc.phone}) as active collection operator.`, 'success');
    };

    const onDisconnected = () => {
      setAccounts(accountsRef.current.map(a => ({ ...a, status: 'Disconnected' as const })));
      onAddActivity('Telegram Disconnected', 'Session disconnected by server.', 'warning');
    };

    signalRService.on<QrChangePayload>(TgEvent.QrChange, onQrChange);
    signalRService.on(TgEvent.QrTimeout, onQrTimeout);
    signalRService.on(TgEvent.PasswordState, onPasswordState);
    signalRService.on<TelegramSession>(TgEvent.LoggedIn, onLoggedIn);
    signalRService.on<TelegramSession>(TgEvent.Authorized, onLoggedIn);
    signalRService.on(TgEvent.Disconnected, onDisconnected);

    return () => {
      signalRService.off(TgEvent.QrChange, onQrChange);
      signalRService.off(TgEvent.QrTimeout, onQrTimeout);
      signalRService.off(TgEvent.PasswordState, onPasswordState);
      signalRService.off(TgEvent.LoggedIn, onLoggedIn);
      signalRService.off(TgEvent.Authorized, onLoggedIn);
      signalRService.off(TgEvent.Disconnected, onDisconnected);
      signalRService.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopQrPoll = () => {
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
  };

  const handleSetDefault = (id: string) => {
    setAccounts(accounts.map(acc => ({ ...acc, isDefault: acc.id === id })));
    const target = accounts.find(a => a.id === id);
    if (target) {
      onAddActivity('Default Telegram Account Set', `Collection broadcasts defaulted to ${target.name} (${target.username})`, 'info');
    }
  };

  const handleDisconnect = async (id: string) => {
    const target = accounts.find(a => a.id === id);
    try {
      await telegramService.disconnect();
    } catch {
      // still update UI
    }
    setAccounts(accounts.map(acc =>
      acc.id === id ? { ...acc, status: 'Disconnected' as const, isDefault: false } : acc
    ));
    if (target) {
      onAddActivity('Telegram Disconnected', `Severed active API session link for ${target.name}`, 'warning');
    }
  };

  const startConnectNew = () => {
    setNewAccountName('');
    setNewAccountPhone('');
    setLoginTab('phone');
    setPhoneStep('idle');
    setVerificationCode('');
    setTwoFaPassword('');
    setConnectError('');
    setQrData(null);
    setQrStep('qr');
    setQrPassword('');
    setConnectSuccess(false);
    setShowConnectModal(true);
  };

  const handleFetchQrCode = async () => {
    setIsLoadingQr(true);
    setConnectError('');
    setQrStep('qr');
    setQrPassword('');
    try {
      const data = await telegramService.qrCode();
      setQrData(data);
      stopQrPoll();
      qrPollRef.current = setInterval(async () => {
        try {
          const session = await telegramService.session();
          if (session?.isAuthorized) {
            stopQrPoll();
            handleConnectSuccess(session);
          }
        } catch { /* ignore */ }
      }, 3000);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to load QR code');
    } finally {
      setIsLoadingQr(false);
    }
  };

  const handlePhoneSubmit = async () => {
    const phone = newAccountPhone.trim();
    if (!phone) { setConnectError('Phone number is required'); return; }
    setIsConnecting(true);
    setConnectError('');
    try {
      const state = await telegramService.loginPhone(phone);
      setPhoneStep(state.state === 1 ? '2fa' : 'code');
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (!verificationCode.trim()) { setConnectError('Verification code is required'); return; }
    setIsConnecting(true);
    setConnectError('');
    try {
      const res = await telegramService.submitPhoneCode(verificationCode);
      if (res.status) {
        const session = await telegramService.session();
        if (session?.isAuthorized) {
          handleConnectSuccess(session);
        } else {
          setPhoneStep('2fa');
        }
      } else {
        setConnectError(res.message || 'Invalid code');
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setIsConnecting(false);
    }
  };

  const handle2faSubmit = async () => {
    if (!twoFaPassword.trim()) { setConnectError('Password is required'); return; }
    setIsConnecting(true);
    setConnectError('');
    try {
      const res = await telegramService.submitPhonePassword(twoFaPassword);
      if (res.status) {
        const session = await telegramService.session();
        if (session) handleConnectSuccess(session);
      } else {
        setConnectError(res.message || 'Invalid password');
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to verify password');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleQrPasswordSubmit = async () => {
    if (!qrPassword.trim()) { setConnectError('Password is required'); return; }
    if (!qrData) return;
    setIsConnecting(true);
    setConnectError('');
    try {
      const res = await telegramService.submitQrPassword(qrPassword, qrData.instanceId);
      if (res.status) {
        const session = await telegramService.session();
        if (session) handleConnectSuccess(session);
      } else {
        setConnectError(res.message || 'Invalid password');
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to submit password');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectSuccess = (session: TelegramSession) => {
    stopQrPoll();
    const acc = sessionToAccount(session);
    // Allow overriding the display name from the modal input
    if (newAccountName.trim()) {
      acc.name = newAccountName.trim();
    }
    // Merge: replace existing entry for this session id, or prepend
    setAccounts([acc, ...accounts.filter(a => a.id !== acc.id)]);
    setConnectSuccess(true);
    setTimeout(() => {
      setShowConnectModal(false);
      setConnectSuccess(false);
    }, 1400);
    onAddActivity('Telegram Account Connected', `Registered ${acc.name} (${acc.phone}) as active collection operator.`, 'success');
  };

  const handleModalClose = () => {
    stopQrPoll();
    setShowConnectModal(false);
    setConnectSuccess(false);
  };

  const filteredAccounts = accounts.filter(acc =>
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="telegram-accounts-view-panel">

      {/* Sticky Action Top Navbar */}
      <div className="sticky top-[-24px] -mt-6 -mx-6 px-6 py-4 bg-slate-950/95 backdrop-blur-md shadow-md shadow-slate-950/10 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search operator accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-205 text-xs rounded-xl pl-9 pr-4 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
        <button
          id="connect-telegram-button"
          onClick={startConnectNew}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer leading-none h-9 shrink-0 transition shadow-lg shadow-emerald-500/5"
        >
          <Plus className="h-4 w-4" />
          <span>Connect Telegram Account</span>
        </button>
      </div>

      {/* Accounts Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Active Collection Terminals</h3>
          <span className="ml-auto text-[10px] text-slate-500 font-mono">{filteredAccounts.length} operator{filteredAccounts.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoadingAccounts ? (
          <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-500/60" />
            <span className="text-xs font-mono">Loading accounts from server…</span>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-4 text-slate-500 border border-dashed border-slate-700/50 rounded-2xl">
            <Send className="h-10 w-10 opacity-20" />
            <span className="text-xs font-mono text-center max-w-xs">
              {searchQuery ? 'No accounts match your search.' : 'No Telegram accounts connected. Click "Connect Telegram Account" to get started.'}
            </span>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-700/60 overflow-hidden divide-y divide-slate-800">
            {filteredAccounts.map((acc) => {
              const attachedLocs = locations.filter(l => l.assignedTelegramSession?.userName === acc.username || l.assignedTelegramSession?.phoneNumber === acc.phone);
              const initials = acc.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
              const isConnected = acc.status === 'Connected';

              const gradients = [
                'from-indigo-500 to-violet-600',
                'from-emerald-500 to-teal-600',
                'from-purple-500 to-fuchsia-600',
                'from-amber-500 to-orange-500',
                'from-blue-500 to-cyan-600',
              ];
              const gradient = gradients[acc.name.length % gradients.length];

              return (
                <div
                  key={acc.id}
                  className="flex items-center gap-4 px-5 py-4 bg-slate-900 hover:bg-slate-800/60 transition-colors"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {acc.logo ? (
                      <img src={acc.logo} alt={acc.name} className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-black text-white text-sm shadow-md shadow-black/20`}>
                        {initials}
                      </div>
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                  </div>

                  {/* Identity */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm leading-tight truncate">{acc.name}</span>
                      {acc.isDefault && (
                        <span className="text-[9px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full font-bold uppercase border border-blue-500/25 tracking-wide shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {acc.username && <span className="text-[11px] text-slate-400 font-mono">{acc.username}</span>}
                      {acc.phone && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          <Phone className="h-2.5 w-2.5" />{acc.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:flex items-center shrink-0">
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-rose-400 uppercase tracking-wide">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                        Offline
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setAttachedLocationsModal({ accountName: acc.name, locationsList: attachedLocs })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
                    >
                      <Building className="h-3 w-3 text-blue-400" />
                      {attachedLocs.length}
                    </button>

                    {isConnected ? (
                      <>
                        <button
                          disabled={acc.isDefault}
                          onClick={() => handleSetDefault(acc.id)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-[10px] font-bold rounded-lg uppercase tracking-wide transition cursor-pointer border border-slate-700"
                        >
                          Set Default
                        </button>
                        <button
                          onClick={() => handleDisconnect(acc.id)}
                          className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold rounded-lg uppercase tracking-wide transition cursor-pointer border border-rose-500/20"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={startConnectNew}
                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg uppercase tracking-wide transition cursor-pointer border border-emerald-500/20"
                      >
                        Reconnect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

{/* Attached Locations Dialog */}
      {attachedLocationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-slate-800 dark:text-slate-100">
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <MapPin className="h-4.5 w-4.5 text-blue-500" /> Attached Properties
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Assigned operator: <strong className="text-blue-600 dark:text-blue-400">{attachedLocationsModal.accountName}</strong>
                </p>
              </div>
              <button onClick={() => setAttachedLocationsModal(null)} className="text-slate-500 hover:text-slate-300 font-bold text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded-lg cursor-pointer">✕</button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {attachedLocationsModal.locationsList.length === 0 ? (
                <p className="text-xs text-slate-505 text-center py-6">No properties currently assigned to this operator.</p>
              ) : (
                attachedLocationsModal.locationsList.map((loc) => {
                  const locInitials = loc.name.replace(/\w+\s/, '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                  const locColors = [
                    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                    'bg-amber-550/10 text-amber-600 dark:text-amber-500 border-amber-500/20',
                    'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
                    'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                  ];
                  return (
                    <div key={loc.id} className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-11 w-11 rounded-full flex items-center justify-center font-black text-xs border shrink-0 ${locColors[loc.name.length % locColors.length]}`}>
                          {locInitials}
                        </div>
                        <div>
                          <span className="font-bold text-slate-100 block text-xs">{loc.name}</span>
                          <span className="text-[10px] text-slate-505 block mt-0.5">{loc.residentsCount} Residents mapped</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-400 block font-mono">
                          ${loc.outstandingBalance ? loc.outstandingBalance.toLocaleString() : '0.00'}
                        </span>
                        <span className="text-[9px] text-slate-505 block">Outstanding Balance</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="pt-3 flex justify-end">
              <button onClick={() => setAttachedLocationsModal(null)} className="px-4 py-2 bg-slate-800 text-slate-350 hover:bg-slate-702 text-xs font-semibold rounded-lg transition-colors cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect / Reconnect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">

            <div className="text-center relative">
              <h3 className="text-lg font-bold text-slate-100">Pair Corporate Telegram Client</h3>
              <p className="text-xs text-slate-400 mt-1">Generate API key linking credentials</p>
              <button onClick={handleModalClose} className="absolute top-0 right-0 text-slate-500 hover:text-slate-300 text-sm font-bold p-1">✕</button>
            </div>

            {connectSuccess ? (
              <div className="text-center py-8 space-y-4">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30">
                  <Check className="h-10 w-10" />
                </div>
                <h4 className="text-base font-bold text-emerald-400">Account Connected Successfully</h4>
                <p className="text-xs text-slate-300 max-w-xs mx-auto">
                  The API secure key was handshake paired with the cloud router. Ready to dispatch.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Operator Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Operator Name <span className="text-slate-600 normal-case font-normal">(optional — defaults to Telegram profile name)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. Condo High Rise Operator"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                  />
                </div>

                {/* Login Method Tabs */}
                <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
                  <button
                    onClick={() => { setLoginTab('phone'); setConnectError(''); setPhoneStep('idle'); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition ${loginTab === 'phone' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Smartphone className="h-3.5 w-3.5" /> Phone
                  </button>
                  <button
                    onClick={() => { setLoginTab('qr'); setConnectError(''); if (!qrData) handleFetchQrCode(); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition ${loginTab === 'qr' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <QrCode className="h-3.5 w-3.5" /> QR Code
                  </button>
                </div>

                {connectError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
                    {connectError}
                  </div>
                )}

                {/* Phone Login Flow */}
                {loginTab === 'phone' && (
                  <div className="space-y-3">
                    {phoneStep === 'idle' && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Phone Number (with country code)
                          </label>
                          <input
                            type="text"
                            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                            placeholder="+855 12 778 901"
                            value={newAccountPhone}
                            onChange={(e) => setNewAccountPhone(e.target.value)}
                          />
                        </div>
                        <button
                          onClick={handlePhoneSubmit}
                          disabled={isConnecting}
                          className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl text-xs tracking-wide cursor-pointer hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isConnecting ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending...</> : 'Send Verification Code'}
                        </button>
                      </>
                    )}

                    {phoneStep === 'code' && (
                      <>
                        <p className="text-xs text-slate-400">Code sent to <strong className="text-slate-200">{newAccountPhone}</strong>. Enter it below.</p>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono tracking-widest text-center"
                          placeholder="5-digit code"
                          maxLength={8}
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                        />
                        <button
                          onClick={handleCodeSubmit}
                          disabled={isConnecting}
                          className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl text-xs tracking-wide cursor-pointer hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isConnecting ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Verifying...</> : 'Verify Code'}
                        </button>
                      </>
                    )}

                    {phoneStep === '2fa' && (
                      <>
                        <p className="text-xs text-slate-400">Two-factor authentication is enabled. Enter your Telegram password.</p>
                        <input
                          type="password"
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Telegram 2FA password"
                          value={twoFaPassword}
                          onChange={(e) => setTwoFaPassword(e.target.value)}
                        />
                        <button
                          onClick={handle2faSubmit}
                          disabled={isConnecting}
                          className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl text-xs tracking-wide cursor-pointer hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isConnecting ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Verifying...</> : 'Submit Password'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* QR Code Flow */}
                {loginTab === 'qr' && (
                  <div className="space-y-3 text-center">
                    {isLoadingQr ? (
                      <div className="py-8 flex flex-col items-center gap-3">
                        <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
                        <span className="text-xs text-slate-400">Generating QR code...</span>
                      </div>
                    ) : qrData ? (
                      qrStep === 'password' ? (
                        <div className="space-y-3 text-left">
                          <p className="text-xs text-slate-400 text-center">Two-factor authentication required. Enter your Telegram password to complete login.</p>
                          <input
                            type="password"
                            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            placeholder="Telegram 2FA password"
                            value={qrPassword}
                            onChange={(e) => setQrPassword(e.target.value)}
                          />
                          <button
                            onClick={handleQrPasswordSubmit}
                            disabled={isConnecting}
                            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl text-xs tracking-wide cursor-pointer hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isConnecting ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Verifying...</> : 'Submit Password'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                            <div className="bg-white p-3.5 rounded-lg flex items-center justify-center">
                              <QRCode value={qrData.qrCode} size={144} />
                            </div>
                            <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 tracking-widest mt-2.5 block">
                              SCAN WITH TELEGRAM APP
                            </span>
                          </div>
                          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-left space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-mono block">Instance ID</span>
                            <code className="text-[11px] text-emerald-400 font-mono break-all block">{qrData.instanceId}</code>
                          </div>
                          <p className="text-xs text-slate-400">
                            Go to <strong className="text-slate-300">Telegram → Settings → Devices → Link Desktop Device</strong> and scan the code. Waiting for scan…
                          </p>
                          <button onClick={handleFetchQrCode} className="text-xs text-slate-500 hover:text-emerald-400 flex items-center gap-1 mx-auto transition">
                            <RefreshCw className="h-3 w-3" /> Refresh QR
                          </button>
                        </>
                      )
                    ) : (
                      <button onClick={handleFetchQrCode} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs tracking-wide cursor-pointer flex items-center justify-center gap-2">
                        <QrCode className="h-4 w-4" /> Load QR Code
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
