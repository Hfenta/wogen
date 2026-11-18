import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { ApiError, notFound } from '../middleware/errors.js';
import { corridors } from '../data/corridors.js';
import { RATES, POPULAR, isCurrency } from '../data/currencies.js';
import { store, id } from '../store.js';
import { createQuote, getQuote } from '../services/quotes.js';
import { createTransfer, getTransfer, cancelTransfer, publicTrack, applyProviderStatus, getProvider } from '../services/transfers.js';

const r = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const currency = z.enum(Object.keys(corridors));
const method = z.enum(['bank', 'wallet', 'cash', 'home']);
const purposes = ['family_support', 'education', 'medical', 'gift', 'business', 'savings', 'other'];

// ---------- Public ----------
r.get('/corridors', (_req, res) => {
  res.json({ data: Object.entries(corridors).map(([code, c]) => ({ currency: code, country: c.country, name: c.name, methods: c.methods, fxPayoutMethods: c.fxPayout || [], banks: c.banks, wallets: c.wallets, limits: c.limits })) });
});

// Every supported currency, units per 1 USD (demo values).
r.get('/currencies', (_req, res) => res.json({ base: 'USD', demo: true, popular: POPULAR, data: RATES }));
r.get('/rates', (_req, res) => res.json({ base: 'USD', demo: true, data: RATES }));

r.get('/track/:code', (req, res) => res.json(publicTrack(req.params.code)));

// Payout partner webhooks (e.g. POST /v1/webhooks/rafiki)
r.post('/webhooks/:provider', wrap(async (req, res) => {
  const p = getProvider();
  if (req.params.provider !== p.name) throw new ApiError(404, 'unknown_provider', 'Webhook provider not active');
  const event = p.parseWebhook(req);
  const t = applyProviderStatus(event);
  res.json({ received: true, matched: !!t });
}));

// ---------- Authenticated ----------
r.use(requireAuth);

const profileSchema = z.object({
  fullName: z.string().min(3),
  phone: z.string().min(7),
  email: z.string().email(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  address: z.object({ line1: z.string(), city: z.string(), state: z.string().optional(), postalCode: z.string(), country: z.string().length(2) }),
  idDocument: z.object({ type: z.enum(['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID']), country: z.string().length(2), number: z.string(), expiryDate: z.string() })
}).partial();

const publicUser = (u) => {
  const { idDocument, ...rest } = u;
  return { ...rest, idDocument: idDocument ? { ...idDocument, number: '•••' + idDocument.number.slice(-4) } : undefined };
};

r.get('/me', (req, res) => res.json(publicUser(req.user)));
r.patch('/me', (req, res) => {
  const patch = profileSchema.parse(req.body);
  const u = store.put('users', { ...req.user, ...patch, updatedAt: new Date().toISOString() });
  const complete = ['fullName', 'dateOfBirth', 'address', 'idDocument'].every((k) => u[k]);
  // In production, send the ID to a KYC provider and set 'verified' from its webhook.
  u.kycStatus = complete ? 'pending_review' : 'unverified';
  res.json(publicUser(store.put('users', u)));
});

const recipientSchema = z.object({
  name: z.string().min(3),
  phone: z.string().min(7),
  currency,
  method,
  bankName: z.string().optional(),
  bankId: z.string().optional(),
  accountNumber: z.string().optional(),
  walletProvider: z.string().optional(),
  address: z.string().optional(),
  relationship: z.string().optional()
}).superRefine((v, ctx) => {
  const c = corridors[v.currency];
  if (!c.methods.includes(v.method)) ctx.addIssue({ code: 'custom', path: ['method'], message: `${v.method} not available for ${c.name}` });
  if (v.method === 'bank' && !v.accountNumber) ctx.addIssue({ code: 'custom', path: ['accountNumber'], message: 'Required for bank deposit' });
  if (v.method === 'wallet' && !v.walletProvider) ctx.addIssue({ code: 'custom', path: ['walletProvider'], message: 'Required for mobile wallet' });
  if (v.method === 'home' && !v.address) ctx.addIssue({ code: 'custom', path: ['address'], message: 'Required for home delivery' });
});

const maskRecipient = (x) => ({ ...x, accountNumber: x.accountNumber ? '•••' + x.accountNumber.slice(-4) : undefined });

r.get('/recipients', (req, res) => res.json({ data: store.list('recipients', (x) => x.userId === req.user.id).map(maskRecipient) }));
r.post('/recipients', (req, res) => {
  const body = recipientSchema.parse(req.body);
  const rec = store.put('recipients', { id: id('rc'), userId: req.user.id, ...body, createdAt: new Date().toISOString() });
  res.status(201).json(maskRecipient(rec));
});
r.delete('/recipients/:id', (req, res) => {
  const rec = store.get('recipients', req.params.id);
  if (!rec || rec.userId !== req.user.id) throw notFound('Recipient');
  store.put('recipients', { ...rec, userId: `deleted:${rec.userId}` });
  res.status(204).end();
});

const quoteSchema = z.object({
  currency,
  method,
  speed: z.enum(['express', 'economy']).default('express'),
  // Currency the sender pays in (any supported code). Default USD.
  sendCurrency: z.string().toUpperCase().refine(isCurrency, 'Unsupported currency').default('USD'),
  // 'local' = destination's own currency (default), or any supported code (USD, EUR, GBP...).
  payoutCurrency: z.string().refine((v) => v === 'local' || isCurrency(v.toUpperCase()), 'Unsupported currency').transform((v) => (v === 'local' ? v : v.toUpperCase())).default('local'),
  sendAmount: z.number().positive().optional(),
  receiveAmount: z.number().positive().optional()
}).refine((v) => (v.sendAmount != null) !== (v.receiveAmount != null), { message: 'Provide exactly one of sendAmount or receiveAmount' });

r.post('/quotes', (req, res) => res.status(201).json(createQuote(req.user.id, quoteSchema.parse(req.body))));
r.get('/quotes/:id', (req, res) => res.json(getQuote(req.user.id, req.params.id)));

const transferSchema = z.object({
  quoteId: z.string(),
  recipientId: z.string(),
  purpose: z.enum(purposes),
  // Required when purpose is "other": the sender's own words (shown on the receipt, sent to the partner).
  purposeNote: z.string().trim().min(3).max(140).optional()
}).refine((v) => v.purpose !== 'other' || v.purposeNote, { path: ['purposeNote'], message: 'Write a reason when purpose is "other"' });

r.post('/transfers', wrap(async (req, res) => {
  const { transfer, replayed } = await createTransfer(req.user, transferSchema.parse(req.body), req.get('idempotency-key'));
  res.status(replayed ? 200 : 201).json(transfer);
}));
r.get('/transfers', (req, res) => {
  res.json({ data: store.list('transfers', (t) => t.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});
r.get('/transfers/:id', (req, res) => res.json(getTransfer(req.user.id, req.params.id)));
r.post('/transfers/:id/cancel', wrap(async (req, res) => res.json(await cancelTransfer(req.user.id, req.params.id))));

export default r;
