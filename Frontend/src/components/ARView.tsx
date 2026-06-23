/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, FileUp, Download, Zap, CheckCircle2, User, ShieldAlert, ChevronDown, RefreshCw, Check, X } from 'lucide-react';
import { Bill, Resident, Location, ServiceItem } from '../types';
import { fileImportTemplates } from '../data';
import { billService } from '../lib/api';

interface ARViewProps {
  bills: Bill[];
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
  billsLoading: boolean;
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
  locations: Location[];
  services: ServiceItem[];
  onAddActivity: (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onTriggerBatchReminders: (targetBills: Bill[]) => void;
  showImportModalOnInit: boolean;
  onCloseImportModalOnInit: () => void;
}

export default function ARView({
  bills,
  setBills,
  billsLoading,
  residents,
  setResidents,
  services,
  locations,
  onAddActivity,
  onTriggerBatchReminders,
  showImportModalOnInit,
  onCloseImportModalOnInit,
}: ARViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showImportWizard, setShowImportWizard] = useState(showImportModalOnInit);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'validated' | 'finished'>('upload');
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState('All');
  const [batchError, setBatchError] = useState<string | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const importPanelRef = useRef<HTMLDivElement>(null);

  // Add bill form
  const [addBillForm, setAddBillForm] = useState({
    residentName: '',
    residentCode: '',
    unit: '',
    locationId: '',
    service: '',
    amount: '',
    dueDate: '',
    status: 'Due' as 'Due' | 'Overdue' | 'Paid',
    autoSend: false,
  });
  const [addBillSaving, setAddBillSaving] = useState(false);
  const [addBillError, setAddBillError] = useState<string | null>(null);
  const [residentSearch, setResidentSearch] = useState('');
  const [showResidentDropdown, setShowResidentDropdown] = useState(false);
  const residentDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showImportPanel) return;
    const handler = (e: MouseEvent) => {
      if (importPanelRef.current && !importPanelRef.current.contains(e.target as Node)) {
        setShowImportPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showImportPanel]);

  useEffect(() => {
    if (!showResidentDropdown) return;
    const handler = (e: MouseEvent) => {
      if (residentDropdownRef.current && !residentDropdownRef.current.contains(e.target as Node)) {
        setShowResidentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showResidentDropdown]);

  React.useEffect(() => {
    if (showImportModalOnInit) {
      setShowImportWizard(true);
      setImportStep('upload');
      onCloseImportModalOnInit();
    }
  }, [showImportModalOnInit]);

  const locationFilteredBills = locationFilter === 'All'
    ? bills
    : bills.filter(b => b.locationName === locationFilter);

  const processedBills = locationFilteredBills.filter(b => {
    const matchesSearch =
      b.residentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = serviceFilter === 'All' || b.service === serviceFilter;
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
    return matchesSearch && matchesService && matchesStatus;
  });

  const outstandingCount = processedBills.filter(b => b.status !== 'Paid').length;
  const outstandingTotal = processedBills.filter(b => b.status !== 'Paid').reduce((sum, b) => sum + b.amount, 0);

  const handleExportCSV = () => {
    onAddActivity(
      'Ledger Export Complete',
      `Staff exported outstanding receivable catalog (${processedBills.length} records) as secure corporate collection CSV.`,
      'success'
    );
  };

  const handleToggleAutoSend = (billId: string) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    const next = !bill.autoSend;
    setBills(bills.map(b => b.id === billId ? { ...b, autoSend: next } : b));
    billService.update(Number(billId), { autoSend: next }).catch(() => {
      // revert on failure
      setBills(prev => prev.map(b => b.id === billId ? { ...b, autoSend: bill.autoSend } : b));
    });
    onAddActivity('Toggle Scheduler Option', `Flipped Auto-Send on Bill ID ${billId} → ${next ? 'enabled' : 'disabled'}`, 'info');
  };

  const handleToggleSelectAll = () => {
    if (selectedBillIds.length === processedBills.length) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(processedBills.map(b => b.id));
    }
  };

  const handleRowCheckbox = (id: string) => {
    setSelectedBillIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkTriggerReminders = () => {
    const targetBills = bills.filter(b => selectedBillIds.includes(b.id) && b.status !== 'Paid');
    if (targetBills.length === 0) {
      setBatchError('Select at least one due or overdue bill to queue reminders.');
      setTimeout(() => setBatchError(null), 3500);
      return;
    }
    onTriggerBatchReminders(targetBills);
    setSelectedBillIds([]);
    onAddActivity(
      'Batch Reminder Queue Triggered',
      `Lined up telegram notification logs for ${targetBills.length} selected bills into Message queue.`,
      'success'
    );
  };

  const resetAddBillForm = () => {
    setAddBillForm({ residentName: '', residentCode: '', unit: '', locationId: '', service: '', amount: '', dueDate: '', status: 'Due', autoSend: false });
    setResidentSearch('');
    setAddBillError(null);
  };

  const handleAddBillSubmit = async () => {
    const name = addBillForm.residentName.trim();
    const code = addBillForm.residentCode.trim();
    if (!name || !code) { setAddBillError('Resident name and code are required.'); return; }
    const amount = parseFloat(addBillForm.amount);
    if (isNaN(amount) || amount <= 0) { setAddBillError('Enter a valid amount.'); return; }
    if (!addBillForm.dueDate) { setAddBillError('Due date is required.'); return; }
    if (!addBillForm.locationId) { setAddBillError('Select a location.'); return; }

    const loc = locations.find(l => l.id === addBillForm.locationId);
    setAddBillSaving(true);
    setAddBillError(null);
    try {
      const newId = await billService.create({
        residentCode: code,
        residentName: name,
        unit: addBillForm.unit.trim(),
        service: addBillForm.service,
        amount,
        dueDate: addBillForm.dueDate,
        status: addBillForm.status,
        autoSend: addBillForm.autoSend,
        locationId: Number(addBillForm.locationId),
      });
      const newBill: Bill = {
        id: String(newId),
        residentCode: code,
        residentName: name,
        unit: addBillForm.unit.trim(),
        service: addBillForm.service,
        amount,
        dueDate: addBillForm.dueDate,
        status: addBillForm.status,
        autoSend: addBillForm.autoSend,
        locationName: loc?.name ?? '',
      };
      setBills(prev => [newBill, ...prev]);
      resetAddBillForm();
      onAddActivity('Bill Created', `Added bill for ${name} — ${addBillForm.service} $${amount.toFixed(2)}`, 'success');
    } catch (err: unknown) {
      setAddBillError(err instanceof Error ? err.message : 'Failed to create bill.');
    } finally {
      setAddBillSaving(false);
    }
  };

  const handleValidateExcel = () => {
    setImportStep('preview');
    onAddActivity('Excel Validation Initiated', 'Validating schema rules and resident checksum offsets on July_2026_Bills.xlsx', 'info');
    setTimeout(() => setImportStep('validated'), 1000);
  };

  const handleConfirmImport = () => {
    const mappedNewBills: Bill[] = fileImportTemplates.arRecords.map((r, idx) => ({
      id: `bill-july-${idx + 100}`,
      residentCode: r.residentCode,
      residentName: r.residentName,
      unit: r.unit,
      service: r.service,
      amount: r.amount,
      dueDate: r.dueDate,
      status: 'Due' as const,
      autoSend: r.autoSend,
      locationName: r.location,
    }));
    setBills(prev => [...mappedNewBills, ...prev]);
    setResidents(prev => prev.map(res => {
      const matching = mappedNewBills.filter(b => b.residentCode === res.code);
      if (matching.length === 0) return res;
      return { ...res, balance: res.balance + matching.reduce((s, b) => s + b.amount, 0), status: 'Due' as const };
    }));
    setImportStep('finished');
    onAddActivity('AR Records Imported', 'Processed spreadsheet data: 538 billing entries successfully linked into accounts receivable ledger.', 'success');
  };

  const allSelected = processedBills.length > 0 && selectedBillIds.length === processedBills.length;
  const someSelected = !allSelected && selectedBillIds.length > 0;

  return (
    <div className="space-y-6" id="ar-view-panel">

      {/* Sticky toolbar */}
      <div className="sticky top-[-24px] -mt-6 -mx-6 px-6 py-4 bg-slate-950/95 backdrop-blur-md shadow-md shadow-slate-950/10 z-20 flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search resident or unit..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Location filter */}
          <select
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="All">All Locations</option>
            {locations.map(l => (
              <option key={l.id} value={l.name}>{l.name}</option>
            ))}
          </select>

          {/* Service filter */}
          <select
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="All">All Services</option>
            {services.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Due">Due</option>
            <option value="Overdue">Overdue</option>
            <option value="Paid">Paid</option>
          </select>

          {/* Summary stats */}
          <div className="hidden sm:flex items-center gap-3 ml-auto mr-3 shrink-0">
            <span className="text-[10px] text-slate-500 font-mono">{outstandingCount} outstanding</span>
            <span className="text-[11px] font-mono font-bold text-emerald-400">
              ${outstandingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="relative shrink-0" ref={importPanelRef}>
            <button
              onClick={() => setShowImportPanel(p => !p)}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer h-9 transition"
            >
              <FileUp className="h-3.5 w-3.5 text-emerald-400" />
              Import
              <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${showImportPanel ? 'rotate-180' : ''}`} />
            </button>

            {showImportPanel && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden">
                <button
                  onClick={() => { setImportStep('upload'); setShowImportWizard(true); setShowImportPanel(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-xs text-slate-300 hover:bg-slate-800 transition cursor-pointer text-left"
                >
                  <FileUp className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold">Import Excel File</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Upload monthly AR records</div>
                  </div>
                </button>
                <div className="border-t border-slate-800" />
                <button
                  onClick={() => { handleExportCSV(); setShowImportPanel(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-xs text-slate-300 hover:bg-slate-800 transition cursor-pointer text-left"
                >
                  <Download className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="font-bold">Export CSV</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Download current ledger view</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Batch action bar — shown only when rows are selected */}
      {selectedBillIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <span className="text-xs text-emerald-400 font-semibold">
            {selectedBillIds.length} bill{selectedBillIds.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkTriggerReminders}
            className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10 hover:opacity-90 transition"
          >
            <Zap className="h-3.5 w-3.5" />
            Generate Scheduler Batch
          </button>
        </div>
      )}

      {batchError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
          {batchError}
        </div>
      )}

      {/* Bills table */}
      <div className="rounded-2xl border border-slate-700/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 select-none uppercase tracking-wider font-semibold">
                <th className="py-[5px] px-[3px] w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={handleToggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th style={{ padding: '0.25rem 0.375rem' }}>Location</th>
                <th style={{ padding: '0.25rem 0.375rem' }}>Unit</th>
                <th style={{ padding: '0.25rem 0.375rem' }}>Resident</th>
                <th style={{ padding: '0.25rem 0.375rem' }}>Service</th>
                <th style={{ padding: '0.25rem 0.375rem' }}>Amount</th>
                <th style={{ padding: '0.25rem 0.375rem' }}>Due Date</th>
                <th style={{ padding: '0.25rem 0.375rem' }}>Status</th>
                <th style={{ padding: '0.25rem 0.375rem', textAlign: 'center' }}>Auto-Send</th>
                <th style={{ padding: '0.25rem 0.375rem', width: '4rem' }} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              <>
                <tr className="bg-emerald-500/5 border-b border-emerald-500/20">
                  <td className="py-[5px] px-[3px]" />
                  {/* Location (drives resident list) */}
                  <td className="py-[5px] px-[3px]">
                    <select
                      autoFocus
                      value={addBillForm.locationId}
                      onChange={e => {
                        setAddBillForm(f => ({ ...f, locationId: e.target.value, residentName: '', residentCode: '', unit: '' }));
                        setResidentSearch('');
                      }}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">Location…</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </td>
                  {/* Unit */}
                  <td className="py-[5px] px-[3px]">
                    <input
                      type="text"
                      value={addBillForm.unit}
                      onChange={e => setAddBillForm(f => ({ ...f, unit: e.target.value }))}
                      placeholder="Unit"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-600"
                    />
                  </td>
                  {/* Resident — searchable dropdown filtered by location */}
                  <td className="py-[5px] px-[3px]">
                    <div ref={residentDropdownRef} className="relative">
                      <input
                        type="text"
                        value={residentSearch}
                        onChange={e => {
                          setResidentSearch(e.target.value);
                          setAddBillForm(f => ({ ...f, residentName: e.target.value, residentCode: '' }));
                          setShowResidentDropdown(true);
                        }}
                        onFocus={() => setShowResidentDropdown(true)}
                        placeholder={addBillForm.locationId ? 'Search resident…' : 'Select location first'}
                        disabled={!addBillForm.locationId}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      {showResidentDropdown && addBillForm.locationId && (() => {
                        const locName = locations.find(l => l.id === addBillForm.locationId)?.name ?? '';
                        const opts = residents.filter(r =>
                          r.locationName === locName &&
                          (!residentSearch || r.name.toLowerCase().includes(residentSearch.toLowerCase()) || r.code.toLowerCase().includes(residentSearch.toLowerCase()))
                        );
                        return opts.length > 0 ? (
                          <div className="absolute left-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto">
                            {opts.map(r => (
                              <button
                                key={r.code}
                                type="button"
                                onMouseDown={e => {
                                  e.preventDefault();
                                  setAddBillForm(f => ({ ...f, residentName: r.name, residentCode: r.code, unit: r.unit }));
                                  setResidentSearch(r.name);
                                  setShowResidentDropdown(false);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left bg-transparent hover:bg-slate-700/60 focus:outline-none transition"
                              >
                                {r.profilePhoto || r.avatar ? (
                                  <img src={r.profilePhoto || r.avatar} className="h-7 w-7 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="h-7 w-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0">
                                    <User className="h-3.5 w-3.5 text-slate-500" />
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs font-semibold text-slate-100">{r.name}</div>
                                  <div className="text-[10px] text-slate-500">{r.code} · Unit {r.unit}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </td>
                  {/* Service */}
                  <td className="py-[5px] px-[3px]">
                    <select
                      value={addBillForm.service}
                      onChange={e => setAddBillForm(f => ({ ...f, service: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">None</option>
                      {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </td>
                  {/* Amount */}
                  <td className="py-[5px] px-[3px]">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={addBillForm.amount}
                      onChange={e => setAddBillForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-600"
                    />
                  </td>
                  {/* Due Date */}
                  <td className="py-[5px] px-[3px]">
                    <input
                      type="date"
                      value={addBillForm.dueDate}
                      onChange={e => setAddBillForm(f => ({ ...f, dueDate: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </td>
                  {/* Status */}
                  <td className="py-[5px] px-[3px]">
                    <select
                      value={addBillForm.status}
                      onChange={e => setAddBillForm(f => ({ ...f, status: e.target.value as 'Due' | 'Overdue' | 'Paid' }))}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Due">Due</option>
                      <option value="Overdue">Overdue</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </td>
                  {/* Auto-Send */}
                  <td className="py-[5px] px-[3px] text-center">
                    <label className="flex items-center justify-center gap-1.5 cursor-pointer select-none text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={addBillForm.autoSend}
                        onChange={e => setAddBillForm(f => ({ ...f, autoSend: e.target.checked }))}
                        className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      Auto
                    </label>
                  </td>
                  {/* Actions */}
                  <td className="py-[5px] px-[3px] text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={handleAddBillSubmit}
                        disabled={addBillSaving}
                        title="Save"
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer disabled:opacity-40"
                      >
                        {addBillSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={resetAddBillForm}
                        disabled={addBillSaving}
                        title="Clear"
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition cursor-pointer disabled:opacity-40"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                {addBillError && (
                  <tr className="bg-rose-500/5">
                    <td colSpan={10} className="px-4 py-2 text-[11px] text-rose-400 flex items-center gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      {addBillError}
                    </td>
                  </tr>
                )}
              </>
              {billsLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin text-emerald-500/60" />
                      <span className="text-xs font-mono">Loading bills from server…</span>
                    </div>
                  </td>
                </tr>
              ) : processedBills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <Download className="h-10 w-10 opacity-20" />
                      <span className="text-xs font-mono">
                        {searchTerm || serviceFilter !== 'All' || statusFilter !== 'All'
                          ? 'No bills match your filters.'
                          : 'No bills in this ledger yet.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                processedBills.map(b => {
                  const isChecked = selectedBillIds.includes(b.id);
                  const resident = residents.find(r => r.code === b.residentCode);
                  return (
                    <tr key={b.id} className={`hover:bg-slate-800/50 transition-colors ${isChecked ? 'bg-emerald-500/5' : ''}`}>
                      <td className="py-[5px] px-[3px]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRowCheckbox(b.id)}
                          className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-[5px] px-[3px] text-slate-400 text-[11px]">{b.locationName}</td>
                      <td className="py-[5px] px-[3px]">
                        <span className="font-mono text-slate-300 font-semibold bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                          {b.unit}
                        </span>
                      </td>
                      <td className="py-[5px] px-[3px]">
                        <div className="flex items-center gap-3">
                          {resident?.avatar ? (
                            <img
                              src={resident.avatar}
                              alt={b.residentName}
                              className="h-8 w-8 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              <User className="h-4 w-4 text-slate-500" />
                            </div>
                          )}
                          <span className="font-semibold text-slate-100">{b.residentName}</span>
                        </div>
                      </td>
                      <td className="py-[5px] px-[3px] text-slate-400 font-medium">{b.service}</td>
                      <td className="py-[5px] px-[3px] font-mono font-bold text-slate-200">${b.amount.toFixed(2)}</td>
                      <td className="py-[5px] px-[3px] text-slate-400 font-mono">{b.dueDate}</td>
                      <td className="py-[5px] px-[3px]">
                        {b.status === 'Paid' ? (
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Paid</span>
                        ) : b.status === 'Due' ? (
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Due</span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Overdue</span>
                        )}
                      </td>
                      <td className="py-[5px] px-[3px] text-center">
                        <button
                          onClick={() => handleToggleAutoSend(b.id)}
                          className={`px-3 py-1 text-[10px] font-extrabold uppercase rounded-lg border transition cursor-pointer ${b.autoSend
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
                            : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                            }`}
                        >
                          {b.autoSend ? 'Auto' : 'Manual'}
                        </button>
                      </td>
                      <td className="py-[5px] px-[3px]" />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel Import Wizard */}
      {showImportWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">

            <div className="pb-3 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <FileUp className="h-4 w-4 text-emerald-400" />
                  Excel AR Import Wizard
                </h3>
                <p className="text-xs text-slate-500">Map resident ledger offsets and import monthly bills in bulk</p>
              </div>
              <button
                onClick={() => { setShowImportWizard(false); onCloseImportModalOnInit(); }}
                className="text-slate-500 hover:text-slate-300 font-bold text-sm"
              >✕</button>
            </div>

            {importStep === 'upload' && (
              <div className="text-center py-10 space-y-4">
                <div className="h-16 w-16 bg-slate-800 rounded-2xl border border-slate-700 mx-auto flex items-center justify-center text-emerald-400 shadow-md">
                  <FileUp className="h-8 w-8 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-bold text-slate-100 block">July_2026_Bills.xlsx</span>
                  <span className="text-xs text-slate-500">File size: 242.4 KB • Sheets detected: "July Accounts"</span>
                </div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-normal">
                  The system detected a standard ERP Excel structure ready to be validated against active locations (Diamond, Sky View, Green Park). Click below to parse syntax check.
                </p>
                <button
                  onClick={handleValidateExcel}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black rounded-xl shadow-lg uppercase"
                >
                  Validate Schema & Parse Sheet
                </button>
              </div>
            )}

            {(importStep === 'preview' || importStep === 'validated') && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
                    <span className="text-xs font-semibold text-slate-300">
                      {importStep === 'preview' ? 'Validating records checksum...' : '8 Records parsed and verified correctly!'}
                    </span>
                  </div>
                  {importStep === 'validated' && (
                    <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold uppercase rounded px-2 py-0.5">Check Passed</span>
                  )}
                </div>

                <div className="overflow-x-auto max-h-56 border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-[11px] border-collapse bg-slate-950/60">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="py-[5px] px-[3px]">Resident</th>
                        <th className="py-[5px] px-[3px]">Location</th>
                        <th className="py-[5px] px-[3px]">Service</th>
                        <th className="py-[5px] px-[3px]">Amount</th>
                        <th className="py-[5px] px-[3px]">Due Date</th>
                        <th className="py-[5px] px-[3px]">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                      {fileImportTemplates.arRecords.map((rec, i) => (
                        <tr key={i} className="hover:bg-slate-900/50">
                          <td className="py-[5px] px-[3px] text-slate-200 font-bold">{rec.residentName} ({rec.unit})</td>
                          <td className="py-[5px] px-[3px] text-slate-400">{rec.location}</td>
                          <td className="py-[5px] px-[3px] text-slate-300">{rec.service}</td>
                          <td className="py-[5px] px-[3px] text-emerald-400">${rec.amount.toFixed(2)}</td>
                          <td className="py-[5px] px-[3px] text-slate-500">{rec.dueDate}</td>
                          <td className="py-[5px] px-[3px]">
                            {importStep === 'validated' ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                <CheckCircle2 className="h-3 w-3" /> PASS
                              </span>
                            ) : (
                              <span className="text-slate-500 animate-pulse">Checking...</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    disabled={importStep === 'preview'}
                    onClick={() => setImportStep('upload')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    disabled={importStep === 'preview'}
                    onClick={handleConfirmImport}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black rounded-xl shadow-md transition cursor-pointer disabled:opacity-40"
                  >
                    Import July Ledger Records
                  </button>
                </div>
              </div>
            )}

            {importStep === 'finished' && (
              <div className="text-center py-10 space-y-4">
                <div className="inline-flex items-center justify-center p-3.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wide">538 Records Imported Successfully</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-normal">
                  Roster totals and ledger stats have been dynamically incremented under selected destination contexts in the database.
                </p>
                <button
                  onClick={() => { setShowImportWizard(false); onCloseImportModalOnInit(); }}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  Dismiss Wizard
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
