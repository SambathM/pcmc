/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Send, Eye, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Phone, Clock, MessageSquare, Monitor, CheckCircle, HelpCircle } from 'lucide-react';
import { MessageQueueItem } from '../types';
import { avatarMap } from '../data';

interface MessageCenterViewProps {
  messages: MessageQueueItem[];
  setMessages: React.Dispatch<React.SetStateAction<MessageQueueItem[]>>;
  selectedLocation: string;
  onAddActivity: (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  singleMessagePreviewItem: MessageQueueItem | null;
  onClearSinglePreview: () => void;
}

export default function MessageCenterView({
  messages,
  setMessages,
  selectedLocation,
  onAddActivity,
  singleMessagePreviewItem,
  onClearSinglePreview
}: MessageCenterViewProps) {
  const [activeTab, setActiveTab] = useState<'Pending' | 'Sent' | 'Delivered' | 'Failed'>('Pending');
  const [selectedQueueItem, setSelectedQueueItem] = useState<MessageQueueItem | null>(null);
  
  // Bulk dispatch broadcast simulator status
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);
  const [broadcastLog, setBroadcastLog] = useState<string[]>([]);

  // Keep single preview from outside selected
  React.useEffect(() => {
    if (singleMessagePreviewItem) {
      setSelectedQueueItem(singleMessagePreviewItem);
      setActiveTab('Pending');
    }
  }, [singleMessagePreviewItem]);

  // Context location filter
  const locationFiltered = selectedLocation === 'All Locations'
    ? messages
    : messages.filter(m => m.locationName === selectedLocation);

  // Tab filter
  const tabFiltered = locationFiltered.filter(m => m.status === activeTab);

  const getTabCount = (tab: typeof activeTab) => {
    return locationFiltered.filter(m => m.status === tab).length;
  };

  const handleSendSingle = (id: string) => {
    // Single delivery transition: Pending -> Delivered
    const updated = messages.map(m => {
      if (m.id === id) {
        return { 
          ...m, 
          status: 'Delivered' as const, 
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) 
        };
      }
      return m;
    });
    setMessages(updated);

    const target = messages.find(m => m.id === id);
    if (target) {
      onAddActivity(
        'Telegram Dispatch Complete',
        `Successfully delivered pre-due ${target.service} notification to ${target.residentName} (${target.telegram})`,
        'success'
      );
    }
    
    // Auto shift selected preview if it was this row
    if (selectedQueueItem && selectedQueueItem.id === id) {
      setSelectedQueueItem(null);
      if (singleMessagePreviewItem) {
        onClearSinglePreview();
      }
    }
  };

  const handleBulkTransmit = () => {
    const pendingsToDeliver = tabFiltered.filter(m => m.status === 'Pending');
    if (pendingsToDeliver.length === 0) {
      setBroadcastLog(['No pending notifications in the active context queue.']);
      return;
    }

    setIsBroadcasting(true);
    setBroadcastProgress(0);
    setBroadcastLog(['Initiating API Secure broadcast sequence...', 'Allocating secure Telegram routing ports...']);

    let progressCount = 0;
    const totalToDeliver = pendingsToDeliver.length;

    const interval = setInterval(() => {
      progressCount++;
      const pct = Math.min(Math.round((progressCount / totalToDeliver) * 100), 100);
      setBroadcastProgress(pct);

      const targetMsg = pendingsToDeliver[progressCount - 1];
      if (targetMsg) {
        // Shift status to Delivered
        setMessages(prev => prev.map(m => m.id === targetMsg.id ? { 
          ...m, 
          status: 'Delivered' as const,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
        } : m));

        setBroadcastLog(prev => [
          ...prev, 
          `✓ [COMPLETED] Sent ${targetMsg.service} to ${targetMsg.residentName} (${targetMsg.telegram}) Unit ${targetMsg.unit}`
        ]);
      }

      if (progressCount >= totalToDeliver) {
        clearInterval(interval);
        setTimeout(() => {
          setIsBroadcasting(false);
          setSelectedQueueItem(null);
          onClearSinglePreview();
          onAddActivity(
            'Batch Broadcast Sequence Success',
            `Delivered ${totalToDeliver} outstanding notification files successfully through Telegram servers.`,
            'success'
          );
        }, 600);
      }
    }, 800); // 800ms per simulated message dispatch
  };

  const handleResetQueue = () => {
    // Reset all status records of the messages back to Pending for convenient retry/testing
    const reset = messages.map(m => m.locationName === selectedLocation ? { ...m, status: 'Pending' as const } : m);
    setMessages(reset);
    onAddActivity('Message Queue Reset', `Rollbacked message queue statuses to Pending for selected property to enable re-testing.`, 'info');
  };

  return (
    <div className="space-y-6" id="message-center-view-panel">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            CORRESPONDENCE HUBS
          </span>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Telegram Notification Dispatcher
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit and fire scheduled chronological reminder batches to active resident chat links.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleResetQueue}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
            title="Reset active location queue to Pending to re-run demo scenario"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset Context Queue</span>
          </button>
          
          {activeTab === 'Pending' && tabFiltered.length > 0 && (
            <button
              onClick={handleBulkTransmit}
              disabled={isBroadcasting}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              <span>Send Reminder Batch ({tabFiltered.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Broadcasting sequential loader */}
      {isBroadcasting && (
        <div className="bg-slate-950 p-5 rounded-2xl border border-emerald-500/30 space-y-4 shadow-xl">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-emerald-400 font-bold animate-pulse flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              DISPATCHING SECURE TELEGRAM PAYMENTS BROADCAST...
            </span>
            <span className="text-slate-400">{broadcastProgress}%</span>
          </div>

          {/* Graphical bar */}
          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full transition-all duration-305" 
              style={{ width: `${broadcastProgress}%` }}
            />
          </div>

          {/* Sequential scroll log */}
          <div className="bg-slate-950 rounded-xl p-3 max-h-24 overflow-y-auto font-mono text-[10px] text-slate-500 border border-slate-850 space-y-1">
            {broadcastLog.map((logLine, idx) => (
              <p key={idx} className={logLine.includes('✓') ? 'text-emerald-400' : 'text-slate-400'}>
                {logLine}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Tab Selectors BAR */}
      <div className="flex border-b border-slate-800 text-xs">
        {(['Pending', 'Sent', 'Delivered', 'Failed'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const count = getTabCount(tab);
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSelectedQueueItem(null);
                if (singleMessagePreviewItem) {
                  onClearSinglePreview();
                }
              }}
              className={`py-3 px-5 border-b-2 font-bold uppercase tracking-wider transition relative cursor-pointer ${
                isActive 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab} Queue</span>
              {count > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-[10px] rounded-full font-black ${
                  tab === 'Pending' 
                    ? 'bg-amber-500/15 text-amber-400' 
                    : tab === 'Delivered' 
                      ? 'bg-emerald-500/15 text-emerald-400' 
                      : 'bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Queue Columns Split info */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left 3 columns: table index queue lists */}
        <div className="lg:col-span-3 bg-slate-800/25 border border-slate-705 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 select-none uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Resident</th>
                  <th className="py-3 px-4">Flat Context</th>
                  <th className="py-3 px-4">Cron Offset</th>
                  <th className="py-3 px-4">Charge / Cost</th>
                  <th className="py-3 px-4 text-right">Preview Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {tabFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No notifications matching status <strong className="text-slate-400 uppercase">{activeTab}</strong> found.
                    </td>
                  </tr>
                ) : (
                  tabFiltered.map((m) => {
                    const isSelected = selectedQueueItem?.id === m.id;
                    return (
                      <tr 
                        key={m.id} 
                        className={`hover:bg-slate-800/15 transition cursor-pointer ${isSelected ? 'bg-emerald-500/5' : ''}`}
                        onClick={() => setSelectedQueueItem(m)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {avatarMap[m.residentCode] ? (
                              <img 
                                src={avatarMap[m.residentCode]} 
                                alt={m.residentName} 
                                className="h-8 w-8 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-755 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">
                                {m.residentName.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-100">{m.residentName}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{m.telegram}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-300">Unit {m.unit}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-705">
                            {m.offsetType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-300">{m.service}</span>
                          <span className="text-[10px] text-emerald-400 block mt-0.5 font-mono font-bold">${m.amount.toFixed(2)}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedQueueItem(m)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                              title="Open message layout preview"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            
                            {m.status === 'Pending' && (
                              <button
                                onClick={() => handleSendSingle(m.id)}
                                className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 rounded transition"
                                title="Deliver immediately via webhook trigger"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            )}
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

        {/* Right 2 columns: Telegram Chat Screen preview area */}
        <div className="lg:col-span-2 space-y-4">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 flex items-center gap-2">
            <Monitor className="h-3.5 w-3.5" /> Mobile Telegram UI Hookup Preview
          </span>

          {selectedQueueItem ? (
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl overflow-hidden shadow-2xl relative">
              
              {/* Phone App Mock header */}
              <div className="bg-[#1f2937]/90 px-4 py-3 border-b border-slate-750 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-sky-500 text-white font-black flex items-center justify-center text-xs shadow">
                    UK
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">UK CONDO Automated Portal</h4>
                    <span className="text-[9px] text-sky-400 font-mono block">Connected • bot API live</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {selectedQueueItem.unit} thread
                </div>
              </div>

              {/* Chat bubble background canvas */}
              <div className="bg-slate-950 p-4 min-h-[260px] flex flex-col justify-end space-y-4 relative">
                <div className="absolute top-0 left-0 right-0 p-3 opacity-10 pointer-events-none text-center text-[10px] text-slate-600 font-mono select-none">
                  SECURED SSL ENCRYPTED TELEGRAM GATEWAY
                </div>

                {/* Left aligned recipient profile system log card */}
                <div className="self-start max-w-[85%] bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-none p-4 text-[11px] text-slate-300 shadow leading-relaxed select-text flex gap-3 items-start">
                  {avatarMap[selectedQueueItem.residentCode] ? (
                    <img 
                      src={avatarMap[selectedQueueItem.residentCode]} 
                      alt={selectedQueueItem.residentName} 
                      className="h-10 w-10 rounded-full object-cover border border-slate-705 bg-slate-800 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-805 border border-slate-705 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0 font-sans">
                      {selectedQueueItem.residentName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-500 uppercase block font-bold mb-1">SYSTEM PARAMETER BINDER HANDSHAKE</span>
                    <span className="font-bold text-slate-100 block text-xs">{selectedQueueItem.residentName}</span>
                    <span className="text-[10px] text-sky-400 font-mono block mt-0.5">{selectedQueueItem.telegram}</span>
                    <span className="text-[10px] text-slate-450 block mt-1 font-sans">Unit target: <strong className="text-slate-300">{selectedQueueItem.unit}</strong></span>
                  </div>
                </div>

                {/* Telegram themed chat bubble prompt (Right aligned) */}
                <div className="self-end max-w-[85%] bg-sky-900/60 text-sky-100 border border-sky-700 rounded-2xl rounded-br-none p-3 text-[12px] shadow-lg leading-relaxed select-text space-y-2 relative">
                  <div className="whitespace-pre-line">
                    {selectedQueueItem.text}
                  </div>
                  
                  {/* Bubble timestamp footer */}
                  <div className="flex justify-end items-center gap-1 text-[9px] text-sky-300 font-mono pt-1">
                    <span>{selectedQueueItem.timestamp.split(' ')[1] || '09:00'}</span>
                    <span className="font-extrabold uppercase bg-sky-900 px-1 py-0.2 rounded">
                      {selectedQueueItem.status === 'Delivered' ? '✓✓ Delivered' : 'Pending'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Action controller footer card */}
              {selectedQueueItem.status === 'Pending' && (
                <div className="bg-slate-900/90 p-4 border-t border-slate-800 flex justify-between items-center gap-2">
                  <span className="text-[11px] text-slate-400">Review layout copy before delivering.</span>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSendSingle(selectedQueueItem.id)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow cursor-pointer"
                    >
                      <Send className="h-3 w-3 fill-slate-950" />
                      <span>Deliver now</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedQueueItem(null);
                        onClearSinglePreview();
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-800 py-24 text-center rounded-2xl text-slate-500 flex flex-col items-center justify-center space-y-2 select-none">
              <MessageSquare className="h-10 w-10 text-slate-700" />
              <div className="text-xs">Click any row eye icon or select layout to load operational Telegram bubble preview.</div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
