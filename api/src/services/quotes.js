import { corridors, methodFees, markup, sendLimitsUsdCents, usdPayoutFeeCents } from '../data/corridors.js';
import { store, id } from '../store.js';
import { config } from '../config.js';
import { ApiError, notFound } from '../middleware/errors.js';

const round2 = (n) => Math.round(n * 100) / 100;

export function isFirstTransfer(userId) {
  return !store.findOne('transfers', (t) => t.userId === userId && t.status !== 'cancelled');
}

// Build a locked quote. Amounts in USD cents (send) and minor units of the receive currency.
export function createQuote(userId, { currency, method, speed, sendAmount, receiveAmount, payoutCurrency = 'local' }) {
  const c = corridors[currency];
  if (!c) throw new ApiError(400, 'unsupported_corridor', `Sending to ${currency} is not supported`);
  if (!c.methods.includes(method)) throw new ApiError(400, 'unsupported_method', `${method} is not available for ${c.name}`, { available: c.methods });

  const usd = payoutCurrency === 'USD';
  if (usd && !c.usdPayout?.includes(method)) {
    throw new ApiError(400, 'usd_payout_unavailable', `US dollar payout is not available for ${method} in ${c.name}`, { available: c.usdPayout || [] });
  }
  const appliedMarkup = usd ? 0 : markup[speed];
  const rate = usd ? 1 : round2(c.midRate * (1 - appliedMarkup) * 10000) / 10000;
  let sendCents;
  if (sendAmount != null) sendCents = Math.round(sendAmount * 100);
  else sendCents = Math.ceil((receiveAmount / rate) * 100);

  if (sendCents < sendLimitsUsdCents.min) throw new ApiError(400, 'amount_too_small', 'Minimum send is $1.00');
  if (sendCents > sendLimitsUsdCents.perTransfer) throw new ApiError(400, 'amount_too_large', 'Maximum per transfer is $2,999.00');

  const receive = round2((sendCents / 100) * rate);
  const limit = c.limits?.[method];
  if (!usd && limit && receive > limit) throw new ApiError(400, 'payout_limit', `Maximum for ${method} in ${c.name} is ${limit} ${currency}`);

  const standardFee = methodFees[method][speed === 'express' ? 1 : 0] + (usd ? usdPayoutFeeCents : 0);
  const first = isFirstTransfer(userId);
  const feeCents = first ? 0 : standardFee;
  const now = Date.now();

  return store.put('quotes', {
    id: id('qt'),
    userId,
    currency,
    country: c.country,
    payoutCurrency: usd ? 'USD' : currency,
    method,
    speed,
    midRate: usd ? 1 : c.midRate,
    rate,
    markupPct: appliedMarkup * 100,
    markupCostCents: Math.round(sendCents * appliedMarkup),
    sendCents,
    feeCents,
    standardFeeCents: standardFee,
    promo: first ? 'FIRST_TRANSFER_FREE' : null,
    totalCents: sendCents + feeCents,
    receiveAmount: receive,
    eta: speed === 'express' ? (method === 'bank' ? 'within_1_hour' : 'minutes') : '1_3_business_days',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + config.quoteTtlMinutes * 60000).toISOString()
  });
}

export function getQuote(userId, quoteId) {
  const q = store.get('quotes', quoteId);
  if (!q || q.userId !== userId) throw notFound('Quote');
  return { ...q, expired: Date.parse(q.expiresAt) < Date.now() };
}
