import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Application, SlotSettings } from '../types';

// Initialize Firebase App singleton
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

// Analytics stub (disabled in iframe/sandbox environments to avoid network fetch failures)
export const analytics = null;

// Connection test as mandated by the Firebase skill
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'slotSettings', 'global'));
    console.log('[Firebase] Successfully connected to Firestore. Exists:', snap.exists());
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Firestore client is offline or network unreachable.');
    } else {
      console.log('[Firebase] Firestore endpoint reached:', error?.code || error?.message);
    }
    return false;
  }
}

// Error handling enum and structured logger
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.warn('[Firebase Firestore Info]:', JSON.stringify(errInfo, null, 2));
}

// --- Firestore Sync Services for FiLi Job Portal ---

/**
 * Persist or sync an Application directly into Firestore
 */
export async function saveApplicationToFirestore(appData: Application): Promise<void> {
  const docPath = `applications/${appData.id}`;
  try {
    const docRef = doc(db, 'applications', appData.id);
    // Sanitize data (remove undefined properties for Firestore compliance)
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(appData)) {
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }
    await setDoc(docRef, sanitized, { merge: true });
    console.log(`[Firebase] Application ${appData.id} saved to Firestore successfully.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Query application by student email from Firestore
 */
export async function getApplicationByEmailFromFirestore(email: string): Promise<Application | null> {
  const targetEmail = email.trim().toLowerCase();
  const collectionPath = 'applications';
  try {
    const q = query(
      collection(db, collectionPath), 
      where('studentEmail', '==', targetEmail),
      orderBy('submissionTimestampMs', 'desc'),
      limit(1)
    );
    
    // Timeout for ultra-fast fallback if Firestore is offline
    const snapshot = await Promise.race([
      getDocs(q),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Firestore query timeout')), 1500))
    ]);

    if (snapshot && !snapshot.empty) {
      return snapshot.docs[0].data() as Application;
    }
    return null;
  } catch (error: any) {
    if (error?.message === 'Firestore query timeout' || String(error).includes('Firestore query timeout')) {
      console.warn('[Firebase] Firestore query timed out, falling back to local store silently.');
      return null;
    }
    handleFirestoreError(error, OperationType.LIST, collectionPath);
    return null;
  }
}

/**
 * Real-time listener for Slot Settings
 */
export function subscribeToSlotSettings(
  onUpdate: (settings: SlotSettings) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const docRef = doc(db, 'slotSettings', 'global');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as SlotSettings);
      }
    },
    (error) => {
      console.warn('[Firebase] Slot settings snapshot note (using API state):', error?.message || error);
      if (onError) onError(error);
    }
  );
}

/**
 * Update Slot Settings in Firestore
 */
export async function updateSlotSettingsInFirestore(settings: SlotSettings): Promise<void> {
  const docPath = 'slotSettings/global';
  try {
    const docRef = doc(db, 'slotSettings', 'global');
    // Sanitize undefined
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }
    sanitized.lastUpdated = new Date().toISOString();
    await setDoc(docRef, sanitized, { merge: true });
    console.log('[Firebase] Slot settings updated in Firestore.');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Real-time listener for all applications (for Admin Roster)
 */
export function subscribeToApplications(
  onUpdate: (apps: Application[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const collectionPath = 'applications';
  const colRef = collection(db, collectionPath);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Application[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as Application);
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    },
    (error) => {
      console.warn('[Firebase] Applications snapshot note (using API state):', error?.message || error);
      if (onError) onError(error);
    }
  );
}

/**
 * Update application status (Admin action)
 */
export async function updateApplicationStatusInFirestore(
  appId: string,
  newStatus: Application['status'],
  notes?: string
): Promise<void> {
  const docPath = `applications/${appId}`;
  try {
    const docRef = doc(db, 'applications', appId);
    const payload: Record<string, any> = {
      status: newStatus,
    };
    if (notes !== undefined) {
      payload.adminNotes = notes;
    }
    await updateDoc(docRef, payload);
    console.log(`[Firebase] Application ${appId} status updated to ${newStatus}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

/**
 * Bulk fire/terminate placed students (Admin action)
 */
export async function fireAllStudentsInFirestore(
  appIds: string[],
  reason: string
): Promise<void> {
  if (appIds.length === 0) return;
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    appIds.forEach((id) => {
      const docRef = doc(db, 'applications', id);
      batch.update(docRef, {
        status: 'Terminated (Fired by Admin)',
        firedAt: now,
        firedReason: reason,
        adminNotes: reason,
      });
    });
    await batch.commit();
    console.log(`[Firebase] Batch updated ${appIds.length} applications in Firestore to Terminated`);
  } catch (error) {
    console.warn('[Firebase] Batch fire note:', error);
  }
}

/**
 * Bulk sync local applications to Firestore to ensure cloud persistence
 */
export async function syncLocalApplicationsToFirestore(apps: Application[]): Promise<number> {
  if (!apps || apps.length === 0) return 0;
  let count = 0;
  try {
    const batch = writeBatch(db);
    // Write up to 500 docs per Firestore batch limit
    const slice = apps.slice(0, 500);
    slice.forEach((app) => {
      const docRef = doc(db, 'applications', app.id);
      const sanitized: Record<string, any> = {};
      for (const [k, v] of Object.entries(app)) {
        if (v !== undefined) sanitized[k] = v;
      }
      batch.set(docRef, sanitized, { merge: true });
      count++;
    });
    await batch.commit();
    console.log(`[Firebase] Synchronized ${count} applications to Firestore.`);
    return count;
  } catch (error) {
    console.warn('[Firebase] Sync applications to Firestore note:', error);
    return count;
  }
}

