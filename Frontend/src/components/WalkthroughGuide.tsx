/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, CheckCircle2, Circle, ArrowRight, HelpCircle, ChevronRight, Award } from 'lucide-react';

interface WalkthroughRule {
  step: number;
  title: string;
  tab: string;
  instruction: string;
  actionText: string;
}

const DEMO_STEPS: WalkthroughRule[] = [
  {
    step: 1,
    title: 'Connect Telegram Account',
    tab: 'Telegram Accounts',
    instruction: 'Collection accounts must be connected to dispatch messages. Click "Connect Account" on the Table, click the simulated scanner, and connect the Manager Account / generic API handles.',
    actionText: 'Go to Telegram Accounts'
  },
  {
    step: 2,
    title: 'Select UK 313',
    tab: 'Locations',
    instruction: 'UK CONDO is location-centric. Navigate to Locations and click "Select Context" on the UK 313 card to load its residents and outstanding accounts.',
    actionText: 'Load UK 313'
  },
  {
    step: 3,
    title: 'Import Resident Chats',
    tab: 'Locations',
    instruction: 'Simulate synching with active Telegram community chats. From UK 313 (or the side modal), select and import available resident channels into the database.',
    actionText: 'Import Resident Chats'
  },
  {
    step: 4,
    title: 'Import July Bills',
    tab: 'Accounts Receivable',
    instruction: 'Click "Import Excel" in the Accounts Receivable view to upload and parse the "July_2026_Bills.xlsx" spreadsheet. Review, validate records, and import.',
    actionText: 'Open AR & Import Bills'
  },
  {
    step: 5,
    title: 'Review Accounts Receivable',
    tab: 'Accounts Receivable',
    instruction: 'Once imported, look at the newly populated July bills on the ledger list. Filter and observe details like Service Types, Amounts, and Auto-Send state.',
    actionText: 'Filter July Ledger'
  },
  {
    step: 6,
    title: 'Configure Reminder Schedule',
    tab: 'Reminder Scheduler',
    instruction: 'Review the chronological trigger offsets (e.g. -5 days, Due Date, +3 days) that determine when automated messages get sent. Adjust and save configs.',
    actionText: 'Adjust Scheduler Settings'
  },
  {
    step: 7,
    title: 'Preview Reminder Message',
    tab: 'Message Center',
    instruction: 'Head to the Message Center queue. Select any "Pending" status record and open "Preview Messenger" to see a mock iOS/Android Telegram chat bubble.',
    actionText: 'Preview Queue Message'
  },
  {
    step: 8,
    title: 'Send Reminder Batch',
    tab: 'Message Center',
    instruction: 'Execute sequential delivery! Trigger "Send All Pending" to watch a real-time progress simulation update from Pending to Sent, and finally Delivered.',
    actionText: 'Deliver Message Queue'
  },
  {
    step: 9,
    title: 'Review Delivery Results',
    tab: 'Message Center',
    instruction: 'Observe transmission metrics by toggling through the Delivery Status tabs: Pending, Sent, Delivered, and Failed logs.',
    actionText: 'Check Delivered Status'
  },
  {
    step: 10,
    title: 'View Collection Reports',
    tab: 'Reports',
    instruction: 'Open the analytics dashboard to evaluate property and collection trends. Hover on outstanding charts, compare collection success rates, and export summaries.',
    actionText: 'Open Strategic Reports'
  }
];

interface WalkthroughGuideProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExecuteAutoAction: (step: number) => void;
  onRestartDemo: () => void;
}

export default function WalkthroughGuide({
  currentStep,
  setCurrentStep,
  activeTab,
  setActiveTab,
  onExecuteAutoAction,
  onRestartDemo
}: WalkthroughGuideProps) {
  const activeStep = DEMO_STEPS.find(s => s.step === currentStep) || DEMO_STEPS[0];

  const handleNext = () => {
    if (currentStep < 10) {
      setCurrentStep(currentStep + 1);
      // Automatically switch to the appropriate tab for the next step to guide the user
      const nextStepInfo = DEMO_STEPS.find(s => s.step === currentStep + 1);
      if (nextStepInfo) {
        setActiveTab(nextStepInfo.tab);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      const prevStepInfo = DEMO_STEPS.find(s => s.step === currentStep - 1);
      if (prevStepInfo) {
        setActiveTab(prevStepInfo.tab);
      }
    }
  };

  return (
    <div className="bg-slate-900 border-t border-slate-700/80 px-4 py-2 shrink-0 shadow-2xl relative" id="walkthrough-guide-panel">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3">
        
        {/* Step Indicator Sidebar */}
        <div className="flex flex-row lg:flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 pb-1.5 lg:pb-0 lg:pr-4 lg:w-48 shrink-0 w-full sm:w-auto">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-widest flex items-center gap-1">
                Playbook
              </h3>
            </div>
            <p className="hidden xl:block text-[10px] text-slate-400 leading-tight">
              10-step automation demo
            </p>
          </div>
          
          {/* Progress bar info */}
          <div className="lg:mt-1 w-32 lg:w-full">
            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
              <span>Progress</span>
              <span className="font-mono text-emerald-400 font-bold">{currentStep * 10}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1 rounded-full transition-all duration-300" 
                style={{ width: `${currentStep * 10}%` }}
              />
            </div>
          </div>
        </div>

        {/* Current Active Step Instruction */}
        <div className="flex-1 w-full bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/80 flex flex-col justify-center">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded font-mono border border-blue-500/20">
                  STEP {activeStep.step}/10
                </span>
                <span className="text-[10px] text-slate-500">
                  Target Tab: <strong className="text-blue-600 font-bold">{activeStep.tab}</strong>
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 flex flex-wrap items-baseline gap-1.5 leading-snug">
                <span className="text-slate-900 uppercase tracking-wide">{activeStep.title}</span>
                <span className="hidden md:inline text-[10px] font-normal text-slate-500">— {activeStep.instruction}</span>
              </h4>
              <p className="md:hidden text-[10px] text-slate-600 mt-0.5 leading-snug">
                {activeStep.instruction}
              </p>
            </div>

            {/* Quick-Action assist button */}
            <button
              onClick={() => {
                setActiveTab(activeStep.tab);
                onExecuteAutoAction(activeStep.step);
              }}
              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold rounded transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1 shrink-0 cursor-pointer self-start sm:self-center"
            >
              <Play className="h-2.5 w-2.5 fill-slate-950 text-slate-950" />
              <span>Auto Action</span>
            </button>
          </div>
        </div>

        {/* Playbook Navigation Controls */}
        <div className="flex flex-row lg:flex-col justify-between lg:justify-center gap-1.5 lg:w-44 text-right items-center lg:items-end shrink-0 w-full lg:w-auto">
          <div className="flex gap-1.5">
            <button
              disabled={currentStep === 1}
              onClick={handlePrev}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 text-xs font-semibold rounded-md border border-slate-700 transition"
            >
              Prev
            </button>
            <button
              disabled={currentStep === 10}
              onClick={handleNext}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 text-xs font-semibold rounded-md border border-slate-700 transition flex items-center gap-0.5"
            >
              <span>Next</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <button
            onClick={onRestartDemo}
            className="text-[9px] font-bold text-slate-500 hover:text-rose-400 mt-0.5 transition-all cursor-pointer block uppercase tracking-wider"
          >
            Restart Playbook
          </button>
        </div>

      </div>

      {/* Mini Step Train indicator on bottom */}
      <div className="max-w-7xl mx-auto mt-1.5 pt-1.5 border-t border-slate-800/80 flex justify-between overflow-x-auto gap-1.5 no-scrollbar scroll-smooth">
        {DEMO_STEPS.map((s) => {
          const isCompleted = s.step < currentStep;
          const isActive = s.step === currentStep;
          return (
            <button
              key={s.step}
              onClick={() => {
                setCurrentStep(s.step);
                setActiveTab(s.tab);
              }}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md shrink-0 text-[10px] font-medium transition cursor-pointer ${
                isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : isCompleted 
                    ? 'text-slate-400 hover:text-slate-200' 
                    : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500 fill-emerald-500/10" />
              ) : isActive ? (
                <span className="h-1.2 w-1.2 rounded-full bg-emerald-400 animate-pulse" />
              ) : (
                <Circle className="h-2 w-2 text-slate-700" />
              )}
              <span className="font-semibold">{s.step}</span>
              <span className="hidden xl:inline text-[9px]">{s.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
