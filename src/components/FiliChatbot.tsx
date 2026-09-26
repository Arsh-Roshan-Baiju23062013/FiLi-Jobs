import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  RefreshCw,
  Compass,
  ArrowRight,
  FileText,
  Briefcase,
  AlertCircle,
  HelpCircle,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { StudentProfile, Application } from '../types';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  suggestedActions?: string[];
}

interface FiliChatbotProps {
  currentStudent: StudentProfile | null;
  existingApplication: Application | null;
  currentView?: string;
  isOpenExternal?: boolean;
  onOpenExternal?: () => void;
  onCloseExternal?: () => void;
  onNavigateToForm?: () => void;
  onNavigateToDirectory?: () => void;
  onNavigateToAccess?: () => void;
}

const WALKTHROUGH_STEPS = [
  {
    step: 1,
    title: 'Google Sign In',
    summary: 'Authenticate with your official school Google account.',
    details:
      'Every middle school student must authenticate through the Access Portal using Google Sign-In. If a parent is applying for you, they must provide your official student name.',
    actionLabel: 'Go to Access Page',
    actionType: 'access',
  },
  {
    step: 2,
    title: 'Browse 19 Campus Jobs',
    summary: 'Explore positions across Tech, Media, Athletics, Library, and more.',
    details:
      'We have 19 distinct campus jobs tailored for middle schoolers (AV Crew, Peer Tutor, Library Aide, Tech Support, Greenhouse Tender, etc.). Check duties, requirements, and monthly stipends.',
    actionLabel: 'Browse Job Directory',
    actionType: 'directory',
  },
  {
    step: 3,
    title: 'Check Live Vacancies & Capacity',
    summary: 'Ensure your target job is Open and has remaining slots.',
    details:
      'All campus jobs operate on a strict First-Come, First-Served (FCFS) queue. Look for the green "Open" badge and check how many spots remain out of total capacity.',
    actionLabel: 'Check Job Slots',
    actionType: 'directory',
  },
  {
    step: 4,
    title: 'Fill Out Application Form',
    summary: 'Provide your Grade, Section, Job choice, and optional resume.',
    details:
      'Select your Grade (6th, 7th, 8th), Section (A, B, C, D...), and pick your role. You can upload an optional PDF resume. Remember: No resume? No problem! You will NEVER be disqualified.',
    actionLabel: 'Open Application Form',
    actionType: 'form',
  },
  {
    step: 5,
    title: 'Automated AI Screening',
    summary: 'Gemini reviews your application instantly.',
    details:
      'Our AI screening pipeline instantly verifies your eligibility and places you. Entry-level students go into the general FCFS pool (score 55-65). Certified candidates qualify for the 25% reserved skilled seats (score 85-98).',
    actionLabel: 'Review AI Policy',
    actionType: 'faq',
  },
  {
    step: 6,
    title: 'Confirmation & PDF Receipt',
    summary: 'Track your placement and download your Official FiLi Receipt.',
    details:
      'Immediately upon submission, you receive an official placement status and can download an authenticated FiLi PDF receipt featuring your verification code and timestamp.',
    actionLabel: 'Track Status',
    actionType: 'form',
  },
];

export const FiliChatbot: React.FC<FiliChatbotProps> = ({
  currentStudent,
  existingApplication,
  currentView,
  isOpenExternal,
  onOpenExternal,
  onCloseExternal,
  onNavigateToForm,
  onNavigateToDirectory,
  onNavigateToAccess,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : internalIsOpen;

  const setIsOpen = (val: boolean) => {
    setInternalIsOpen(val);
    if (val) {
      onOpenExternal?.();
    } else {
      onCloseExternal?.();
    }
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [liveStatus, setLiveStatus] = useState<{
    globalOpen: boolean;
    remainingSpots: number;
    openJobsCount: number;
  }>({
    globalOpen: true,
    remainingSpots: 1180,
    openJobsCount: 19,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize welcome message from Arsh when component mounts
  useEffect(() => {
    const welcomeMsg: ChatMessage = {
      id: 'welcome-1',
      role: 'model',
      text: `Hello${currentStudent ? ` ${currentStudent.name.split(' ')[0]}` : ''}! I'm **Arsh**, your personal FiLi Campus Placement Assistant! 🎓✨

I know everything about our school's 19 job positions, live quota vacancies, student salaries, and the application process. 

I'm automatically updated with the latest live data from our administration. What can I help you with today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: [
        '🚀 Walk me through how to apply (Step-by-step)',
        '💼 Which jobs have open slots right now?',
        '📄 Do I need a resume to get placed?',
        '💰 How do student salaries work?',
        '🔒 Can I apply for multiple jobs?',
      ],
    };
    setMessages([welcomeMsg]);
  }, [currentStudent?.email]);

  // Auto-scroll messages to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen, showWalkthrough]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || inputValue).trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome-1')
        .slice(-8)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          conversationHistory: historyPayload,
          studentContext: {
            email: currentStudent?.email,
            name: currentStudent?.name,
            hasSubmitted: Boolean(existingApplication),
            currentApplication: existingApplication
              ? {
                  jobTitle: existingApplication.jobTitle,
                  status: existingApplication.status,
                  skillScore: existingApplication.skillScore,
                  aiReasoning: existingApplication.aiReasoning,
                  payout: existingApplication.payout,
                }
              : null,
            clientView: currentView,
          },
        }),
      });

      const data = await res.json();
      if (data.success && data.reply) {
        if (data.liveStatus) {
          setLiveStatus(data.liveStatus);
        }

        const botMessage: ChatMessage = {
          id: `model-${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedActions: data.suggestedActions || [
            '🚀 Walk me through how to apply',
            '💼 Which jobs have open slots?',
            '📄 Do I need a resume?',
          ],
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        const errorMsg: ChatMessage = {
          id: `model-${Date.now()}`,
          role: 'model',
          text: data.reply || "I'm having a slight connection blip, but our 19 campus jobs are listed right here in the directory!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      console.error('Failed to chat with Arsh:', err);
      const offlineMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: `I'm **Arsh**, your FiLi guide! You can easily apply by signing in with your school Google account, picking one of our 19 campus jobs, and filling out your Grade & Section. Resumes are completely optional—you will never be disqualified!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, offlineMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalkthroughAction = (actionType: string) => {
    if (actionType === 'form' && onNavigateToForm) {
      onNavigateToForm();
      if (window.innerWidth < 768) setIsOpen(false);
    } else if (actionType === 'directory' && onNavigateToDirectory) {
      onNavigateToDirectory();
      if (window.innerWidth < 768) setIsOpen(false);
    } else if (actionType === 'access' && onNavigateToAccess) {
      onNavigateToAccess();
      if (window.innerWidth < 768) setIsOpen(false);
    } else if (actionType === 'faq') {
      handleSendMessage('Explain how the AI screening and the no-disqualification resume rule work');
    }
  };

  const handleResetChat = () => {
    const freshWelcome: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'model',
      text: `Chat reset! I'm **Arsh**, ready with the latest live FiLi data. What would you like to explore?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: [
        '🚀 Walk me through how to apply (Step-by-step)',
        '💼 Which jobs have open slots right now?',
        '📄 Do I need a resume to get placed?',
      ],
    };
    setMessages([freshWelcome]);
  };

  // Helper to render bold markdown and lists nicely
  const formatMessageText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Bold syntax **text**
      const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      if (line.startsWith('• ') || line.startsWith('- ')) {
        return (
          <li
            key={idx}
            className="ml-4 list-disc text-slate-800 leading-relaxed text-xs sm:text-sm my-0.5"
            dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^[•-]\s*/, '') }}
          />
        );
      }
      if (/^\d+\.\s/.test(line)) {
        return (
          <li
            key={idx}
            className="ml-4 list-decimal text-slate-800 font-medium leading-relaxed text-xs sm:text-sm my-1"
            dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^\d+\.\s*/, '') }}
          />
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }
      return (
        <p
          key={idx}
          className="text-slate-800 text-xs sm:text-sm leading-relaxed my-0.5"
          dangerouslySetInnerHTML={{ __html: formattedLine }}
        />
      );
    });
  };

  const currentStep = WALKTHROUGH_STEPS[currentStepIndex];

  return (
    <>
      {/* 1. Floating Launch Button (FiLi Bot) */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 group">
          {/* Friendly prompt bubble */}
          <div className="hidden md:flex items-center bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-lg border border-indigo-100 text-xs text-slate-700 animate-bounce duration-1000">
            <span className="font-semibold text-indigo-700 mr-1.5">Need help?</span>
            <span>Ask Arsh anything!</span>
          </div>

          <button
            type="button"
            id="fili-bot-floating-btn"
            onClick={() => setIsOpen(true)}
            className="relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white font-bold text-sm rounded-full shadow-xl hover:shadow-indigo-500/25 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-indigo-400/40"
            title="Click to talk with Arsh (FiLi Bot)"
          >
            {/* Pulsing ring indicator */}
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
            </span>

            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Bot className="w-4 h-4 text-white" />
            </div>

            <div className="flex flex-col text-left pr-1">
              <span className="leading-tight font-extrabold text-sm tracking-tight text-white flex items-center gap-1">
                FiLi Bot
                <Sparkles className="w-3 h-3 text-amber-300" />
              </span>
              <span className="text-[10px] text-indigo-200 font-medium leading-none">
                Meet Arsh
              </span>
            </div>
          </button>
        </div>
      )}

      {/* 2. Chatbot Window Modal / Drawer */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 ${
            isExpanded
              ? 'inset-3 sm:inset-6 max-w-4xl max-h-[92vh] mx-auto'
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[85vh] h-[640px]'
          } flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-200`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-inner font-extrabold text-base border border-indigo-400/30">
                  A
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" title="Arsh is online and synced"></span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-white tracking-tight leading-none">
                    Arsh
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold tracking-wide">
                    FiLi Bot
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-300 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>FiLi Campus AI Guide • Live App Synced</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Restart conversation"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title={isExpanded ? 'Restore size' : 'Expand window'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Real-time Status / Walkthrough Banner Toggle */}
          <div className="bg-indigo-50/90 border-b border-indigo-100 px-3.5 py-2 flex items-center justify-between text-xs text-indigo-950 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-800">
                {liveStatus.openJobsCount} Jobs Open
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 truncate">
                FCFS Active ({liveStatus.remainingSpots} spots total)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowWalkthrough(!showWalkthrough)}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-100/60 px-2.5 py-1 rounded-full border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
            >
              <Compass className="w-3 h-3 text-indigo-600" />
              <span>{showWalkthrough ? 'Hide Steps' : 'Step-by-Step Guide'}</span>
            </button>
          </div>

          {/* Interactive Step-by-Step Walkthrough Drawer (Collapsible) */}
          {showWalkthrough && (
            <div className="bg-gradient-to-b from-indigo-50/90 to-white border-b border-indigo-100 p-4 shrink-0 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-extrabold text-[10px] tracking-wide">
                    STEP {currentStep.step} OF 6
                  </span>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                    {currentStep.title}
                  </h4>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentStepIndex === 0}
                    onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
                    className="p-1 rounded bg-white border border-slate-200 disabled:opacity-30 text-slate-600 hover:text-slate-900 cursor-pointer disabled:cursor-not-allowed"
                    title="Previous step"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={currentStepIndex === WALKTHROUGH_STEPS.length - 1}
                    onClick={() =>
                      setCurrentStepIndex((prev) =>
                        Math.min(WALKTHROUGH_STEPS.length - 1, prev + 1)
                      )
                    }
                    className="p-1 rounded bg-white border border-slate-200 disabled:opacity-30 text-slate-600 hover:text-slate-900 cursor-pointer disabled:cursor-not-allowed"
                    title="Next step"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {currentStep.details}
              </p>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleWalkthroughAction(currentStep.actionType)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>{currentStep.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1">
                  {WALKTHROUGH_STEPS.map((s, idx) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setCurrentStepIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === currentStepIndex
                          ? 'w-5 bg-indigo-600'
                          : idx < currentStepIndex
                          ? 'bg-indigo-300'
                          : 'bg-slate-200'
                      }`}
                      title={`Go to step ${s.step}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
            {messages.map((msg) => {
              const isBot = msg.role === 'model';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} animate-in fade-in duration-200`}
                >
                  <div className="flex items-end gap-2 max-w-[92%] sm:max-w-[85%]">
                    {isBot && (
                      <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mb-1 shadow-2xs">
                        A
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-xs ${
                        isBot
                          ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                          : 'bg-indigo-600 text-white rounded-br-xs font-medium'
                      }`}
                    >
                      {isBot ? (
                        <div className="space-y-1">{formatMessageText(msg.text)}</div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {isBot ? 'Arsh • ' : 'You • '}
                    {msg.timestamp}
                  </span>

                  {/* Suggested action pills attached to bot responses */}
                  {isBot && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[95%]">
                      {msg.suggestedActions.map((action, aIdx) => (
                        <button
                          key={aIdx}
                          type="button"
                          onClick={() => handleSendMessage(action)}
                          className="px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full transition-colors cursor-pointer shadow-2xs"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-end gap-2 max-w-[85%] animate-in fade-in">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  A
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"></span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium ml-1">
                    Arsh is checking portal data...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Shortcuts Bar */}
          <div className="px-3 pt-2 pb-1 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => handleSendMessage('Walk me through the application steps')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Compass className="w-3 h-3 text-indigo-600" />
              <span>How to Apply</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Which jobs currently have open slots?')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Briefcase className="w-3 h-3 text-indigo-600" />
              <span>Open Vacancies</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Do I need a resume or experience?')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <FileText className="w-3 h-3 text-indigo-600" />
              <span>Resume Rules</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Can I apply for multiple jobs?')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <AlertCircle className="w-3 h-3 text-indigo-600" />
              <span>Single-Job Rule</span>
            </button>
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Arsh about jobs, quotas, or how to apply..."
              disabled={isLoading}
              className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-40 transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
              title="Send message to Arsh"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
