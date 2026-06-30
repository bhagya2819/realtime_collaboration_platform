import { getRedis } from '../config/redis';
import { DocumentModel } from '../models';

const DOC_CACHE_PREFIX = 'doc:';
const DOC_CACHE_TTL = 300;

export const getCachedDocument = async (documentId: string): Promise<Record<string, any> | null> => {
  try {
    const redis = getRedis();
    const cached = await redis.get(`${DOC_CACHE_PREFIX}${documentId}`);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis miss is non-critical
  }
  return null;
};

export const setCachedDocument = async (documentId: string, document: Record<string, any>): Promise<void> => {
  try {
    const redis = getRedis();
    await redis.set(
      `${DOC_CACHE_PREFIX}${documentId}`,
      JSON.stringify(document),
      'EX',
      DOC_CACHE_TTL
    );
  } catch {
    // Redis cache write failure is non-critical
  }
};

export const invalidateDocumentCache = async (documentId: string): Promise<void> => {
  try {
    const redis = getRedis();
    await redis.del(`${DOC_CACHE_PREFIX}${documentId}`);
  } catch {
    // Non-critical
  }
};

export const getDocumentWithCache = async (documentId: string): Promise<Record<string, any> | null> => {
  const cached = await getCachedDocument(documentId);
  if (cached) return cached;

  const document = await DocumentModel.findById(documentId)
    .populate('createdBy', 'name')
    .populate('lastEditedBy', 'name')
    .lean();

  if (document) {
    await setCachedDocument(documentId, document);
  }

  return document;
};
