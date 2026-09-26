import React from 'react';
import { Shield, CheckCircle2, User, LogOut, Lock, Award, School, Bot, Sparkles } from 'lucide-react';
import { StudentProfile, AdminUser } from '../types';

interface HeaderProps {
  currentStudent: StudentProfile | null;
  adminUser: AdminUser | null;
  onStudentLogout: () => void;
  onAdminLogout: () => void;
  onOpenAdminLogin: () => void;
  onGoHome: () => void;
  onOpenAccessPage?: () => void;
  onOpenChatbot?: () => void;
  currentView?: string;
  onToggleView?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStudent,
  adminUser,
  onStudentLogout,
  onAdminLogout,
  onOpenAdminLogin,
  onGoHome,
  onOpenAccessPage,
  onOpenChatbot,
  currentView,
  onToggleView,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Institutional Top Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-100 font-semibold">FiLi Middle School</span>
            <span className="hidden sm:inline text-slate-400">• Work Experience & Campus Contribution Program</span>
            <span className="hidden md:inline text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded text-[11px] font-mono">
              Mandatory for all 1,180 Middle School Students
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-slate-400 hidden lg:inline">Academic Session 2026-2027</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Firebase Cloud DB
            </span>
            <span className="text-emerald-400 font-medium">FCFS Active</span>
            {adminUser ? (
              <span className="bg-indigo-600 text-white font-semibold px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                <Lock className="w-3 h-3" /> Admin Mode
              </span>
            ) : (
              <button
                type="button"
                onClick={onOpenAdminLogin}
                className="text-slate-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 text-[11px]"
                title="School Administration Login"
              >
                <Lock className="w-3 h-3 text-indigo-400" />
                <span>Admin Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div 
          id="header-branding" 
          onClick={onGoHome}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
            <School className="w-5 h-5 text-indigo-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
                FiLi Job Portal
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Official Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Student Employment & AI Screening Pipeline
            </p>
          </div>
        </div>

        {/* User States & Admin Sign-in in Header */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {onOpenChatbot && (
            <button
              type="button"
              id="header-fili-bot-btn"
              onClick={onOpenChatbot}
              className="px-2.5 sm:px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-900 border border-indigo-200/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer group"
              title="Chat with FiLi Bot (Arsh)"
            >
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Bot className="w-3 h-3" />
              </div>
              <span className="font-extrabold text-indigo-800">FiLi Bot</span>
              <span className="text-[10px] text-indigo-600 bg-white px-1.5 py-0.5 rounded font-mono hidden md:inline border border-indigo-100">
                Arsh
              </span>
            </button>
          )}

          {adminUser ? (
            <div className="flex items-center gap-2">
              {onToggleView && (
                <button
                  type="button"
                  onClick={onToggleView}
                  className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                >
                  {currentView === 'admin' ? 'View Student Portal' : 'Admin Dashboard'}
                </button>
              )}

              <div className="flex items-center gap-2.5 bg-slate-100 pl-3 pr-2 py-1.5 rounded-lg border border-slate-200">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-800">{adminUser.username}</span>
                  <span className="text-[10px] text-indigo-600 font-medium">
                    {adminUser.isGoogleAdmin ? 'Google Verified Admin' : 'Administrator'}
                  </span>
                </div>
                <button
                  id="header-admin-logout-btn"
                  onClick={onAdminLogout}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-red-700 hover:bg-white rounded transition-colors flex items-center gap-1 border border-transparent hover:border-slate-200 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          ) : currentStudent ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                {currentStudent.avatarUrl ? (
                  <img
                    src={currentStudent.avatarUrl}
                    alt={currentStudent.name}
                    className="w-8 h-8 rounded-full border border-slate-300 bg-white"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    {currentStudent.name.charAt(0)}
                  </div>
                )}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      {currentStudent.name}
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 fill-blue-50" title="Google Verified Account" />
                  </div>
                  <span className="text-[11px] text-slate-500 truncate max-w-[140px] sm:max-w-[200px]">
                    {currentStudent.email}
                  </span>
                </div>
              </div>
              <button
                id="header-student-logout-btn"
                onClick={onStudentLogout}
                title="Sign out of Google account"
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="header-access-portal-btn"
                type="button"
                onClick={onOpenAccessPage || onOpenAdminLogin}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Google Sign-In Access Page"
              >
                {/* Google Icon */}
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Access Portal</span>
              </button>

              <button
                id="header-admin-signin-btn"
                type="button"
                onClick={onOpenAdminLogin}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer border border-slate-700"
                title="Access Administrator Dashboard"
              >
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Admin Sign In</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
