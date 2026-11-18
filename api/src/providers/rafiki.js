// Rafiki (by NALA) payout adapter - SKELETON.
// Field names follow Rafiki's public Ethiopia payout docs (purpose, sender type/name/address,
// date of birth and ID document for individual senders). Confirm the exact request schema,
// auth header and webhook signature method against https://docs.rafiki.com before going live.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { ApiError } from '../middleware/errors.js';

const methodToAccountType = { bank: 'BANK_ACCOUNT', wallet: 'MOBILE_MONEY' };

// Map Rafiki payout statuses to Wogen statuses (verify the real status names in their docs).
const statusMap = {
  PENDING: 'sent_to_partner',
  PROCESSING: 'sent_to_partner',
  COMPLETED: 'delivered',
  SUCCESS: 'delivered',
  FAILED: 'failed',
  REJECTED: 'failed',
  CANCELLED: 'cancelled'
};

export function createRafikiProvider() {
  const { baseUrl, apiKey, webhookSecret } = config.rafiki;

  async function call(path, body) {
    if (!apiKey) throw new ApiError(503, 'provider_not_configured', 'RAFIKI_API_KEY is not set');
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(502, 'provider_error', 'Payout partner rejected the request', data);
    return data;
  }

  return {
    name: 'rafiki',
    async createPayout(transfer, { sender, recipient }) {
      const accountType = methodToAccountType[transfer.method];
      if (!accountType) throw new ApiError(400, 'unsupported_method', `Rafiki does not support ${transfer.method}`);
      const body = {
        external_id: transfer.id,
        amount: transfer.receiveAmount.toFixed(2),
        currency: transfer.payoutCurrency, // ETB, or USD when the recipient is paid in dollars
        country: transfer.country,
        purpose: transfer.purpose, // map to Rafiki's allowed purpose codes; send purposeNote as a remark if supported
        ...(transfer.purposeNote ? { metadata: { purpose_note: transfer.purposeNote } } : {}),
        payment_account: accountType === 'BANK_ACCOUNT'
          ? { type: accountType, bank_id: recipient.bankId, account_number: recipient.accountNumber, name: recipient.name }
          : { type: accountType, operator: recipient.walletProvider?.toUpperCase(), phone_number: recipient.phone, name: recipient.name },
        sender: {
          type: 'INDIVIDUAL',
          name: sender.fullName,
          date_of_birth: sender.dateOfBirth,
          address: sender.address,
          identity_document: sender.idDocument
        }
      };
      const data = await call('/payouts', body);
      return { providerRef: data.id || data.payout_id };
    },
    async cancelPayout() {
      throw new ApiError(409, 'cannot_cancel', 'Cancellation after sending must go through partner support');
    },
    parseWebhook(req) {
      if (webhookSecret) {
        const sig = req.get('x-signature') || '';
        const expected = createHmac('sha256', webhookSecret).update(req.rawBody || '').digest('hex');
        const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        if (!ok) throw new ApiError(401, 'bad_signature', 'Webhook signature check failed');
      }
      const p = req.body.data || req.body;
      return { providerRef: p.id || p.payout_id, status: statusMap[p.status] || 'sent_to_partner', reason: p.failure_reason };
    }
  };
}
