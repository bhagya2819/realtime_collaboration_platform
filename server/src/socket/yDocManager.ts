import * as Y from 'yjs';
import { DocumentModel } from '../models';
import { schema } from './yjsSchema';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';

const ydocs = new Map<string, Y.Doc>();
const saveTimers = new Map<string, ReturnType<typeof setInterval>>();
const userCounts = new Map<string, number>();

const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds

/**
 * Get or create a Y.Doc for a document. Loads content from MongoDB on first creation.
 * Legacy TipTap JSON content is automatically converted to Yjs XmlFragment format.
 */
export async function getOrCreateYDoc(documentId: string): Promise<Y.Doc> {
  if (ydocs.has(documentId)) {
    return ydocs.get(documentId)!;
  }

  const ydoc = new Y.Doc();
  const doc = await DocumentModel.findById(documentId).select('content');

  if (doc?.content) {
    if (Buffer.isBuffer(doc.content)) {
      // Stored as Yjs state (Buffer) — apply directly
      Y.applyUpdate(ydoc, doc.content);
    } else if (typeof doc.content === 'object') {
      // Legacy TipTap JSON — convert to Yjs XmlFragment
      try {
        const fragment = ydoc.getXmlFragment('default');
        prosemirrorJSONToYXmlFragment(schema, doc.content, fragment);
      } catch {
        // Fallback: start with empty document if conversion fails
        console.warn(`Failed to convert legacy content for document ${documentId}, starting fresh`);
      }
    }
  } else {
    // No document found — create an empty Y.Doc
    // The in-memory manager is only for active sessions
    // Document must have been created via REST API first
    console.warn(`No document found for ${documentId}, creating ephemeral Y.Doc`);
  }

  ydocs.set(documentId, ydoc);
  startAutoSave(documentId, ydoc);

  return ydoc;
}

/**
 * Convert Y.Doc content back to TipTap JSON for MongoDB persistence.
 */
async function ydocToJSON(documentId: string): Promise<object | null> {
  const ydoc = ydocs.get(documentId);
  if (!ydoc) return null;

  try {
    const fragment = ydoc.getXmlFragment('default');
    const content = yXmlFragmentToProsemirrorJSON(fragment);
    return content as object;
  } catch {
    return null;
  }
}

/**
 * Persist Y.Doc state to MongoDB (as TipTap JSON).
 * Safe to call multiple times — only persists if Y.Doc is still active.
 */
export async function persistYDoc(documentId: string): Promise<void> {
  const ydoc = ydocs.get(documentId);
  if (!ydoc) return;

  try {
    const content = await ydocToJSON(documentId);
    if (content) {
      await DocumentModel.findByIdAndUpdate(documentId, {
        content,
        $currentDate: { updatedAt: true },
      });
    }
  } catch (err) {
    console.error(`Failed to persist Y.Doc for document ${documentId}:`, err);
  }
}

/**
 * Remove a user from a document. When the last user leaves, the Y.Doc is
 * persisted to MongoDB and destroyed.
 */
export async function leaveDocument(documentId: string): Promise<void> {
  const count = (userCounts.get(documentId) || 1) - 1;

  if (count <= 0) {
    userCounts.delete(documentId);
    await destroyYDoc(documentId);
  } else {
    userCounts.set(documentId, count);
  }
}

/**
 * Increment the user count for a document.
 */
export function joinDocument(documentId: string): void {
  userCounts.set(documentId, (userCounts.get(documentId) || 0) + 1);
}

/**
 * Destroy a Y.Doc: persist to MongoDB, cancel auto-save, free memory.
 */
async function destroyYDoc(documentId: string): Promise<void> {
  const timer = saveTimers.get(documentId);
  if (timer) {
    clearInterval(timer);
    saveTimers.delete(documentId);
  }

  await persistYDoc(documentId);

  const ydoc = ydocs.get(documentId);
  if (ydoc) {
    ydoc.destroy();
    ydocs.delete(documentId);
  }
}

/**
 * Apply a Yjs binary update to the server's Y.Doc for a document.
 * Returns true if the document exists and update was applied.
 */
export function applyUpdate(documentId: string, update: Uint8Array): boolean {
  const ydoc = ydocs.get(documentId);
  if (!ydoc) return false;
  Y.applyUpdate(ydoc, update);
  return true;
}

/**
 * Get the full encoded state of a document's Y.Doc for initial sync.
 */
export function getFullState(documentId: string): Uint8Array | null {
  const ydoc = ydocs.get(documentId);
  if (!ydoc) return null;
  return Y.encodeStateAsUpdate(ydoc);
}

/**
 * Check if a Y.Doc exists for a document.
 */
export function hasYDoc(documentId: string): boolean {
  return ydocs.has(documentId);
}

/**
 * Destroy all Y.Docs (for cleanup on server shutdown).
 */
export function destroyAll(): void {
  saveTimers.forEach((timer) => clearInterval(timer));
  saveTimers.clear();
  userCounts.clear();

  ydocs.forEach((ydoc) => ydoc.destroy());
  ydocs.clear();
}

function startAutoSave(documentId: string, _ydoc: Y.Doc): void {
  if (saveTimers.has(documentId)) return;

  const timer = setInterval(() => {
    persistYDoc(documentId);
  }, AUTO_SAVE_INTERVAL);

  saveTimers.set(documentId, timer);
}
