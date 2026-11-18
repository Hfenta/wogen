// Simple in-memory store with a repository-style interface.
// Swap this file for Firestore or Postgres later; the services only call these functions.
import { randomUUID } from 'node:crypto';

const tables = { users: new Map(), recipients: new Map(), quotes: new Map(), transfers: new Map(), idempotency: new Map(), events: [] };

export const id = (prefix) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

export const store = {
  get: (table, key) => tables[table].get(key) || null,
  put: (table, obj) => { tables[table].set(obj.id, obj); return obj; },
  list: (table, filter = () => true) => [...tables[table].values()].filter(filter),
  findOne: (table, filter) => [...tables[table].values()].find(filter) || null,
  idem: {
    get: (key) => tables.idempotency.get(key) || null,
    set: (key, value) => tables.idempotency.set(key, value)
  },
  logEvent: (e) => tables.events.push({ at: new Date().toISOString(), ...e }),
  reset: () => Object.values(tables).forEach((t) => (Array.isArray(t) ? (t.length = 0) : t.clear()))
};
