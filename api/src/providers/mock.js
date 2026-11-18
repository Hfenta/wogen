// Simulated payout partner: moves a transfer through its lifecycle on a timer
// and reports each change through the same webhook handler a real partner would use.
import { config } from '../config.js';

export function createMockProvider({ onStatus }) {
  return {
    name: 'mock',
    async createPayout(transfer) {
      const ref = `MOCK-${transfer.trackingCode}`;
      const final = transfer.method === 'cash' ? 'ready_for_pickup' : 'delivered';
      const steps = ['sent_to_partner', final];
      steps.forEach((status, i) => {
        const t = setTimeout(() => onStatus({ providerRef: ref, status }), config.mockStepMs * (i + 1));
        t.unref?.();
      });
      return { providerRef: ref };
    },
    async cancelPayout() { return { ok: true }; },
    // Mock webhooks are trusted; real providers must verify signatures.
    parseWebhook(req) { return { providerRef: req.body.providerRef, status: req.body.status, reason: req.body.reason }; }
  };
}
