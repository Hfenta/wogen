// Central config, read from environment variables (see .env.example).
export const config = {
  port: Number(process.env.PORT || 4000),
  env: process.env.NODE_ENV || 'development',
  // Which payout partner to use: "mock" (simulator) or "rafiki".
  provider: process.env.PAYOUT_PROVIDER || 'mock',
  quoteTtlMinutes: Number(process.env.QUOTE_TTL_MINUTES || 30),
  // Dev auth: comma-separated "token:userId" pairs. Replace with Firebase Auth in production.
  devTokens: (process.env.DEV_TOKENS || 'dev-token-hailey:user_hailey')
    .split(',')
    .map((p) => p.trim().split(':'))
    .filter((p) => p.length === 2),
  rafiki: {
    baseUrl: process.env.RAFIKI_BASE_URL || 'https://rest.sandbox.rafiki-api.com/v1',
    apiKey: process.env.RAFIKI_API_KEY || '',
    webhookSecret: process.env.RAFIKI_WEBHOOK_SECRET || ''
  },
  mockStepMs: Number(process.env.MOCK_STEP_MS || 2500)
};
