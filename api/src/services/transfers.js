import { randomInt } from 'node:crypto';
import { store, id } from '../store.js';
import { getQuote } from './quotes.js';
import { createProvider } from '../providers/index.js';
import { ApiError, notFound } from '../middleware/errors.js';

// Lifecycle: created -> funded -> sent_to_partner -> delivered | ready_for_pickup
//            (any non-final state) -> failed | cancelled
const ORDER = ['created', 'funded', 'sent_to_partner', 'ready_for_pickup', 'delivered'];
const FINAL = new Set(['delivered', 'failed', 'cancelled']);

let provider;
export function getProvider() {
  if (!provider) provider = createProvider(undefined, { onStatus: applyProviderStatus });
  return provider;
}
export function setProvider(p) { provider = p; }

const code = () => 'WG' + Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');

function pushStatus(t, status, note) {
  t.status = status;
  t.updatedAt = new Date().toISOString();
  t.timeline.push({ status, at: t.updatedAt, ...(note ? { note } : {}) });
  store.put('transfers', t);
  store.logEvent({ type: 'transfer.status', transferId: t.id, status });
}

const REQUIRED_SENDER = ['fullName', 'dateOfBirth', 'address', 'idDocument'];

export async function createTransfer(user, { quoteId, recipientId, purpose, purposeNote }, idemKey) {
  if (idemKey) {
    const prior = store.idem.get(`${user.id}:${idemKey}`);
    if (prior) return { transfer: store.get('transfers', prior), replayed: true };
  }

  const quote = getQuote(user.id, quoteId);
  if (quote.expired) throw new ApiError(409, 'quote_expired', 'Rate lock expired - request a new quote');
  if (quote.usedBy) throw new ApiError(409, 'quote_used', 'This quote was already used');

  const recipient = store.get('recipients', recipientId);
  if (!recipient || recipient.userId !== user.id) throw notFound('Recipient');
  if (recipient.currency !== quote.currency || recipient.method !== quote.method) {
    throw new ApiError(400, 'recipient_mismatch', 'Recipient payout details do not match the quote currency/method');
  }

  const missing = REQUIRED_SENDER.filter((k) => !user[k]);
  if (missing.length) throw new ApiError(403, 'kyc_required', 'Complete your profile before sending', { missing });

  const t = {
    id: id('tr'),
    trackingCode: code(),
    userId: user.id,
    recipientId,
    recipientName: recipient.name,
    quoteId,
    purpose,
    purposeNote: purpose === 'other' ? purposeNote : null,
    currency: quote.currency,
    payoutCurrency: quote.payoutCurrency,
    country: quote.country,
    method: quote.method,
    speed: quote.speed,
    rate: quote.rate,
    sendCents: quote.sendCents,
    feeCents: quote.feeCents,
    totalCents: quote.totalCents,
    receiveAmount: quote.receiveAmount,
    providerName: getProvider().name,
    providerRef: null,
    status: null,
    timeline: [],
    createdAt: new Date().toISOString()
  };
  pushStatus(t, 'created');
  store.put('quotes', { ...store.get('quotes', quoteId), usedBy: t.id });
  if (idemKey) store.idem.set(`${user.id}:${idemKey}`, t.id);

  // Funding: in production, charge the debit card / ACH here (via your partner) and only
  // continue once the payment succeeds. The demo marks it funded immediately.
  pushStatus(t, 'funded');

  try {
    const { providerRef } = await getProvider().createPayout(t, { sender: user, recipient });
    t.providerRef = providerRef;
    pushStatus(t, 'sent_to_partner');
  } catch (err) {
    pushStatus(t, 'failed', err.message);
    throw err;
  }
  return { transfer: t, replayed: false };
}

export function applyProviderStatus({ providerRef, status, reason }) {
  const t = store.findOne('transfers', (x) => x.providerRef === providerRef);
  if (!t) return null;
  if (FINAL.has(t.status) || t.status === status) return t; // ignore duplicates / late events
  const forward = ORDER.indexOf(status) > ORDER.indexOf(t.status);
  if (status === 'failed' || status === 'cancelled' || forward) pushStatus(t, status, reason);
  return t;
}

export function getTransfer(userId, transferId) {
  const t = store.get('transfers', transferId);
  if (!t || t.userId !== userId) throw notFound('Transfer');
  return t;
}

export async function cancelTransfer(userId, transferId) {
  const t = getTransfer(userId, transferId);
  if (FINAL.has(t.status) || t.status === 'ready_for_pickup') throw new ApiError(409, 'cannot_cancel', `Transfer is already ${t.status}`);
  if (t.providerRef) await getProvider().cancelPayout(t);
  pushStatus(t, 'cancelled', 'Cancelled by sender - refund issued');
  return t;
}

// Public tracking view: what a recipient with the code may see. No amounts sent or sender details.
export function publicTrack(trackingCode) {
  const t = store.findOne('transfers', (x) => x.trackingCode === trackingCode.toUpperCase());
  if (!t) throw notFound('Transfer');
  const first = t.recipientName.split(' ')[0];
  return { trackingCode: t.trackingCode, recipient: first, receiveAmount: t.receiveAmount, currency: t.payoutCurrency, method: t.method, status: t.status, timeline: t.timeline };
}
