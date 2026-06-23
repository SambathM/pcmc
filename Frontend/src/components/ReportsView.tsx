/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowUpRight, TrendingUp, Landmark, ShieldAlert, Sparkles, BarChart, HardDrive, CheckCircle } from 'lucide-react';
import { Location, Resident, Bill, ServiceItem } from '../types';

interface ReportsViewProps {
  locations: Location[];
  residents: Resident[];
  bills: Bill[];
  services: ServiceItem[];
  selectedLocation: string;
}

export default function ReportsView({
  locations,
  residents,
  bills,
  services,
  selectedLocation
}: ReportsViewProps) {
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);

  // Compute stats based on selected location
  const locFilteredBills = selectedLocation === 'All Locations'
    ? bills
    : bills.filter(b => b.locationName === selectedLocation);

  const locFilteredResidents = selectedLocation === 'All Locations'
    ? residents
    : residents.filter(r => r.locationName === selectedLocation);

  // Stats calculation
  const totalOutstanding = locFilteredBills
    .filter(b => b.status !== 'Paid')
    .reduce((sum, b) => sum + b.amount, 0);

  const totalPaid = locFilteredBills
    .filter(b => b.status === 'Paid')
    .reduce((sum, b) => sum + b.amount, 0);

  const billingTotal = totalOutstanding + totalPaid;
  const collectionRate = billingTotal > 0 ? (totalPaid / billingTotal) * 100 : 84.2;

  // 1. Outstanding by Location Data
  const locationOutstandingData = locations.map(loc => {
    const locBills = bills.filter(b => b.locationName === loc.name && b.status !== 'Paid');
    const amt = locBills.reduce((sum, b) => sum + b.amount, 0);
    return { name: loc.name, outstanding: amt };
  });

  const maxLocOutstanding = Math.max(...locationOutstandingData.map(d => d.outstanding), 1);

  // 2. Outstanding by Service Data
  const serviceOutstandingData = services.map(s => {
    // If specific location, filter bills of that service in that location
    const matchedBills = bills.filter(b => 
      b.service === s.name && 
      b.status !== 'Paid' && 
      (selectedLocation === 'All Locations' || b.locationName === selectedLocation)
    );
    const amt = matchedBills.reduce((sum, b) => sum + b.amount, 0);
    return { name: s.name, outstanding: amt };
  });

  const maxServOutstanding = Math.max(...serviceOutstandingData.map(d => d.outstanding), 1);

  // 3. Top Overdue Residents Leaderboard list
  const overdueResidentsList = locFilteredResidents
    .filter(r => r.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  return (
    <div className="space-y-6" id="reports-view-panel">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            MANAGEMENT AUDITING
          </span>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Strategic Collection Reports
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit collection performance indices, service arrears ratios, and location compliance values.
          </p>
        </div>

        <span className="text-xs text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg select-text">
          Scope Filter: <strong className="text-emerald-400">"{selectedLocation}"</strong>
        </span>
      </div>

      {/* KPI Stats summary rail */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Collection Rate SLA</span>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-black text-emerald-400 font-mono">{collectionRate.toFixed(1)}%</strong>
            <span className="text-[10px] text-emerald-500 flex items-center gap-0.5"><TrendingUp className="h-3 w-3" /> +1.2% MoM</span>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Arrears Outstanding</span>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-black text-slate-200 font-mono">
              ${totalOutstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </strong>
            <span className="text-[10px] text-slate-500">Unresolved sum</span>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Reminders Sent</span>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-black text-teal-400 font-mono">2,450</strong>
            <span className="text-[10px] text-teal-400">Handshake logs</span>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Messages Delivered</span>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-black text-slate-150 font-mono">2,410</strong>
            <span className="text-[10px] text-emerald-400 font-medium font-mono">98.3% Success</span>
          </div>
        </div>
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart A: Outstanding by Location */}
        <div className="bg-slate-800/40 border border-slate-700/40 p-5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-emerald-400" />
              Arrears Distribution by Property Location
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Absolute outstanding in USD</span>
          </div>

          <div className="space-y-4 pt-1">
            {locationOutstandingData.map((d, idx) => {
              const pct = (d.outstanding / maxLocOutstanding) * 100;
              const isHovered = hoveredBarIndex === idx;

              return (
                <div 
                  key={idx} 
                  className="space-y-1 cursor-pointer"
                  onMouseEnter={() => setHoveredBarIndex(idx)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">{d.name}</span>
                    <strong className={`font-mono transition-colors ${isHovered ? 'text-emerald-400' : 'text-slate-200'}`}>
                      ${d.outstanding.toLocaleString()}
                    </strong>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-900 flex">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHovered 
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-300 shadow-md' 
                          : 'bg-gradient-to-r from-emerald-500 over to-teal-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart B: Outstanding by Service Cost center */}
        <div className="bg-slate-800/40 border border-slate-700/40 p-5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
              <BarChart className="h-4 w-4 text-emerald-400" />
              Outstanding Balance by Utility Tariff Center
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Selected Location filtered summary</span>
          </div>

          <div className="space-y-4 pt-1">
            {serviceOutstandingData.map((d, index) => {
              const pct = (d.outstanding / maxServOutstanding) * 100;
              const isHovered = hoveredPieIndex === index;

              return (
                <div 
                  key={index} 
                  className="space-y-1 cursor-pointer"
                  onMouseEnter={() => setHoveredPieIndex(index)}
                  onMouseLeave={() => setHoveredPieIndex(null)}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">{d.name}</span>
                    <strong className={`font-mono transition-colors ${isHovered ? 'text-teal-400' : 'text-slate-200'}`}>
                      ${d.outstanding.toLocaleString()}
                    </strong>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-900">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHovered 
                          ? 'bg-gradient-to-r from-teal-400 to-emerald-300 shadow-md' 
                          : 'bg-gradient-to-r from-teal-500 to-emerald-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Top Overdue Residents Audit Leaderboard */}
      <div className="bg-slate-800/25 border border-slate-800 p-5 rounded-2xl">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
            Top Overdue Resident Accounts Leaderboard
          </h3>
          <span className="text-[10px] text-slate-500 uppercase font-mono">Immediate contact required</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 select-none uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-4 w-12">Rank</th>
                <th className="py-2.5 px-4">Resident Name</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4">Unit Flat</th>
                <th className="py-2.5 px-4 font-mono">Telegram channel</th>
                <th className="py-2.5 px-4 text-right">Outstanding Sum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {overdueResidentsList.map((res, index) => (
                <tr key={res.code} className="hover:bg-slate-800/10 transition">
                  <td className="py-3 px-4 font-black text-rose-400 text-sm font-mono">{index + 1}</td>
                  <td className="py-3 px-4 font-bold text-slate-200">{res.name}</td>
                  <td className="py-3 px-4 text-slate-400">{res.locationName}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-slate-300 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px]">
                      Unit {res.unit}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-emerald-400 font-mono text-[13px]">{res.telegram}</td>
                  <td className="py-3 px-4 text-right font-black font-mono text-slate-100 text-sm">
                    ${res.balance.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
