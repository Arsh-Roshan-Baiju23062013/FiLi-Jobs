import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileCheck,
  ShieldCheck,
  Sparkles,
  Printer,
  Download,
  LogOut,
  Calendar,
  Hash,
  Coins,
  School,
  FileText,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { Application, StudentProfile } from '../types';
import { printAndDownloadPlacementReceipt, generatePlacementReceiptPdf } from '../utils/receiptPdf';

interface SubmissionStatusViewProps {
  application: Application;
  currentStudent: StudentProfile;
  onStudentLogout: () => void;
  onBackToJobs?: () => void;
  onResign?: (app: Application) => void;
  onReapply?: () => void;
}

export const SubmissionStatusView: React.FC<SubmissionStatusViewProps> = ({
  application,
  currentStudent,
  onStudentLogout,
  onBackToJobs,
  onResign,
  onReapply,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [isResigning, setIsResigning] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  const isApproved = application.status === 'Approved';
  const isWaitlisted = application.status === 'Waitlisted';
  const isDisplaced = application.status === 'Kicked Out (Displaced by Certified Candidate)';
  const isDisqualified = application.status === 'Disqualified (No Resume/Unqualified)';
  const isFired = application.status === 'Terminated (Fired by Admin)';
  const isResigned = application.status === 'Resigned';

  const handlePrintReceipt = () => {
    setIsPrinting(true);
    setDownloadSuccessMessage(null);
    try {
      const result = printAndDownloadPlacementReceipt(application);
      setDownloadSuccessMessage(`Official PDF created & print dialog requested (${result.fileName})`);
    } catch (err) {
      console.error('Error printing/downloading PDF receipt:', err);
      window.print();
    } finally {
      setTimeout(() => {
        setIsPrinting(false);
      }, 1200);
    }
  };

  const handleDownloadOnlyPdf = () => {
    setIsPrinting(true);
    setDownloadSuccessMessage(null);
    try {
      const doc = generatePlacementReceiptPdf(application);
      const displayNameFile = application.accountOwner === 'parent' && application.actualStudentName 
        ? application.actualStudentName 
        : application.studentName;
      const cleanStudentName = displayNameFile.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `FiLi_Placement_Receipt_${cleanStudentName}_${application.id.slice(0, 8)}.pdf`;
      doc.save(fileName);
      setDownloadSuccessMessage(`PDF file downloaded directly: ${fileName}`);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    } finally {
      setTimeout(() => {
        setIsPrinting(false);
      }, 800);
    }
  };

  // Format high precision date
  const dateObj = new Date(application.submissionTimestamp);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Account Rule Notice */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-700 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-indigo-900 block">
              Strict One-Submission-Per-Account Enforced
            </span>
            <span className="text-indigo-700">
              Verified Google identity <strong className="font-mono">{application.studentEmail}</strong> has registered an application. Form entry is locked.
            </span>
          </div>
        </div>

        <button
          onClick={onStudentLogout}
          className="text-xs font-semibold text-indigo-800 hover:text-red-700 hover:bg-white px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Switch Account</span>
        </button>
      </div>

      {/* Main Status Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Status Header Banner */}
        <div
          className={`p-6 sm:p-8 text-white ${
            isApproved
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
              : isResigned
              ? 'bg-gradient-to-r from-slate-700 via-slate-800 to-indigo-950'
              : isFired
              ? 'bg-gradient-to-r from-red-600 via-rose-700 to-slate-900'
              : isDisplaced
              ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-rose-700'
              : isWaitlisted
              ? 'bg-gradient-to-r from-amber-600 to-orange-700'
              : 'bg-gradient-to-r from-rose-600 to-red-800'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
                {isApproved ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {application.displacedCandidateName
                      ? 'Status: Approved (Displaced Uncertified Slot)'
                      : application.hasCertificates
                      ? 'Status: Approved (Certified Priority)'
                      : 'Status: Approved (Provisional Entry)'}
                  </>
                ) : isResigned ? (
                  <>
                    <LogOut className="w-3.5 h-3.5 text-slate-300" /> Official Status: Voluntarily Resigned
                  </>
                ) : isFired ? (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-rose-300" /> Official Status: Terminated (Fired by Administration)
                  </>
                ) : isDisplaced ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> Official Status: Kicked Out of Slot (Preempted by Certified Candidate)
                  </>
                ) : isWaitlisted ? (
                  <>
                    <Clock className="w-3.5 h-3.5" /> Official Status: Waitlisted
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" /> Official Status: Disqualified (Missing/Corrupt Resume)
                  </>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {isApproved
                  ? application.displacedCandidateName
                    ? 'Placement Confirmed via Certificate Preemption'
                    : 'Congratulations! Placement Confirmed.'
                  : isResigned
                  ? 'Placement Voluntary Resignation'
                  : isFired
                  ? 'Employment Terminated by Administration'
                  : isDisplaced
                  ? 'Slot Reassigned: Displaced by Certified Candidate'
                  : isWaitlisted
                  ? 'Application Placed on FCFS Waitlist'
                  : 'Application Disqualified by AI Screening'}
              </h2>
              <p className="text-xs sm:text-sm text-white/90 max-w-xl">
                {isApproved
                  ? application.displacedCandidateName
                    ? `You were awarded this role with certified credentials, displacing previous uncertified student (${application.displacedCandidateName}) under FiLi preemption rules.`
                    : `You have been allocated to the ${application.jobTitle} cohort. Review your monthly BRAED credit details below.`
                  : isResigned
                  ? `You have voluntarily stepped down from your role as ${application.jobTitle}. Your slot has been returned to the cohort pool, and you are eligible to submit a new application.`
                  : isFired
                  ? `Your position for ${application.jobTitle} was terminated by school administration (Reason: ${application.firedReason || 'Administrative decision'}). Under FiLi policy, as a student who got fired, you are now authorized to submit a new application for an open position.`
                  : isDisplaced
                  ? `You were provisionally taken into this slot first. However, a candidate with verified certificates (${application.displacedByCandidateName || 'incoming certified candidate'}) qualified for the role, bumping you to the reserve waitlist.`
                  : isWaitlisted
                  ? 'Due to class quota or position capacity, your application is currently queued in strict FCFS order.'
                  : 'Your application failed the automated screening criteria. Please review the AI reasoning below.'}
              </p>
            </div>

            <div className="hidden sm:block text-right text-xs text-white/80 font-mono">
              <span>App ID:</span>
              <div className="font-bold text-sm text-white">{application.id}</div>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Key Facts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Candidate
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900">
                  {application.accountOwner === 'parent' && application.actualStudentName ? application.actualStudentName : application.studentName}
                </span>
                {application.accountOwner === 'parent' && (
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                    via Parent
                  </span>
                )}
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-xs text-slate-500 font-mono truncate block mt-0.5">
                {application.studentClass} • {application.section}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Assigned Position
              </span>
              <span className="text-sm font-bold text-slate-900 block leading-tight">
                {application.jobTitle}
              </span>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block mt-1">
                {application.payout}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                FCFS Timestamp
              </span>
              <span className="text-xs font-mono font-bold text-slate-900 block">
                {formattedDate}
              </span>
              <span className="text-[11px] font-mono text-slate-500 block">
                {formattedTime}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                AI Skill Score
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-2xl font-black ${
                    application.skillScore >= 75
                      ? 'text-emerald-600'
                      : application.skillScore >= 40
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                >
                  {application.skillScore}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 100</span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                {application.resumeValidity === 'valid' ? 'Valid PDF verified' : 'Invalid / Missing resume'}
              </span>
            </div>
          </div>

          {/* Explicit AI Reasoning Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Automated Gemini Screening Reasoning & Audit
              </h3>
            </div>

            <div
              className={`p-4 rounded-xl border text-xs sm:text-sm font-medium leading-relaxed ${
                isApproved
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : isDisplaced
                  ? 'bg-orange-50/80 border-orange-300 text-orange-950'
                  : isWaitlisted
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-red-50/70 border-red-200 text-red-950'
              }`}
            >
              {application.aiReasoning}
            </div>

            {application.hasCertificates && application.certificateNames && application.certificateNames.length > 0 && (
              <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-purple-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                  Verified Certificates & Accreditations:
                </span>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {application.certificateNames.map((cert, i) => (
                    <span key={i} className="bg-white border border-purple-300 text-purple-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                      ★ {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {application.aiAnalysis && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                {application.aiAnalysis.verifiedSkills?.length > 0 && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                      Verified Skills Identified in PDF:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {application.aiAnalysis.verifiedSkills.map((s, i) => (
                        <span
                          key={i}
                          className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] px-2 py-0.5 rounded"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {application.aiAnalysis.pastTwoYearsExperience && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                      2-Year Experience Check:
                    </span>
                    <p className="text-slate-700 leading-normal">
                      {application.aiAnalysis.pastTwoYearsExperience}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Attached Document info */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-slate-600" />
              <div>
                <span className="font-bold text-slate-800">
                  {application.resumeFileName || 'No resume file attached'}
                </span>
                {application.resumeFileSize ? (
                  <span className="text-slate-500 ml-2 font-mono">
                    ({(application.resumeFileSize / 1024).toFixed(1)} KB)
                  </span>
                ) : null}
              </div>
            </div>

            <span
              className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                application.resumeValidity === 'valid'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {application.resumeValidity === 'valid' ? 'Valid Document' : 'General FCFS Entry'}
            </span>
          </div>

          {/* Action Row */}
          <div className="pt-2 space-y-3 border-t border-slate-100">
            {/* Single-job policy banner or fired re-apply notice */}
            {(isApproved || isWaitlisted) && (
              <div className="w-full p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs flex items-center gap-2.5 text-blue-900">
                <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Single-Job Rule Enforced:</strong> You are currently {isApproved ? 'placed in' : 'taken in for'} <strong>{application.jobTitle}</strong>. Under FiLi Middle School policy, a student can be in only one job. Multi-jobs are strictly prohibited. Application submission is only unlocked if a student is terminated/fired by administration.
                </span>
              </div>
            )}

            {(isFired || isResigned) && (
              <div className="w-full p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs flex items-center justify-between gap-3 text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Eligibility Active:</strong> {isResigned ? 'You have resigned from your position and can now apply for an open job.' : `Since you were terminated/fired from ${application.jobTitle}, you are authorized to submit a new application for any open position.`}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Submit new application for students who got fired or resigned */}
                {(isFired || isResigned) && onReapply && (
                  <button
                    id="btn-reapply-fired-student"
                    type="button"
                    onClick={onReapply}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Submit New Application</span>
                  </button>
                )}

                {/* Primary Print Button */}
                <button
                  id="btn-print-receipt"
                  type="button"
                  onClick={handlePrintReceipt}
                  disabled={isPrinting}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  {isPrinting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Preparing PDF Receipt...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Official Placement Receipt</span>
                      <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded font-mono uppercase">
                        PDF
                      </span>
                    </>
                  )}
                </button>

                {/* Download PDF File Button */}
                <button
                  id="btn-download-receipt-pdf"
                  type="button"
                  onClick={handleDownloadOnlyPdf}
                  disabled={isPrinting}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Download PDF File</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onStudentLogout}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>

                {onBackToJobs && (
                  <button
                    type="button"
                    onClick={onBackToJobs}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <School className="w-3.5 h-3.5 text-indigo-700" />
                    <span>View All Jobs</span>
                  </button>
                )}

                {/* Non-blocking Resign button using inline confirmation */}
                {onResign && (application.status === 'Approved' || application.status === 'Waitlisted') && (
                  !showResignConfirm ? (
                    <button
                      id="btn-initiate-resign"
                      type="button"
                      onClick={() => setShowResignConfirm(true)}
                      disabled={isResigning}
                      className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Resign</span>
                    </button>
                  ) : (
                    <div className="w-full sm:w-auto flex items-center gap-1.5 bg-rose-50 border border-rose-300 p-1 rounded-xl text-xs">
                      <span className="font-bold text-rose-900 px-2 text-[11px]">Confirm resignation?</span>
                      <button
                        id="btn-confirm-resign"
                        type="button"
                        onClick={async () => {
                          setIsResigning(true);
                          await onResign(application);
                          setIsResigning(false);
                          setShowResignConfirm(false);
                        }}
                        disabled={isResigning}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {isResigning ? 'Resigning...' : 'Yes, Resign'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResignConfirm(false)}
                        className="px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition-colors border border-slate-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {downloadSuccessMessage && (
            <div className="mt-2 text-center text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{downloadSuccessMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
