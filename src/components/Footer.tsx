import React from 'react';
import { Lock, School, ShieldCheck } from 'lucide-react';

interface FooterProps {
  onOpenAdminLogin: () => void;
  isAdminLoggedIn: boolean;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdminLogin, isAdminLoggedIn }) => {
  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-10 px-4 sm:px-6 mt-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
              <School className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-200 block text-sm">
                Job Application for FiLi
              </span>
              <span className="text-[11px] text-slate-500">
                Middle School Work Experience & Campus Contribution Program (1,180 Student Capacity)
              </span>
            </div>
          </div>

          {/* Discrete Admin Access Button (Prompt requirement) */}
          <div className="flex items-center gap-4">
            <button
              id="footer-admin-access-btn"
              onClick={onOpenAdminLogin}
              className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Admin Access</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} FiLi Middle School Administration. All rights reserved. First-Come, First-Served queue pipeline strictly automated.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Firebase Firestore (Live Cloud Sync)
            </span>
            <span>•</span>
            <span>Official Student Employment Board</span>
            <span>•</span>
            <span>BRAED Stated Stipends</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
