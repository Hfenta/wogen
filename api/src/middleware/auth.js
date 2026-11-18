import { config } from '../config.js';
import { ApiError } from './errors.js';
import { store } from '../store.js';

const tokenMap = new Map(config.devTokens);

// Dev auth: "Authorization: Bearer <token>". In production, verify a Firebase ID token here
// (firebase-admin: admin.auth().verifyIdToken(token)) and use decoded.uid as the user id.
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token && tokenMap.get(token);
  if (!userId) return next(new ApiError(401, 'unauthorized', 'Missing or invalid token'));
  req.user = store.get('users', userId) || store.put('users', { id: userId, kycStatus: 'unverified', createdAt: new Date().toISOString() });
  next();
}
