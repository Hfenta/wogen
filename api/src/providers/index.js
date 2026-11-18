import { config } from '../config.js';
import { createMockProvider } from './mock.js';
import { createRafikiProvider } from './rafiki.js';

const factories = { mock: createMockProvider, rafiki: createRafikiProvider };

export function createProvider(name = config.provider, deps) {
  const f = factories[name];
  if (!f) throw new Error(`Unknown PAYOUT_PROVIDER "${name}". Use one of: ${Object.keys(factories).join(', ')}`);
  return f(deps);
}

export const providerNames = Object.keys(factories);
