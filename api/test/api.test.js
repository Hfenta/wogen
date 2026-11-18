import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { store } from '../src/store.js';
import { setProvider, applyProviderStatus } from '../src/services/transfers.js';

const app = createApp();
const auth = { Authorization: 'Bearer dev-token-hailey' };

const profile = {
  fullName: 'Hailey Fenta', phone: '+17045550100', email: 'hailey@example.com', dateOfBirth: '2005-01-15',
  address: { line1: '1 Main St', city: 'Indian Trail', state: 'NC', postalCode: '28079', country: 'US' },
  idDocument: { type: 'DRIVERS_LICENSE', country: 'US', number: 'NC12345678', expiryDate: '2030-01-01' }
};

let payouts;
beforeEach(() => {
  store.reset();
  payouts = [];
  setProvider({ name: 'mock', createPayout: async (t) => { payouts.push(t); return { providerRef: 'P-' + t.id }; }, cancelPayout: async () => ({}), parseWebhook: (req) => req.body });
});

async function setup() {
  await request(app).patch('/v1/me').set(auth).send(profile).expect(200);
  const rec = await request(app).post('/v1/recipients').set(auth)
    .send({ name: 'Abeba Tesfaye', phone: '+251911000000', currency: 'ETB', method: 'bank', bankName: 'Commercial Bank of Ethiopia', accountNumber: '1000123456789' }).expect(201);
  const q = await request(app).post('/v1/quotes').set(auth).send({ currency: 'ETB', method: 'bank', speed: 'express', sendAmount: 200 }).expect(201);
  return { rec: rec.body, quote: q.body };
}

test('health and corridors are public', async () => {
  await request(app).get('/health').expect(200);
  const c = await request(app).get('/v1/corridors').expect(200);
  assert.ok(c.body.data.find((x) => x.currency === 'ETB'));
});

test('auth is required', async () => {
  await request(app).get('/v1/me').expect(401);
});

test('quote: first transfer is free and rate includes markup', async () => {
  const { quote } = await setup();
  assert.equal(quote.feeCents, 0);
  assert.equal(quote.promo, 'FIRST_TRANSFER_FREE');
  assert.equal(quote.sendCents, 20000);
  assert.ok(quote.rate < quote.midRate);
  assert.equal(quote.receiveAmount, Math.round(200 * quote.rate * 100) / 100);
});

test('recipient account numbers are masked', async () => {
  const { rec } = await setup();
  assert.equal(rec.accountNumber, '•••6789');
});

test('transfer requires KYC profile', async () => {
  const rec = await request(app).post('/v1/recipients').set(auth).send({ name: 'Dawit F', phone: '+251922000000', currency: 'ETB', method: 'wallet', walletProvider: 'telebirr' }).expect(201);
  const q = await request(app).post('/v1/quotes').set(auth).send({ currency: 'ETB', method: 'wallet', sendAmount: 50 }).expect(201);
  const res = await request(app).post('/v1/transfers').set(auth).send({ quoteId: q.body.id, recipientId: rec.body.id, purpose: 'family_support' }).expect(403);
  assert.equal(res.body.error.code, 'kyc_required');
});

test('full transfer flow with idempotency, webhook updates and public tracking', async () => {
  const { rec, quote } = await setup();
  const body = { quoteId: quote.id, recipientId: rec.id, purpose: 'family_support' };
  const t1 = await request(app).post('/v1/transfers').set(auth).set('Idempotency-Key', 'abc').send(body).expect(201);
  assert.equal(t1.body.status, 'sent_to_partner');
  assert.match(t1.body.trackingCode, /^WG[A-Z0-9]{8}$/);

  const t2 = await request(app).post('/v1/transfers').set(auth).set('Idempotency-Key', 'abc').send(body).expect(200);
  assert.equal(t2.body.id, t1.body.id);
  assert.equal(payouts.length, 1, 'payout sent only once');

  await request(app).post('/v1/webhooks/mock').send({ providerRef: t1.body.providerRef, status: 'delivered' }).expect(200);
  const got = await request(app).get(`/v1/transfers/${t1.body.id}`).set(auth).expect(200);
  assert.equal(got.body.status, 'delivered');
  assert.deepEqual(got.body.timeline.map((s) => s.status), ['created', 'funded', 'sent_to_partner', 'delivered']);

  // Late/duplicate events do not move a final transfer backwards.
  applyProviderStatus({ providerRef: t1.body.providerRef, status: 'sent_to_partner' });
  const tr = await request(app).get(`/v1/track/${t1.body.trackingCode}`).expect(200);
  assert.equal(tr.body.status, 'delivered');
  assert.equal(tr.body.recipient, 'Abeba');
  assert.equal(tr.body.sendCents, undefined);

  // Second transfer pays the normal fee.
  const q2 = await request(app).post('/v1/quotes').set(auth).send({ currency: 'ETB', method: 'bank', speed: 'economy', sendAmount: 100 }).expect(201);
  assert.equal(q2.body.feeCents, 199);
});

test('a quote can only be used once and cannot be used after expiry', async () => {
  const { rec, quote } = await setup();
  await request(app).post('/v1/transfers').set(auth).send({ quoteId: quote.id, recipientId: rec.id, purpose: 'gift' }).expect(201);
  const again = await request(app).post('/v1/transfers').set(auth).send({ quoteId: quote.id, recipientId: rec.id, purpose: 'gift' }).expect(409);
  assert.equal(again.body.error.code, 'quote_used');

  const q = await request(app).post('/v1/quotes').set(auth).send({ currency: 'ETB', method: 'bank', sendAmount: 10 }).expect(201);
  store.put('quotes', { ...store.get('quotes', q.body.id), expiresAt: new Date(Date.now() - 1000).toISOString() });
  const exp = await request(app).post('/v1/transfers').set(auth).send({ quoteId: q.body.id, recipientId: rec.id, purpose: 'gift' }).expect(409);
  assert.equal(exp.body.error.code, 'quote_expired');
});

test('validation: limits, unsupported methods, mismatched recipient', async () => {
  const { rec } = await setup();
  const big = await request(app).post('/v1/quotes').set(auth).send({ currency: 'ETB', method: 'bank', sendAmount: 5000 }).expect(400);
  assert.equal(big.body.error.code, 'amount_too_large');
  const home = await request(app).post('/v1/quotes').set(auth).send({ currency: 'ETB', method: 'home', sendAmount: 50 }).expect(400);
  assert.equal(home.body.error.code, 'unsupported_method');
  const both = await request(app).post('/v1/quotes').set(auth).send({ currency: 'ETB', method: 'bank', sendAmount: 5, receiveAmount: 5 }).expect(400);
  assert.equal(both.body.error.code, 'validation_error');
  const kes = await request(app).post('/v1/quotes').set(auth).send({ currency: 'KES', method: 'wallet', sendAmount: 50 }).expect(201);
  const mm = await request(app).post('/v1/transfers').set(auth).send({ quoteId: kes.body.id, recipientId: rec.id, purpose: 'gift' }).expect(400);
  assert.equal(mm.body.error.code, 'recipient_mismatch');
});

test('cancel before delivery, not after', async () => {
  const { rec, quote } = await setup();
  const t = await request(app).post('/v1/transfers').set(auth).send({ quoteId: quote.id, recipientId: rec.id, purpose: 'gift' }).expect(201);
  const c = await request(app).post(`/v1/transfers/${t.body.id}/cancel`).set(auth).expect(200);
  assert.equal(c.body.status, 'cancelled');
  await request(app).post(`/v1/transfers/${t.body.id}/cancel`).set(auth).expect(409);
});

test('receiveAmount quotes work in reverse', async () => {
  await setup();
  const q = await request(app).post('/v1/quotes').set(auth).send({ currency: 'ETB', method: 'bank', receiveAmount: 15000 }).expect(201);
  assert.ok(q.body.receiveAmount >= 15000);
});
