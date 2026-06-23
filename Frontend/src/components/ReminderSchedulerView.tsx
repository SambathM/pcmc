/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar, Sliders, Check, ShieldAlert, Sparkles, HelpCircle, Save } from 'lucide-react';
import { ReminderConfig } from '../types';
import { VARIABLES_GUIDE } from './ServicesView';

interface ReminderSchedulerViewProps {
  configs: ReminderConfig[];
  setConfigs: (configs: ReminderConfig[]) => void;
  onAddActivity: (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ReminderSchedulerView({
  configs,
  setConfigs,
  onAddActivity
}: ReminderSchedulerViewProps) {
  const [activeConfigs, setActiveConfigs] = useState<ReminderConfig[]>(configs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState('');

  const handleToggleEnabled = (id: string) => {
    const updated = activeConfigs.map(c => {
      if (c.id === id) {
        return { ...c, enabled: !c.enabled };
      }
      return c;
    });
    setActiveConfigs(updated);
  };

  const handleOffsetChange = (id: string, offset: string) => {
    const updated = activeConfigs.map(c => {
      if (c.id === id) {
        return { ...c, offset };
      }
      return c;
    });
    setActiveConfigs(updated);
  };

  const handleStartEditTemplate = (config: ReminderConfig) => {
    setEditingId(config.id);
    setEditingTemplate(config.template);
  };

  const handleSaveTemplate = () => {
    if (!editingId) return;

    const updated = activeConfigs.map(c => {
      if (c.id === editingId) {
        return { ...c, template: editingTemplate };
      }
      return c;
    });

    setActiveConfigs(updated);
    setEditingId(null);
  };

  const handleSaveAllConfig = () => {
    setConfigs(activeConfigs);
    onAddActivity(
      'Notification Schedule Modified',
      'Saved primary reminder dispatch sequence configurations (due offsets, enabled nodes, templates).',
      'success'
    );
  };

  return (
    <div className="space-y-6" id="reminder-scheduler-view-panel">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            AUTOMATION FREQUENCY
          </span>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Chronological Reminder Scheduler
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure step-by-step offsets relative to original payment due dates to automated-dispatch Telegram logs.
          </p>
        </div>

        <button
          onClick={handleSaveAllConfig}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-lg text-xs tracking-wide shadow-lg shadow-emerald-500/10 flex items-center gap-1.5 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>Save Configuration</span>
        </button>
      </div>

      {/* Scheduler Configuration Table */}
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4.5 w-4.5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            Operational Schedule Timeline
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700/60 text-slate-400 select-none uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Enabled</th>
                <th className="py-3 px-4">Phase Trigger</th>
                <th className="py-3 px-4">Chronological Offset</th>
                <th className="py-3 px-4">Template Layout Draft</th>
                <th className="py-3 px-4 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {activeConfigs.map((cfg) => {
                const isEditing = editingId === cfg.id;
                return (
                  <tr key={cfg.id} className={`hover:bg-slate-800/20 transition ${cfg.enabled ? '' : 'opacity-55'}`}>
                    {/* Toggle */}
                    <td className="py-4 px-4 w-16">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={() => handleToggleEnabled(cfg.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    
                    {/* Name */}
                    <td className="py-4 px-4 font-bold text-slate-100">{cfg.name}</td>
                    
                    {/* Offset input */}
                    <td className="py-4 px-4">
                      <input
                        type="text"
                        value={cfg.offset}
                        onChange={(e) => handleOffsetChange(cfg.id, e.target.value)}
                        className="bg-slate-950 border border-slate-805 text-slate-200 text-xs rounded px-2 py-1 font-mono w-24 focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. -5 Days"
                      />
                    </td>

                    {/* Template field */}
                    <td className="py-4 px-4 max-w-sm">
                      {isEditing ? (
                        <textarea
                          rows={4}
                          value={editingTemplate}
                          onChange={(e) => setEditingTemplate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-805 text-slate-300 p-2 text-xs rounded-lg focus:outline-none"
                        />
                      ) : (
                        <p className="text-slate-400 line-clamp-2 italic">
                          "{cfg.template.split('\n')[0]}..."
                        </p>
                      )}
                    </td>

                    {/* Edit Template operations */}
                    <td className="py-4 px-4 text-right">
                      {isEditing ? (
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-slate-400 text-[10px] font-bold rounded uppercase transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveTemplate}
                            className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 text-[10px] font-bold rounded uppercase transition cursor-pointer"
                          >
                            Save Temp
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEditTemplate(cfg)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded uppercase transition cursor-pointer"
                        >
                          Modify Layout
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guide variables info */}
      {editingId && (
        <div className="bg-slate-800/15 border border-slate-800 p-4 rounded-xl space-y-2">
          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 block">
            Reminder Offset Variables Reference Dictionary
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
            {VARIABLES_GUIDE.map((vg, i) => (
              <div key={i} className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-[11px] space-y-0.5">
                <span className="font-mono text-emerald-400 font-bold block">{vg.code}</span>
                <span className="text-slate-500 text-[10px] leading-snug">{vg.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive scenario guidance bar */}
      <div className="p-4 bg-slate-800/10 border border-slate-705/10 rounded-xl flex gap-3 text-xs leading-relaxed max-w-2xl">
        <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          <h4 className="font-bold text-slate-100 uppercase tracking-wider">Automated Event Logic Flow</h4>
          <p className="text-slate-400 text-[11px]">
            Every evening, the background dispatcher scans the AR ledger. If a resident's bill due date aligns with any active offset schedule (e.g. 5 days prior), a Telegram prompt draft is automatically compiled and loaded into the outstanding Message Queue!
          </p>
        </div>
      </div>

    </div>
  );
}
