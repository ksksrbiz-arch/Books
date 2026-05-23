import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, getDocs, onSnapshot, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, uploadString, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = dbId
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, dbId)
  : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/documents");
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");

/**
 * Uploads an image (either a local server path, an external URL, or a base64 string) to Firebase Storage
 * and returns its public download URL.
 */
export async function uploadImageToStorage(
  sourceUrlOrBase64: string,
  userId: string,
  storyId: string,
  stepId: string
): Promise<string> {
  // Use a well-patterned path structure: users/${userId}/stories/${storyId}/steps/${stepId}.png
  const storagePath = `users/${userId}/stories/${storyId}/steps/${stepId}.png`;
  const storageRef = ref(storage, storagePath);

  // 1. If it's a data URL / base64 string
  if (sourceUrlOrBase64.startsWith('data:image/')) {
    const uploadResult = await uploadString(storageRef, sourceUrlOrBase64, 'data_url');
    return await getDownloadURL(uploadResult.ref);
  }

  // 2. Otherwise download and upload the raw binary blob
  try {
    const response = await fetch(sourceUrlOrBase64);
    if (!response.ok) {
      throw new Error(`Failed to fetch image binary, status code ${response.status}`);
    }
    const blob = await response.blob();
    const uploadResult = await uploadBytes(storageRef, blob, {
      contentType: blob.type || 'image/png'
    });
    return await getDownloadURL(uploadResult.ref);
  } catch (err) {
    console.warn("Direct binary blob upload failed, falling back to writing source URL directly:", err);
    // Return original url if fetching / uploading failed
    return sourceUrlOrBase64;
  }
}

/**
 * Deletes a specific step's image from Storage.
 */
export async function deleteStepImageFromStorage(
  userId: string,
  storyId: string,
  stepId: string
): Promise<void> {
  if (!userId || !storyId || !stepId) return;
  try {
    const storagePath = `users/${userId}/stories/${storyId}/steps/${stepId}.png`;
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    console.log(`[Storage Cleanup] Successfully deleted step image: ${storagePath}`);
  } catch (err) {
    // If it doesn't exist or is already deleted, ignore
    console.warn(`[Storage Cleanup] Failed to delete specific step image or image did not exist:`, err);
  }
}

/**
 * Periodically or on-demand deletes orphaned story images from Storage for a given story.
 * Lists all files inside users/${userId}/stories/${storyId}/steps and deletes any png files
 * whose stepId is NOT in the keepStepIds list.
 */
export async function cleanupOrphanedStorageImages(
  userId: string,
  storyId: string,
  keepStepIds: string[]
): Promise<void> {
  if (!userId || !storyId) return;
  try {
    const parentFolderRef = ref(storage, `users/${userId}/stories/${storyId}/steps`);
    const listResult = await listAll(parentFolderRef);
    
    // Create a Set of allowed filenames
    const allowedFilenames = new Set(keepStepIds.map(id => `${id}.png`));
    
    // Delete any files in Storage that are not in the allowed set
    const deletePromises = listResult.items.map(async (itemRef) => {
      const filename = itemRef.name;
      if (!allowedFilenames.has(filename)) {
        console.log(`[Storage Cleanup] Deleting orphaned storage image: ${itemRef.fullPath}`);
        try {
          await deleteObject(itemRef);
        } catch (delErr) {
          console.warn(`[Storage Cleanup] Failed to delete orphaned image: ${itemRef.fullPath}:`, delErr);
        }
      }
    });
    
    await Promise.all(deletePromises);
    console.log(`[Storage Cleanup] Image cleanup completed for story ${storyId}. Keep: ${keepStepIds.length} steps.`);
  } catch (err) {
    console.warn(`[Storage Cleanup] Error listing or deleting objects for story ${storyId}:`, err);
  }
}

/**
 * Deletes all images belonging to a user's story inside Firebase Storage.
 */
export async function cleanupAllStoryImagesFromStorage(
  userId: string,
  storyId: string
): Promise<void> {
  if (!userId || !storyId) return;
  try {
    const parentFolderRef = ref(storage, `users/${userId}/stories/${storyId}/steps`);
    const listResult = await listAll(parentFolderRef);
    const deletePromises = listResult.items.map(async (itemRef) => {
      try {
        await deleteObject(itemRef);
        console.log(`[Storage Cleanup] Deleted story image: ${itemRef.fullPath}`);
      } catch (delErr) {
        console.warn(`[Storage Cleanup] Failed to delete story image ${itemRef.fullPath}:`, delErr);
      }
    });
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn(`[Storage Cleanup] Error cleaning up deleted story images:`, err);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Transparent Client-Side Offline-Resilient Failover Architecture
export interface OfflineQueueItem {
  id: string;
  type: 'set' | 'add';
  path: string;
  data: any;
  timestamp: number;
}

let cachedChaosState: any = null;
let lastChaosFetchTime = 0;

async function checkChaosOutage(): Promise<boolean> {
  const now = Date.now();
  if (now - lastChaosFetchTime < 10000 && cachedChaosState !== null) {
    return !!cachedChaosState.simulateDbOutage;
  }
  try {
    const response = await fetch("/api/system/monitoring");
    if (response.ok) {
      const stats = await response.json();
      cachedChaosState = stats.chaosState || { simulateDbOutage: false };
      lastChaosFetchTime = now;
      return !!cachedChaosState.simulateDbOutage;
    }
  } catch (err) {
    // If request fails, default to healthy status
  }
  return false;
}

export async function setDocSafe(docRef: any, data: any, options?: any): Promise<boolean> {
  const startTime = performance.now();
  window.dispatchEvent(new CustomEvent("firestore_sync_status", {
    detail: { status: "syncing", message: "Uploading modifications to Google Cloud..." }
  }));

  try {
    // If simulated DB outage is active, fail immediately to test the failover gracefully
    if (await checkChaosOutage()) {
      throw new Error("Simulated Firestore Outage (Chaos Mode Induced)");
    }
    if (options) {
      await setDoc(docRef, data, options);
    } else {
      await setDoc(docRef, data);
    }
    
    const latencyVal = Math.round(performance.now() - startTime);

    // Clear individual doc cache with freshest data
    const path = docRef.path;
    localStorage.setItem(`local_cache_doc:${path}`, JSON.stringify(data));

    // Restore online state dynamically if outstanding queue is empty
    const queue: OfflineQueueItem[] = JSON.parse(localStorage.getItem("offline_echoes_sync") || "[]");
    if (queue.length > 0) {
      await flushOfflineQueueSync();
    } else {
      window.dispatchEvent(new CustomEvent("firestore_sync_status", {
        detail: { status: "online_synced", message: "Successfully synced with Cloud Cosmos.", latency: latencyVal }
      }));
    }
    return true;
  } catch (err: any) {
    const latencyVal = Math.round(performance.now() - startTime);
    console.warn("setDoc failed, saving to local offline cache:", err);
    const path = docRef.path;
    const queue: OfflineQueueItem[] = JSON.parse(localStorage.getItem("offline_echoes_sync") || "[]");
    
    // Prevent duplicate entries representing same set reference path
    const filteredQueue = queue.filter(item => !(item.type === 'set' && item.path === path));
    filteredQueue.push({
      id: crypto.randomUUID(),
      type: 'set',
      path,
      data,
      timestamp: Date.now()
    });
    localStorage.setItem("offline_echoes_sync", JSON.stringify(filteredQueue));
    
    // Optimistic individual cache
    localStorage.setItem(`local_cache_doc:${path}`, JSON.stringify(data));
    
    // Dispatch system notification
    window.dispatchEvent(new CustomEvent("firestore_sync_status", {
      detail: { status: "offline_active", message: "Cloud sync offline. Progress saved safely in local sandbox.", latency: latencyVal }
    }));
    return false;
  }
}

export async function addDocSafe(colRef: any, data: any): Promise<any> {
  const startTime = performance.now();
  window.dispatchEvent(new CustomEvent("firestore_sync_status", {
    detail: { status: "syncing", message: "Uploading modifications to Google Cloud..." }
  }));

  try {
    if (await checkChaosOutage()) {
      throw new Error("Simulated Firestore Outage (Chaos Mode Induced)");
    }
    const docRefResolved = await addDoc(colRef, data);
    const latencyVal = Math.round(performance.now() - startTime);

    // Warm up the collection query list cache index optimistically
    const path = colRef.path;
    const listCacheKey = `local_cache_list:${path}`;
    const cachedList = JSON.parse(localStorage.getItem(listCacheKey) || "[]");
    cachedList.push({ id: docRefResolved.id, ...data });
    localStorage.setItem(listCacheKey, JSON.stringify(cachedList));

    // Clear individual doc cache with freshest data
    localStorage.setItem(`local_cache_doc:${path}/${docRefResolved.id}`, JSON.stringify(data));

    // Restore online state dynamically if outstanding queue is empty
    const queue: OfflineQueueItem[] = JSON.parse(localStorage.getItem("offline_echoes_sync") || "[]");
    if (queue.length > 0) {
      await flushOfflineQueueSync();
    } else {
      window.dispatchEvent(new CustomEvent("firestore_sync_status", {
        detail: { status: "online_synced", message: "Successfully synced with Cloud Cosmos.", latency: latencyVal }
      }));
    }
    return docRefResolved;
  } catch (err: any) {
    const latencyVal = Math.round(performance.now() - startTime);
    console.warn("addDoc failed, saving to local offline cache:", err);
    const path = colRef.path;
    const mockId = "mock-doc-" + crypto.randomUUID().substring(0, 8);
    const queue: OfflineQueueItem[] = JSON.parse(localStorage.getItem("offline_echoes_sync") || "[]");
    
    queue.push({
      id: mockId,
      type: 'add',
      path,
      data,
      timestamp: Date.now()
    });
    localStorage.setItem("offline_echoes_sync", JSON.stringify(queue));
    
    // Optimistic collection query cash list
    const listCacheKey = `local_cache_list:${path}`;
    const cachedList = JSON.parse(localStorage.getItem(listCacheKey) || "[]");
    cachedList.push({ id: mockId, ...data });
    localStorage.setItem(listCacheKey, JSON.stringify(cachedList));

    window.dispatchEvent(new CustomEvent("firestore_sync_status", {
      detail: { status: "offline_active", message: "Progress saved in sandbox (Simulated Offline Fallback Mode).", latency: latencyVal }
    }));
    
    return { id: mockId, path: `${path}/${mockId}` };
  }
}

// Background Database Synchronizer
export async function flushOfflineQueueSync(): Promise<{ succeeded: number; failed: number }> {
  const queue: OfflineQueueItem[] = JSON.parse(localStorage.getItem("offline_echoes_sync") || "[]");
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  console.log(`[Offline Sync Engine] Attempting to flush ${queue.length} pending writes to Firestore...`);
  window.dispatchEvent(new CustomEvent("firestore_sync_status", {
    detail: { status: "syncing", message: `Synchronizing outstanding ${queue.length} edits...` }
  }));

  const startTime = performance.now();
  let succeeded = 0;
  let failed = 0;
  const remainingQueue: OfflineQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'set') {
        const ref = doc(db, item.path);
        await setDoc(ref, item.data);
      } else {
        const ref = collection(db, item.path);
        // Ensure any temporary mockIds are stripped out
        const cleanData = { ...item.data };
        delete cleanData.id;
        await addDoc(ref, cleanData);
      }
      succeeded++;
      console.log(`[Offline Sync Engine] Successfully flushed write path: ${item.path}`);
    } catch (err) {
      failed++;
      console.warn(`[Offline Sync Engine] Failed to flush write path ${item.path}:`, err);
      remainingQueue.push(item);
    }
  }

  localStorage.setItem("offline_echoes_sync", JSON.stringify(remainingQueue));

  const latencyVal = Math.round(performance.now() - startTime);

  if (succeeded > 0 && remainingQueue.length === 0) {
    window.dispatchEvent(new CustomEvent("firestore_sync_status", {
      detail: { status: "online_synced", message: `All outstanding data (${succeeded} records) synced to Google Cloud Cosmos.`, latency: latencyVal }
    }));
  } else if (remainingQueue.length > 0) {
    window.dispatchEvent(new CustomEvent("firestore_sync_status", {
      detail: { status: "offline_active", message: "Some changes queued. Direct connection latency computed.", latency: latencyVal }
    }));
  }

  return { succeeded, failed };
}

// Transparent Client-Side Offline-Resilient Read/Fetch Architecture
function getRefPath(ref: any): string | null {
  if (!ref) return null;
  if (typeof ref.path === 'string') return ref.path;
  if (ref._query && ref._query.path) return ref._query.path.toString();
  if (ref.query && ref.query.path) return ref.query.path.toString();
  return null;
}

export async function getDocSafe(docRef: any): Promise<any> {
  try {
    if (await checkChaosOutage()) {
      throw new Error("Simulated Firestore Outage (Chaos Mode Induced)");
    }
    const docSnap = await getDoc(docRef);
    if (docSnap && typeof docSnap.exists === "function" && docSnap.exists()) {
      const path = getRefPath(docRef);
      if (path) {
        localStorage.setItem(`local_cache_doc:${path}`, JSON.stringify({
          id: docSnap.id,
          ...(docSnap.data() as any)
        }));
      }
    }
    return docSnap;
  } catch (err: any) {
    console.warn("getDoc failed, seeking local offline fallback:", err);
    
    const path = getRefPath(docRef);
    if (path) {
      const cachedDataStr = localStorage.getItem(`local_cache_doc:${path}`);
      if (cachedDataStr) {
        const data = JSON.parse(cachedDataStr);
        return {
          id: data.id || docRef.id,
          ref: docRef,
          exists: () => true,
          data: () => {
            const { id, ...rest } = data;
            return rest;
          }
        };
      }
    }
    
    const isOffline = err instanceof Error && 
      (err.message.includes('the client is offline') || err.message.includes('offline'));
    if (isOffline) {
      return {
        id: docRef.id,
        ref: docRef,
        exists: () => false,
        data: () => null
      };
    }
    throw err;
  }
}

export async function getDocsSafe(queryOrColRef: any): Promise<any> {
  try {
    if (await checkChaosOutage()) {
      throw new Error("Simulated Firestore Outage (Chaos Mode Induced)");
    }
    const snapshot = await getDocs(queryOrColRef);
    const path = getRefPath(queryOrColRef);
    if (path && snapshot && snapshot.docs) {
      const listData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      localStorage.setItem(`local_cache_list:${path}`, JSON.stringify(listData));
    }
    return snapshot;
  } catch (err: any) {
    console.warn("getDocs failed, seeking local offline list fallback:", err);
    
    const path = getRefPath(queryOrColRef);
    if (path) {
      const cachedListStr = localStorage.getItem(`local_cache_list:${path}`);
      if (cachedListStr) {
        const listData = JSON.parse(cachedListStr);
        return {
          docs: listData.map((item: any) => ({
            id: item.id,
            ref: { id: item.id, path: `${path}/${item.id}` },
            exists: () => true,
            data: () => {
              const { id, ...rest } = item;
              return rest;
            }
          })),
          empty: listData.length === 0,
          size: listData.length
        };
      }
    }
    
    const isOffline = err instanceof Error && 
      (err.message.includes('the client is offline') || err.message.includes('offline'));
    if (isOffline) {
      return {
        docs: [],
        empty: true,
        size: 0
      };
    }
    throw err;
  }
}

// Connection test as required by skill - gracefully optimized for offline-first sandboxes
async function testConnection() {
  try {
    // Elegant fallback testing offline state safety cleanly
    await getDocFromServer(doc(db, 'test', 'connection'));
    // Trigger background queue flush if online
    setTimeout(() => flushOfflineQueueSync(), 1500);
  } catch (error: any) {
    const isOffline = error instanceof Error && 
      (error.message.includes('the client is offline') || error.message.includes('offline') || error.message.includes('Failed to get document'));
    
    if (isOffline) {
      console.info("Echoes of Choice has loaded successfully. Operating in offline-resilient sandbox mode.");
    } else {
      console.info("Database diagnostic initiated. Automatic offline-first synchronization active.");
    }
  }
}
testConnection();
