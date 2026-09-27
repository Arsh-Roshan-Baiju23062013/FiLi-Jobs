import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { GoogleSignInModal } from './components/GoogleSignInModal';
import { ApplicationForm } from './components/ApplicationForm';
import { SubmissionStatusView } from './components/SubmissionStatusView';
import { AdminSignInModal } from './components/AdminSignInModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AccessPage, isUserAdminEmail } from './components/AccessPage';
import { Footer } from './components/Footer';
import { FiliChatbot } from './components/FiliChatbot';
import { StudentProfile, AdminUser, Application } from './types';
import { testFirestoreConnection, auth, getApplicationByEmailFromFirestore } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function App() {
  // Authentication states
  const [currentStudent, setCurrentStudent] = useState<StudentProfile | null>(null);
  const [existingApplication, setExistingApplication] = useState<Application | null>(null);
  const [checkingExisting, setCheckingExisting] = useState<boolean>(false);

  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  // View state: 'access' (default gateway for both students & admins) or 'directory'
  const [unauthView, setUnauthView] = useState<'access' | 'directory'>('access');
  // Admin view toggle: 'dashboard' or 'directory_preview'
  const [adminViewMode, setAdminViewMode] = useState<'dashboard' | 'directory_preview'>('dashboard');
  // Student view toggle: 'form' or 'directory'
  const [studentViewMode, setStudentViewMode] = useState<'form' | 'directory'>('form');
  const [targetJobId, setTargetJobId] = useState<string | undefined>(undefined);
  const [viewingDirectoryAfterApplying, setViewingDirectoryAfterApplying] = useState(false);

  // Modal visibility states
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  // Test Firestore Connection on boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const email = firebaseUser.email.toLowerCase();
        const name = firebaseUser.displayName || email.split('@')[0] || 'User';
        const avatarUrl =
          firebaseUser.photoURL ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`;

        // If email is recognized as admin email, authenticate admin
        if (isUserAdminEmail(email)) {
          try {
            const adminRes = await fetch('/api/admin/google-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name }),
            });
            const adminData = await adminRes.json();
            if (adminData.success) {
              setAdminUser({
                username: adminData.user.username,
                email: adminData.user.email,
                token: adminData.token,
                role: 'admin',
                isGoogleAdmin: true,
              });
              return;
            }
          } catch (e) {
            console.warn('Firebase onAuthStateChanged admin check note:', e);
          }
        }

        // Student identity set
        setCurrentStudent((prev) => {
          if (prev && prev.email.toLowerCase() === email) {
            return prev;
          }
          return {
            name,
            email,
            avatarUrl,
            isGoogleVerified: true,
          };
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Check if student has already applied whenever currentStudent changes
  useEffect(() => {
    if (!currentStudent) {
      setExistingApplication(null);
      return;
    }

    const checkStudentApplication = async () => {
      setCheckingExisting(true);
      try {
        // Attempt fast direct query to Firestore first
        try {
          const fsApp = await getApplicationByEmailFromFirestore(currentStudent.email);
          if (fsApp) {
            if (fsApp.status === 'Disqualified (No Resume/Unqualified)' || fsApp.resumeValidity === 'invalid') {
              fsApp.status = 'Approved';
              fsApp.resumeValidity = 'valid';
              fsApp.skillScore = Math.max(50, fsApp.skillScore || 55);
              fsApp.aiReasoning = 'Placed into the general First-Come, First-Served (FCFS) slot as an entry-level candidate.';
            }
            setExistingApplication(fsApp);
            setCheckingExisting(false);
            return;
          }
        } catch (fsErr) {
          console.log('[Firebase] Falling back to server application store:', fsErr);
        }

        // Fallback to API endpoint
        const res = await fetch(`/api/applications/check?email=${encodeURIComponent(currentStudent.email)}`);
        const data = await res.json();
        if (data.exists && data.application) {
          const app = data.application;
          if (app.status === 'Disqualified (No Resume/Unqualified)' || app.resumeValidity === 'invalid') {
            app.status = 'Approved';
            app.resumeValidity = 'valid';
            app.skillScore = Math.max(50, app.skillScore || 55);
            app.aiReasoning = 'Placed into the general First-Come, First-Served (FCFS) slot as an entry-level candidate.';
          }
          setExistingApplication(app);
        } else {
          setExistingApplication(null);
        }
      } catch (err) {
        console.error('Error checking existing application:', err);
      } finally {
        setCheckingExisting(false);
      }
    };

    checkStudentApplication();
  }, [currentStudent]);

  // Handlers
  const handleStudentLoginSuccess = (profile: StudentProfile) => {
    setCurrentStudent(profile);
    setStudentViewMode('form');
    setIsGoogleModalOpen(false);
  };

  const handleStudentLogout = () => {
    try {
      signOut(auth);
    } catch {
      // Ignored if not using Firebase Auth
    }
    setCurrentStudent(null);
    setExistingApplication(null);
    setStudentViewMode('form');
    setUnauthView('access');
  };

  const handleAdminLoginSuccess = (admin: AdminUser) => {
    setAdminUser(admin);
    setAdminViewMode('dashboard');
    setIsAdminModalOpen(false);
    setIsGoogleModalOpen(false);
  };

  const handleAdminLogout = () => {
    try {
      signOut(auth);
    } catch {}
    setAdminUser(null);
    setAdminViewMode('dashboard');
    setUnauthView('access');
  };

  const handleApplicationSubmitted = (newApp: Application) => {
    setExistingApplication(newApp);
    setViewingDirectoryAfterApplying(false);
  };

  const handleResign = async (app: Application) => {
    try {
      const res = await fetch(`/api/applications/${app.id}/resign`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.application) {
        setExistingApplication(data.application);
      }
    } catch (e) {
      console.error('Failed to resign', e);
    }
  };

  const handleReapply = () => {
    setExistingApplication(null);
    setStudentViewMode('form');
    setViewingDirectoryAfterApplying(false);
  };

  const handleStartApplication = (jobId?: string) => {
    if (jobId) {
      setTargetJobId(jobId);
    }
    setStudentViewMode('form');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/60 font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Universal Header */}
      <Header
        currentStudent={currentStudent}
        adminUser={adminUser}
        onStudentLogout={handleStudentLogout}
        onAdminLogout={handleAdminLogout}
        onOpenAdminLogin={() => {
          if (!currentStudent && !adminUser) {
            setUnauthView('access');
          } else {
            setIsAdminModalOpen(true);
          }
        }}
        onOpenAccessPage={() => setUnauthView('access')}
        onOpenChatbot={() => setIsChatbotOpen(true)}
        currentView={adminUser ? (adminViewMode === 'dashboard' ? 'admin' : 'student_preview') : undefined}
        onToggleView={
          adminUser
            ? () =>
                setAdminViewMode((prev) =>
                  prev === 'dashboard' ? 'directory_preview' : 'dashboard'
                )
            : undefined
        }
        onGoHome={() => {
          if (adminUser) {
            setAdminViewMode('dashboard');
          } else if (currentStudent) {
            setStudentViewMode('directory');
          } else {
            setUnauthView('access');
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {adminUser ? (
          /* SECTION: Admin Session */
          adminViewMode === 'dashboard' ? (
            <AdminDashboard onLogout={handleAdminLogout} />
          ) : (
            <LandingPage
              onOpenGoogleSignIn={() => {}}
              onOpenAdminSignIn={() => setAdminViewMode('dashboard')}
              adminUser={adminUser}
              onReturnToAdmin={() => setAdminViewMode('dashboard')}
            />
          )
        ) : currentStudent ? (
          /* SECTION: Authenticated Student Portal */
          checkingExisting ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-500 font-medium">
                Checking existing submission records for {currentStudent.email}...
              </p>
            </div>
          ) : existingApplication && !viewingDirectoryAfterApplying ? (
            /* Strict one-submission-per-account rule: status view */
            <SubmissionStatusView
              application={existingApplication}
              currentStudent={currentStudent}
              onStudentLogout={handleStudentLogout}
              onBackToJobs={() => setViewingDirectoryAfterApplying(true)}
              onResign={handleResign}
              onReapply={handleReapply}
            />
          ) : studentViewMode === 'directory' || viewingDirectoryAfterApplying ? (
            /* Student browsing positions before applying or after returning from status view */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Signed in as:</span>
                  <span className="text-xs font-semibold text-indigo-600 font-mono">
                    {currentStudent.email}
                  </span>
                </div>
                {viewingDirectoryAfterApplying ? (
                  <button
                    type="button"
                    onClick={() => setViewingDirectoryAfterApplying(false)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                  >
                    View Application Status
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStudentViewMode('form')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                  >
                    Proceed to Application Form
                  </button>
                )}
              </div>
              <LandingPage
                currentStudent={currentStudent}
                onOpenGoogleSignIn={() => setStudentViewMode('form')}
                onOpenAdminSignIn={() => setIsAdminModalOpen(true)}
                onStartApplication={
                  // If they have an existing non-resigned application, they cannot apply for a new one
                  existingApplication && existingApplication.status !== 'Resigned'
                    ? undefined
                    : handleStartApplication
                }
              />
            </div>
          ) : (
            /* Application Form with Read-Only Google identity */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStudentViewMode('directory')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  ← Browse All Job Roles & Slot Status
                </button>
              </div>

              <ApplicationForm
                currentStudent={currentStudent}
                initialJobId={targetJobId}
                onSubmitted={handleApplicationSubmitted}
                onCancel={() => setStudentViewMode('directory')}
              />
            </div>
          )
        ) : (
          /* SECTION: Unauthenticated Gateway (Access Page or Directory Preview) */
          unauthView === 'access' ? (
            <div className="space-y-6">
              <AccessPage
                onStudentLoginSuccess={handleStudentLoginSuccess}
                onAdminLoginSuccess={handleAdminLoginSuccess}
              />
              <div className="text-center pt-2">
                <button
                  type="button"
                  id="btn-preview-job-directory"
                  onClick={() => setUnauthView('directory')}
                  className="text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors underline cursor-pointer"
                >
                  View Job Directory & Capacity Quota Preview (Read-Only) →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="text-xs text-indigo-900">
                  <span className="font-bold block sm:inline">Mandatory Access Notice:</span>{' '}
                  Students must authenticate with their Google account to submit applications. Admins use the same gateway.
                </div>
                <button
                  type="button"
                  onClick={() => setUnauthView('access')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs shrink-0 cursor-pointer"
                >
                  Go to Access Page
                </button>
              </div>

              <LandingPage
                onOpenGoogleSignIn={() => setUnauthView('access')}
                onOpenAdminSignIn={() => setUnauthView('access')}
              />
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <Footer
        onOpenAdminLogin={() => {
          if (!currentStudent && !adminUser) {
            setUnauthView('access');
          } else {
            setIsAdminModalOpen(true);
          }
        }}
        isAdminLoggedIn={!!adminUser}
      />

      {/* Google Sign-in Modal (for quick popup if needed) */}
      <GoogleSignInModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSuccess={handleStudentLoginSuccess}
        onAdminSuccess={handleAdminLoginSuccess}
      />

      {/* Admin Sign-in Modal */}
      <AdminSignInModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {/* FiLi Bot (Arsh) - Campus Placement & Application AI Guide */}
      <FiliChatbot
        currentStudent={currentStudent}
        existingApplication={existingApplication}
        currentView={adminUser ? 'admin' : currentStudent ? (existingApplication ? 'status' : studentViewMode) : unauthView}
        isOpenExternal={isChatbotOpen}
        onOpenExternal={() => setIsChatbotOpen(true)}
        onCloseExternal={() => setIsChatbotOpen(false)}
        onNavigateToForm={() => {
          if (currentStudent) {
            setStudentViewMode('form');
            setViewingDirectoryAfterApplying(false);
          } else {
            setUnauthView('access');
          }
        }}
        onNavigateToDirectory={() => {
          if (currentStudent) {
            setStudentViewMode('directory');
            setViewingDirectoryAfterApplying(true);
          } else {
            setUnauthView('directory');
          }
        }}
        onNavigateToAccess={() => {
          setUnauthView('access');
        }}
      />
    </div>
  );
}
