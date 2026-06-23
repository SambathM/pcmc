/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Filter, MessageSquare, Edit2, CreditCard, User, Mail, Phone, Calendar, Landmark, Check, AlertCircle, ChevronRight, X, Send } from 'lucide-react';
import { Resident, Bill, MessageQueueItem } from '../types';

interface ResidentsViewProps {
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
  bills: Bill[];
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
  messages: MessageQueueItem[];
  setMessages: React.Dispatch<React.SetStateAction<MessageQueueItem[]>>;
  selectedLocation: string;
  onAddActivity: (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onTriggerSingleReminder: (res: Resident) => void;
}

export default function ResidentsView({
  residents,
  setResidents,
  bills,
  setBills,
  messages,
  setMessages,
  selectedLocation,
  onAddActivity,
  onTriggerSingleReminder
}: ResidentsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Due' | 'Overdue'>('All');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  // Custom Edit state
  const [editingRes, setEditingRes] = useState<Resident | null>(null);

  // Filter residents by active location context
  const locationFiltered = selectedLocation === 'All Locations'
    ? residents
    : residents.filter(r => r.locationName === selectedLocation);

  // Search filter
  const searchedResidents = locationFiltered.filter((res) => {
    const matchesSearch = 
      res.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      res.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.telegram.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || res.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Fetch resident specifics
  const getResidentBills = (code: string) => bills.filter(b => b.residentCode === code);
  const getResidentHistory = (code: string) => messages.filter(m => m.residentCode === code);

  // Manual outstanding payment record simulation
  const handleSimulatePayment = (billId: string, residentCode: string) => {
    // 1. Update bill status
    const updatedBills = bills.map(b => {
      if (b.id === billId) {
        return { ...b, status: 'Paid' as const };
      }
      return b;
    });
    setBills(updatedBills);

    // 2. Recompute outstanding balance and overall status for resident
    const residentRemainingBills = updatedBills.filter(b => b.residentCode === residentCode && b.status !== 'Paid');
    const remainingVal = residentRemainingBills.reduce((sum, b) => sum + b.amount, 0);
    
    // Determine overall status
    let finalStatus: 'Paid' | 'Due' | 'Overdue' = 'Paid';
    if (residentRemainingBills.length > 0) {
      const hasOverdue = residentRemainingBills.some(b => b.status === 'Overdue');
      finalStatus = hasOverdue ? 'Overdue' : 'Due';
    }

    // Update resident block
    const updatedRes = residents.map(r => {
      if (r.code === residentCode) {
        const nextResState = { ...r, balance: remainingVal, status: finalStatus };
        // If current selected profile is this resident, update right panel
        if (selectedResident && selectedResident.code === residentCode) {
          setSelectedResident(nextResState);
        }
        return nextResState;
      }
      return r;
    });

    setResidents(updatedRes);
    
    const targetBill = bills.find(b => b.id === billId);
    onAddActivity(
      'Payment Recorded',
      `Simulated manual settlement of ${targetBill?.service} bill ($${targetBill?.amount}) for resident code ${residentCode}`,
      'success'
    );
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRes) return;

    const updated = residents.map(r => r.code === editingRes.code ? editingRes : r);
    setResidents(updated);

    if (selectedResident && selectedResident.code === editingRes.code) {
      setSelectedResident(editingRes);
    }

    setEditingRes(null);
    onAddActivity('Resident Roster Updated', `Modified profile specifics for ${editingRes.name} (Unit ${editingRes.unit})`, 'info');
  };

  return (
    <div className="space-y-6" id="residents-view-panel">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            ROSTER COMPLIANCE
          </span>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Residents & Chattel Mappings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit specific contact parameters, review transactional status, and dispatch direct Telegram notification prompts.
          </p>
        </div>

        <div className="text-xs text-slate-500 font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          Roster Scope: <strong className="text-emerald-400">"{selectedLocation}"</strong> ({searchedResidents.length} shown)
        </div>
      </div>

      {reminderError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          {reminderError}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/35 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-4 py-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="Search by Code, Resident Name, Unit, or Username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1 font-medium select-none">
            <Filter className="h-3.5 w-3.5" /> Filter Status:
          </span>
          <div className="flex bg-slate-955 p-1 rounded-lg border border-slate-800 text-[11px] font-bold">
            {(['All', 'Paid', 'Due', 'Overdue'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-md transition uppercase cursor-pointer ${
                  statusFilter === status 
                    ? 'bg-emerald-500 text-slate-950' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: Data Table and Sidebar Drawer block */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Table block */}
        <div className="xl:col-span-2 bg-slate-800/25 border border-slate-705 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 select-none uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Resident / unit</th>
                  <th className="py-3 px-4">Telegram Handle</th>
                  <th className="py-3 px-4">Arrears Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {searchedResidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No matching records detected in the active ledger context.
                    </td>
                  </tr>
                ) : (
                  searchedResidents.map((res) => {
                    const isRowSelected = selectedResident?.code === res.code;
                    return (
                      <tr 
                        key={res.code} 
                        className={`hover:bg-slate-805/50 transition cursor-pointer ${isRowSelected ? 'bg-emerald-500/5' : ''}`}
                        onClick={() => setSelectedResident(res)}
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-slate-400">{res.code}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {res.avatar ? (
                              <img 
                                src={res.avatar} 
                                alt={res.name} 
                                className="h-8 w-8 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">
                                {res.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-200">{res.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Unit {res.unit} • {res.locationName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-400 text-[13px]">{res.telegram}</td>
                        <td className="py-3 px-4 font-bold text-slate-200 font-mono text-sm">
                          ${res.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          {res.status === 'Paid' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Check className="h-3 w-3" /> Paid
                            </span>
                          ) : res.status === 'Due' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertCircle className="h-3 w-3" /> Due
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                              <AlertCircle className="h-3 w-3" /> Overdue
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedResident(res)}
                              className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-md transition"
                              title="View Details"
                            >
                              Profile
                            </button>
                            <button
                              onClick={() => {
                                const hasBill = bills.some(b => b.residentCode === res.code && b.status !== 'Paid');
                                if (!hasBill) {
                                  setReminderError(`${res.name} has no unsettled bills.`);
                                  setTimeout(() => setReminderError(null), 3500);
                                  return;
                                }
                                onTriggerSingleReminder(res);
                              }}
                              className="p-1 px-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 text-[10px] font-bold rounded-md transition border border-emerald-500/10"
                              title="Preview Reminder Message"
                            >
                              Remind
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Profile Details Drawer Panel */}
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 block">
          {selectedResident ? (
            <div className="space-y-6" id="resident-drawer">
              {/* Profile Header */}
              <div className="flex justify-between items-start pb-4 border-b border-slate-705/80">
                <div className="flex gap-3">
                  {selectedResident.avatar ? (
                    <img 
                      src={selectedResident.avatar} 
                      alt={selectedResident.name} 
                      className="h-12 w-12 rounded-xl object-cover border border-slate-700 bg-slate-800 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-emerald-400 shrink-0">
                      <User className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-black text-slate-100">{selectedResident.name}</h3>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">Code: {selectedResident.code}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setEditingRes(selectedResident)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition rounded-lg"
                    title="Edit Contact"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    onClick={() => setSelectedResident(null)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Contact info grid */}
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-300 bg-slate-900/40 p-3 rounded-lg border border-slate-850">
                <div className="flex items-center gap-2">
                  <Landmark className="h-3.5 w-3.5 text-slate-500" />
                  <span>Unit: <strong className="text-slate-200">{selectedResident.unit}</strong> • {selectedResident.locationName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                  <span>Telegram handle: <strong className="text-emerald-400 font-mono">{selectedResident.telegram}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  <span>Staff Phone contact: <strong>{selectedResident.phone}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  <span>Mail delivery: <strong>{selectedResident.email}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  <span>Registry Entry Date: <strong>{selectedResident.joinDate}</strong></span>
                </div>
              </div>

              {/* Arrears detail list */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500">
                  Current Subscribed Arrears
                </span>
                <div className="space-y-2">
                  {getResidentBills(selectedResident.code).length === 0 ? (
                    <div className="text-center py-4 bg-slate-950/30 rounded border border-slate-800 text-slate-500 text-xs">
                      No outstanding bills. Paid in full.
                    </div>
                  ) : (
                    getResidentBills(selectedResident.code).map((bill) => (
                      <div 
                        key={bill.id} 
                        className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-200">{bill.service}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Due: {bill.dueDate}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold font-mono text-slate-200">${bill.amount}</span>
                          {bill.status !== 'Paid' ? (
                            <button
                              onClick={() => handleSimulatePayment(bill.id, selectedResident.code)}
                              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 text-[10px] font-bold rounded uppercase transition cursor-pointer border border-emerald-500/10"
                            >
                              Paid Code
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-bold uppercase">Settled</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Interactive simulated Message Log */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500">
                  Direct Telegram Live Log
                </span>

                <div className="bg-slate-950 rounded-xl max-h-[160px] overflow-y-auto p-3 space-y-3.5 border border-slate-850">
                  {getResidentHistory(selectedResident.code).length === 0 ? (
                    <div className="text-center py-6 text-slate-600 text-xs select-none">
                      No previous chat logs.
                    </div>
                  ) : (
                    getResidentHistory(selectedResident.code).map((h) => (
                      <div key={h.id} className="space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>{h.offsetType || 'Manual Reminder'}</span>
                          <span>{h.timestamp}</span>
                        </div>
                        <div className="p-2 px-2.5 bg-slate-900 border border-slate-800 text-slate-200 rounded-lg text-[11px] leading-relaxed select-text italic">
                          "{h.text.split('\n\n')[0] || h.text}"
                        </div>
                        <div className="flex justify-end gap-1 text-[10px] select-none font-bold">
                          <span className={`px-1.5 rounded uppercase ${
                            h.status === 'Delivered' 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {h.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-20 text-slate-500 flex flex-col items-center justify-center space-y-3">
              <User className="h-10 w-10 text-slate-650" />
              <div className="text-xs">Select any resident code in the roster ledger to load complete transactional profiles.</div>
            </div>
          )}
        </div>
      </div>

      {/* Roster Profile Editor Dialog MOCK */}
      {editingRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-1">
              <Edit2 className="h-4 w-4 text-emerald-400" /> Edit Resident Profile Mappings
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs text-slate-300">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Resident Code (Read-Only)</label>
                <input 
                  type="text" 
                  disabled 
                  value={editingRes.code} 
                  className="w-full bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-slate-500 font-mono cursor-not-allowed" 
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 col-span-2">Full Name</label>
                <input 
                  type="text" 
                  value={editingRes.name} 
                  onChange={(e) => setEditingRes({ ...editingRes, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-200 font-bold focus:outline-none" 
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Unit Number</label>
                  <input 
                    type="text" 
                    value={editingRes.unit} 
                    onChange={(e) => setEditingRes({ ...editingRes, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-200 focus:outline-none" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Telegram Handle</label>
                  <input 
                    type="text" 
                    value={editingRes.telegram} 
                    onChange={(e) => setEditingRes({ ...editingRes, telegram: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-emerald-400 font-mono focus:outline-none" 
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Phone Number</label>
                <input 
                  type="text" 
                  value={editingRes.phone} 
                  onChange={(e) => setEditingRes({ ...editingRes, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-200 focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Email Coordinates</label>
                <input 
                  type="email" 
                  value={editingRes.email} 
                  onChange={(e) => setEditingRes({ ...editingRes, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-200 focus:outline-none" 
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRes(null)}
                  className="px-3.5 py-1.5 bg-slate-800 text-slate-300 rounded font-semibold border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded font-bold transition"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
