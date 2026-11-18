import { corridors, methodFees, markup, sendLimitsUsdCents, fxPayoutFeeUsdCents } from '../data/corridors.js';
import { RATES, isCurrency, crossRate, convert } from '../data/currencies.js';
import { store, id } from '../store.js';
import { config } from '../config.js';
import { ApiError, notFound } from '../middleware/errors.js';

const round2 = (n) => Math.round(n * 100) / 100;
const sig = (n) => +n.toPrecision(n >= 100 ? 7 : 6);

export function isFirstTransfer(userId) {
  return !store.findOne('transfers', (t) => t.userId === userId && t.status !== 'cancelled');
}

// Build a locked quote.
// - currency: destination corridor (the recipient's country currency, e.g. ETB)
// - sendCurrency: what the sender pays in (any supported currency, default USD)
// - payoutCurrency: 'local' (the corridor currency) or any supported currency code
// Money fields ending in "Cents" are in minor units (x100) of sendCurrency.
export function createQuote(userId, { currency, method, speed, sendAmount, receiveAmount, sendCurrency = 'USD', payoutCurrency = 'local' }) {
  const c = corridors[currency];
  if (!c) throw new ApiError(400, 'unsupported_corridor', `Sending to ${currency} is not supported`);
  if (!c.methods.includes(method)) throw new ApiError(400, 'unsupported_method', `${method} is not available for ${c.name}`, { available: c.methods });

  const payCur = payoutCurrency === 'local' ? currency : payoutCurrency;
  for (const code of [sendCurrency, payCur]) {
    if (!isCurrency(code)) throw new ApiError(400, 'unsupported_currency', `Currency ${code} is not supported`);
  }
  const foreignPayout = payCur !== currency;
  if (foreignPayout && !c.fxPayout?.includes(method)) {
    throw new ApiError(400, 'fx_payout_unavailable', `${payCur} payout is not available for ${method} in ${c.name}`, { available: c.fxPayout || [] });
  }

  const same = sendCurrency === payCur;
  const appliedMarkup = same ? 0 : markup[speed];
  const midRate = sig(crossRate(sendCurrency, payCur));
  const rate = same ? 1 : sig(crossRate(sendCurrency, payCur) * (1 - appliedMarkup));

  const sendCents = sendAmount != null ? Math.round(sendAmount * 100) : Math.ceil((receiveAmount / rate) * 100);
  const sendUsdCents = Math.round(convert(sendCents, sendCurrency, 'USD'));
  if (sendUsdCents < sendLimitsUsdCents.min) throw new ApiError(400, 'amount_too_small', 'Minimum send is the equivalent of $1.00');
  if (sendUsdCents > sendLimitsUsdCents.perTransfer) throw new ApiError(400, 'amount_too_large', 'Maximum per transfer is the equivalent of $2,999.00');

  const receive = round2((sendCents / 100) * rate);
  const limit = c.limits?.[method];
  if (!foreignPayout && limit && receive > limit) throw new ApiError(400, 'payout_limit', `Maximum for ${method} in ${c.name} is ${limit} ${currency}`);

  const feeUsdCents = methodFees[method][speed === 'express' ? 1 : 0] + (foreignPayout ? fxPayoutFeeUsdCents : 0);
  const standardFee = Math.round(convert(feeUsdCents, 'USD', sendCurrency));
  const first = isFirstTransfer(userId);
  const feeCents = first ? 0 : standardFee;
  const now = Date.now();

  return store.put('quotes', {
    id: id('qt'),
    userId,
    currency,
    country: c.country,
    sendCurrency,
    payoutCurrency: payCur,
    method,
    speed,
    midRate,
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

export { RATES };
