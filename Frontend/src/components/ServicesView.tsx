/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Plus, Search, Edit3, MessageSquare, AlertTriangle, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { ServiceItem } from '../types';
import { serviceService } from '../lib/api';

interface ServicesViewProps {
  services: ServiceItem[];
  setServices: (services: ServiceItem[]) => void;
  servicesLoading: boolean;
  onAddActivity: (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const VARIABLES_GUIDE = [
  { code: '[ResidentName]', desc: 'The full registered resident name' },
  { code: '[UnitNumber]', desc: 'The apartment flat or villa identifier' },
  { code: '[BillAmount]', desc: 'The double precision outstanding service cost' },
  { code: '[DueDate]', desc: 'Specified day limit for payments' },
  { code: '[ServiceName]', desc: 'E.g., Electricity, Parking, Rental charges' },
  { code: '[LocationName]', desc: 'Active properties boundary' },
];

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-fuchsia-600',
  'from-amber-500 to-orange-500',
  'from-blue-500 to-cyan-600',
];

const DEFAULT_TEMPLATE = `Dear [ResidentName],

This is a reminder that your [ServiceName] bill of $[BillAmount] is due on [DueDate].

Unit: [UnitNumber]
Property: [LocationName]

Please arrange payment at your earliest convenience.

Thank you.`;

export default function ServicesView({ services, setServices, servicesLoading, onAddActivity }: ServicesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // --- Template editor ---
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [editedTemplate, setEditedTemplate] = useState('');
  const [saving, setSaving] = useState(false);

  // --- Add modal ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addTemplate, setAddTemplate] = useState(DEFAULT_TEMPLATE);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // --- Edit modal ---
  const [editTarget, setEditTarget] = useState<ServiceItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // --- Delete ---
  const [confirmDeleteService, setConfirmDeleteService] = useState<ServiceItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [constrainedService, setConstrainedService] = useState<ServiceItem | null>(null);
  const [constrainedMessage, setConstrainedMessage] = useState('');

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Template editor handlers ---
  const handleOpenEditor = (serv: ServiceItem) => {
    setSelectedService(serv);
    setEditedTemplate(serv.reminderTemplate);
  };

  const handleSaveTemplate = async () => {
    if (!selectedService) return;
    setSaving(true);
    try {
      await serviceService.update(selectedService.id, { reminderTemplate: editedTemplate });
      setServices(services.map(s =>
        s.id === selectedService.id ? { ...s, reminderTemplate: editedTemplate } : s
      ));
      setSelectedService(null);
      onAddActivity(
        'Service Notification Edited',
        `Modified master Telegram notification layout schema for service: ${selectedService.name}.`,
        'info'
      );
    } finally {
      setSaving(false);
    }
  };

  // --- Add handlers ---
  const openAddModal = () => {
    setAddName('');
    setAddDescription('');
    setAddTemplate(DEFAULT_TEMPLATE);
    setAddError('');
    setShowAddModal(true);
  };

  const handleAddService = async () => {
    const name = addName.trim();
    if (!name) { setAddError('Service name is required.'); return; }
    if (services.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      setAddError(`A service named "${name}" already exists.`); return;
    }
    setAdding(true);
    setAddError('');
    try {
      const created = await serviceService.create({
        name,
        description: addDescription.trim() || undefined,
        reminderTemplate: addTemplate,
      });
      setServices([...services, {
        id: created.id,
        name: created.name,
        description: created.description,
        activeResidents: created.activeResidents,
        outstandingAmount: created.outstandingAmount,
        reminderTemplate: created.reminderTemplate,
      }]);
      setShowAddModal(false);
      onAddActivity('Service Added', `Created new service: ${created.name}.`, 'success');
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to create service.');
    } finally {
      setAdding(false);
    }
  };

  // --- Edit handlers ---
  const openEditModal = (serv: ServiceItem) => {
    setEditTarget(serv);
    setEditName(serv.name);
    setEditDescription(serv.description ?? '');
    setEditError('');
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    const name = editName.trim();
    if (!name) { setEditError('Service name is required.'); return; }
    if (services.some(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== editTarget.id)) {
      setEditError(`A service named "${name}" already exists.`); return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      await serviceService.update(editTarget.id, {
        name,
        description: editDescription.trim() || undefined,
      });
      setServices(services.map(s =>
        s.id === editTarget.id ? { ...s, name, description: editDescription.trim() || undefined } : s
      ));
      onAddActivity('Service Updated', `Renamed service to: ${name}.`, 'info');
      setEditTarget(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update service.');
    } finally {
      setEditSaving(false);
    }
  };

  const showConstrainedAlert = (serv: ServiceItem, msg: string) => {
    setConstrainedService(serv);
    setConstrainedMessage(msg);
  };

  // --- Delete handler (called after confirmation) ---
  const handleDelete = async () => {
    const serv = confirmDeleteService;
    if (!serv) return;
    // Fast client-side guard
    if (serv.activeResidents > 0) {
      setConfirmDeleteService(null);
      showConstrainedAlert(serv,
        `${serv.name} has ${serv.activeResidents} active resident${serv.activeResidents !== 1 ? 's' : ''} with outstanding bills linked to it. Reassign or settle all bills before deleting.`
      );
      return;
    }
    setDeletingId(serv.id);
    setConfirmDeleteService(null);
    try {
      await serviceService.remove(serv.id);
      setServices(services.filter(s => s.id !== serv.id));
      onAddActivity('Service Removed', `Deleted service: ${serv.name}.`, 'warning');
    } catch (err: unknown) {
      // 409 Conflict — backend detected concurrent bills added since the page loaded
      const msg = err instanceof Error ? err.message : 'Failed to delete service.';
      showConstrainedAlert(serv, msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6" id="services-view-panel">

      {/* Sticky toolbar */}
      <div className="sticky top-[-24px] -mt-6 -mx-6 px-6 py-4 bg-slate-950/95 backdrop-blur-md shadow-md shadow-slate-950/10 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer leading-none h-9 shrink-0 transition shadow-lg shadow-emerald-500/5"
        >
          <Plus className="h-4 w-4" />
          <span>Add Service</span>
        </button>
      </div>

      {/* Section header */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Utility Services</h3>
        <span className="ml-auto text-[10px] text-slate-500 font-mono">
          {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      {servicesLoading ? (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-500/60" />
          <span className="text-xs font-mono">Loading services from server…</span>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-4 text-slate-500 border border-dashed border-slate-700/50 rounded-2xl">
          <Shield className="h-10 w-10 opacity-20" />
          <span className="text-xs font-mono text-center max-w-xs">
            {searchQuery ? 'No services match your search.' : 'No services configured.'}
          </span>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-700/60 overflow-hidden divide-y divide-slate-800">
          {filteredServices.map((s, index) => {
            const initials = s.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            const gradient = GRADIENTS[index % GRADIENTS.length];
            const isDeleting = deletingId === s.id;
            return (
              <div
                key={s.id}
                className="flex items-center gap-4 px-5 py-4 bg-slate-900 hover:bg-slate-800/60 transition-colors"
              >
                {/* Avatar */}
                <div
                  className={`h-10 w-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-black text-base drop-shadow shrink-0`}
                  style={{ color: '#fff' }}
                >
                  {initials}
                </div>

                {/* Identity */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-100 text-sm leading-tight truncate">{s.name}</span>
                    <span className="text-[9px] uppercase font-mono font-bold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/10 shrink-0">
                      Global Rate Match
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-mono">
                      <span className="text-slate-500">Residents:</span> {s.activeResidents}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold">
                      ${s.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Template preview snippet — visible on large screens */}
                <div className="hidden lg:block w-64 shrink-0">
                  <p className="text-[10px] text-slate-500 truncate font-mono">
                    {s.reminderTemplate.split('\n').find(l => l.trim()) ?? '—'}
                  </p>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEditor(s)}
                    title="Edit template"
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg uppercase tracking-wide transition cursor-pointer border border-slate-700 flex items-center gap-1.5"
                  >
                    <MessageSquare className="h-3 w-3 text-emerald-400" />
                    Template
                  </button>
                  <button
                    onClick={() => openEditModal(s)}
                    title="Edit service"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteService(s)}
                    disabled={isDeleting}
                    title="Delete service"
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 transition cursor-pointer disabled:opacity-40"
                  >
                    {isDeleting
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Service modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">

            <div className="pb-3 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-emerald-400" />
                  New Service
                </h3>
                <p className="text-xs text-slate-500">Configure a billing service and its reminder template</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-300 font-bold text-sm">✕</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-400">Service Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Electricity, Water, Parking…"
                  value={addName}
                  onChange={e => { setAddName(e.target.value); setAddError(''); }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-400">Description <span className="text-slate-600">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Short description of this service"
                  value={addDescription}
                  onChange={e => setAddDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-400">Reminder Template</label>
                <textarea
                  rows={8}
                  value={addTemplate}
                  onChange={e => setAddTemplate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-sans text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {addError && (
                <p className="text-xs text-red-400 font-mono flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {addError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddService}
                disabled={adding}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold rounded-lg shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {adding && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Create Service
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Service modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">

            <div className="pb-3 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Pencil className="h-4 w-4 text-emerald-400" />
                  Edit Service
                </h3>
                <p className="text-xs text-slate-500">Update name or description</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-slate-500 hover:text-slate-300 font-bold text-sm">✕</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-400">Service Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => { setEditName(e.target.value); setEditError(''); }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-400">Description <span className="text-slate-600">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Short description of this service"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {editError && (
                <p className="text-xs text-red-400 font-mono flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {editError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold rounded-lg shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {editSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDeleteService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/20 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 shrink-0">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-100">Delete Service</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to delete{' '}
                  <span className="text-slate-200 font-semibold">{confirmDeleteService.name}</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmDeleteService(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Constrained delete alert */}
      {constrainedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-100">Cannot Delete Service</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{constrainedMessage}</p>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => { setConstrainedService(null); setConstrainedMessage(''); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template editor modal */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative">

            <div className="pb-3 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="h-4 w-4 text-emerald-400" />
                  Edit Template Parameters: {selectedService.name}
                </h3>
                <p className="text-xs text-slate-500">Inject database values on dispatch</p>
              </div>
              <button onClick={() => setSelectedService(null)} className="text-slate-500 hover:text-slate-300 font-bold text-sm">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-400">Template raw format</label>
                <textarea
                  rows={10}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 font-sans text-xs focus:ring-emerald-500 focus:outline-none resize-none leading-relaxed"
                  value={editedTemplate}
                  onChange={e => setEditedTemplate(e.target.value)}
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block pb-2 border-b border-slate-800">
                    Template Syntax variables
                  </span>
                  <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 text-[11px] mt-2.5">
                    {VARIABLES_GUIDE.map((v, idx) => (
                      <div key={idx} className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => setEditedTemplate(editedTemplate + v.code)}
                          className="font-mono text-emerald-400 font-bold self-start bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 hover:bg-slate-800/80 transition text-left shrink-0"
                        >
                          {v.code}
                        </button>
                        <span className="text-slate-400 text-[10px]">{v.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex bg-slate-900 p-2.5 rounded border border-slate-850 text-[10px] text-slate-500 leading-normal gap-1.5 mt-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500/80 shrink-0" />
                  <span>The platform handshakes and injects these fields sequentially during broadcast dispatch.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedService(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={saving}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold rounded-lg shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Save Notification Copy
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
