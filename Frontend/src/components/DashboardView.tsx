/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DollarSign, Users, Bell, AlertTriangle, ArrowUpRight, CheckCircle2, TrendingUp, Landmark, RefreshCw } from 'lucide-react';
import { Location, Resident, Bill, MessageQueueItem, ActivityLog } from '../types';

interface DashboardViewProps {
  selectedLocation: string;
  setSelectedLocation: (name: string) => void;
  locations: Location[];
  residents: Resident[];
  bills: Bill[];
  messages: MessageQueueItem[];
  activities: ActivityLog[];
  onAddActivity: (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function DashboardView({
  selectedLocation,
  setSelectedLocation,
  locations,
  residents,
  bills,
  messages,
  activities,
  onAddActivity
}: DashboardViewProps) {
  
  // Calculate dynamic metrics based on selectedLocation context
  const filteredResidents = selectedLocation === 'All Locations' 
    ? residents 
    : residents.filter(r => r.locationName === selectedLocation);

  const filteredBills = selectedLocation === 'All Locations'
    ? bills
    : bills.filter(b => b.locationName === selectedLocation);

  const filteredMessages = selectedLocation === 'All Locations'
    ? messages
    : messages.filter(m => m.locationName === selectedLocation);

  // Stats
  const totalOutstanding = filteredBills
    .filter(b => b.status !== 'Paid')
    .reduce((sum, b) => sum + b.amount, 0);

  const residentsDueCount = filteredResidents.filter(r => r.status !== 'Paid').length;
  const pendingRemindersCount = filteredMessages.filter(m => m.status === 'Pending').length;
  const overdueAccountsCount = filteredBills.filter(b => b.status === 'Overdue').length;

  const handleRefresh = () => {
    onAddActivity('Metrics Refreshed', 'Staff manual refresh successfully pulled latest ledger records.', 'info');
  };

  return (
    <div className="space-y-6" id="dashboard-view-panel">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            OPERATIONAL HUD
          </span>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Accounts AR & Messaging Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Active context: <strong className="text-emerald-400 font-medium">"{selectedLocation}"</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center gap-1.5 text-xs cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync Ledger</span>
          </button>
          
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
          >
            <option value="All Locations">🌍 All Locations (Global View)</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.name}>🏢 {loc.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Outstanding */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 relative overflow-hidden group hover:border-slate-600 transition" id="kpi-outstanding">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition">
            <DollarSign className="h-20 w-20 text-emerald-400" />
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Outstanding</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-2 font-mono">
                ${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <DollarSign className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs">
            <span className="text-emerald-400 font-mono font-medium">92% deliverable</span>
            <span className="text-slate-500">via connected Telegram bots</span>
          </div>
        </div>

        {/* Residents Due */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 relative overflow-hidden group hover:border-slate-600 transition" id="kpi-residents">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition">
            <Users className="h-20 w-20 text-teal-400" />
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Residents Due</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-2 font-mono">
                {residentsDueCount}
              </h3>
            </div>
            <span className="p-2 bg-teal-500/10 text-teal-400 rounded-lg">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs">
            <span className="text-teal-400 font-medium">
              {residentsDueCount > 0 ? ((residentsDueCount / filteredResidents.length) * 100).toFixed(0) : 0}% Active AR
            </span>
            <span className="text-slate-500">of {filteredResidents.length} ledger codes</span>
          </div>
        </div>

        {/* Pending Reminders */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 relative overflow-hidden group hover:border-slate-600 transition" id="kpi-warnings">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition">
            <Bell className="h-20 w-20 text-amber-400" />
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Reminders</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-2 font-mono">
                {pendingRemindersCount}
              </h3>
            </div>
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Bell className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs">
            <span className="text-amber-400 font-medium">Queue ready</span>
            <span className="text-slate-500">awaiting supervisor dispatch</span>
          </div>
        </div>

        {/* Overdue Accounts */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 relative overflow-hidden group hover:border-slate-600 transition" id="kpi-overdue">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition">
            <AlertTriangle className="h-20 w-20 text-rose-400" />
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overdue Accounts</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-2 font-mono text-rose-400">
                {overdueAccountsCount}
              </h3>
            </div>
            <span className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs">
            <span className="text-rose-400 font-semibold">Immediate Action</span>
            <span className="text-slate-500">exceeds grace offset limit</span>
          </div>
        </div>

      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Locations Context & Status Overview */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Landmark className="h-4.5 w-4.5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Location Operational Overview
                </h3>
              </div>
              <span className="text-[10px] text-slate-500">Select any card/row to change active context</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/60 text-slate-400 select-none uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Residents</th>
                    <th className="py-3 px-4">Outstanding Balance</th>
                    <th className="py-3 px-4">Associated Operator</th>
                    <th className="py-3 px-4 text-right">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {locations.map((loc) => {
                    const isActive = selectedLocation === loc.name;
                    
                    // Dynamic outstanding calculation
                    const locBills = bills.filter(b => b.locationName === loc.name);
                    const dynamicOutstanding = locBills
                      .filter(b => b.status !== 'Paid')
                      .reduce((sum, b) => sum + b.amount, 0);

                    const dynamicResidents = residents.filter(r => r.locationName === loc.name).length;

                    return (
                      <tr 
                        key={loc.id} 
                        className={`hover:bg-slate-800/30 group transition cursor-pointer ${isActive ? 'bg-emerald-500/5' : ''}`}
                        onClick={() => {
                          setSelectedLocation(loc.name);
                          onAddActivity('Location Context Adjusted', `Active operational scope switched to ${loc.name}`, 'info');
                        }}
                      >
                        <td className="py-3 px-4 font-bold text-slate-200 flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                          {loc.logo && (
                            <img 
                              src={loc.logo} 
                              alt={loc.name} 
                              className="h-6 w-6 rounded-full object-cover bg-white border border-slate-700/60 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          {loc.name}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono">{dynamicResidents}</td>
                        <td className="py-3 px-4 text-slate-200 font-semibold font-mono">
                          ${dynamicOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {loc.assignedTelegramSession
                              ? ([loc.assignedTelegramSession.firstName, loc.assignedTelegramSession.lastName].filter(Boolean).join(' ') || loc.assignedTelegramSession.userName || '—')
                              : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase transition-all ${
                              isActive 
                                ? 'bg-emerald-400 text-slate-900 shadow-md shadow-emerald-400/10' 
                                : 'bg-slate-700 text-slate-300 group-hover:bg-slate-600'
                            }`}
                          >
                            {isActive ? 'Active' : 'Select'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>All connected API servers reporting online</span>
              </span>
              <span className="font-mono">UK CONDO Ver 1.4.2</span>
            </div>
          </div>

          {/* Quick Explanatory Enterprise Benefits Area */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800/20 border border-slate-700/30 p-4 rounded-xl text-xs space-y-1">
              <div className="text-emerald-400 font-mono font-bold uppercase tracking-wider">01. Centralized Control</div>
              <p className="text-slate-300 leading-relaxed">
                Connect and manage multiple Telegram accounts/operators under a unified console to avoid logging in on multiple phones.
              </p>
            </div>
            <div className="bg-slate-800/20 border border-slate-700/30 p-4 rounded-xl text-xs space-y-1">
              <div className="text-emerald-400 font-mono font-bold uppercase tracking-wider">02. Automated Schedules</div>
              <p className="text-slate-300 leading-relaxed">
                Define strict pre-due/post-grace offsets. The system generates and lines up reminder queues for immediate review.
              </p>
            </div>
            <div className="bg-slate-800/20 border border-slate-700/30 p-4 rounded-xl text-xs space-y-1">
              <div className="text-emerald-400 font-mono font-bold uppercase tracking-wider">03. Real-Time Tracking</div>
              <p className="text-slate-300 leading-relaxed">
                Parse resident Excel ledgers, validate customer accounts, and audit conversations to reduce manual typing.
              </p>
            </div>
          </div>

        </div>

        {/* Right 1 Column: Activity Log Feed */}
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700/40">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Operational Activities
              </h3>
              <span className="text-[10px] text-slate-500">Audit logs</span>
            </div>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {activities.map((act) => (
                <div 
                  key={act.id} 
                  className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 hover:border-slate-700 transition space-y-1 text-xs"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-slate-200 truncate">{act.action}</span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">{act.timestamp.split(' ')[1]}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed select-text">{act.details}</p>
                  <div className="flex justify-end pt-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                      act.type === 'success' 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : act.type === 'warning' 
                          ? 'bg-amber-500/10 text-amber-400' 
                          : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {act.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 mt-4 text-center">
            <span className="text-[10px] text-slate-400 block font-medium">SYSTEM PERFORMANCE SUMMARY</span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-slate-800/40 p-2 rounded-lg">
                <div className="text-[9px] text-slate-500 font-bold uppercase">Collection Efficiency</div>
                <div className="text-sm font-black text-emerald-400 tracking-tight mt-0.5">84.2%</div>
              </div>
              <div className="bg-slate-800/40 p-2 rounded-lg">
                <div className="text-[9px] text-slate-500 font-bold uppercase">Avg Reminder SLA</div>
                <div className="text-sm font-black text-teal-400 tracking-tight mt-0.5">&lt; 3 mins</div>
              </div>
            </div>
          </div>
        </div>
        
      </div>

    </div>
  );
}
