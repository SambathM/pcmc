/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, User, ArrowRight } from 'lucide-react';

import logoImage from '../assets/images/uk_condo_logo_1781450064023.jpg';
import { authService } from '../lib/api';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const result = await authService.login(username, password);
      if (result.status) {
        onLoginSuccess();
      } else {
        setError(result.message || 'Invalid username or password');
      }
    } catch {
      setError('Connection error. Ensure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decorative Accents */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md" id="login-container">
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-1 bg-white rounded-full shadow-xl shadow-emerald-500/5 mb-4 ring-4 ring-emerald-500/5 border border-slate-200">
            <img 
              src={logoImage} 
              alt="UK CONDO Logo" 
              className="h-16 w-16 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2" id="login-brand-title">UK CONDO</h1>
          <p className="text-sm font-medium tracking-wide text-emerald-400 uppercase">Property Collection Management System</p>
          <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">
            Internal enterprise platform for accounts receivable, Telegram notification dispatch, and collection auditing.
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-8 relative">
          <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent pointer-events-none" />

          <h2 className="text-lg font-semibold text-slate-100 mb-6 flex items-center gap-2">
            <Shield className="h-4.5 w-4.5 text-emerald-400" />
            Internal Portal Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                  placeholder="Enter employee ID or username"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider" htmlFor="password">
                  Password
                </label>
                <span className="text-xs text-slate-500 hover:text-emerald-400 cursor-pointer transition-colors">
                  Reset requested via IT Support?
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                  placeholder="Employee password"
                />
              </div>
            </div>

            {/* Sign In Button */}
            <button
              id="btn-sign-in"
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/15 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying credentials...</span>
                </div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4.5 w-4.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* System Disclaimer Footer */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <p>© 2026 UK CONDO. For authorized personnel occupancy database use only.</p>
          <p className="mt-1">All database activity, reminder queues, and payment logs logged automatically.</p>
        </div>
      </div>
    </div>
  );
}
