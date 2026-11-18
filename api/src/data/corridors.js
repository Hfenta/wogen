// Supported send corridors (from USD). Mid-market rates here are DEMO values.
// In production, load live rates from your FX/payout partner and cache them.
export const corridors = {
  ETB: {
    country: 'ET', name: 'Ethiopia', midRate: 150.2,
    methods: ['bank', 'wallet', 'cash'],
    banks: ['Commercial Bank of Ethiopia', 'Awash Bank', 'Dashen Bank', 'Bank of Abyssinia'],
    wallets: ['telebirr', 'M-PESA Ethiopia', 'CBE Birr'],
    // Per-transfer payout limits in receive currency (check with your partner).
    limits: { bank: 600000, wallet: 150000, cash: 150000 },
    usdPayout: ['bank', 'cash']
  },
  KES: { country: 'KE', name: 'Kenya', midRate: 129.1, methods: ['wallet', 'bank', 'cash'], banks: ['Equity Bank', 'KCB'], wallets: ['M-PESA', 'Airtel Money'], limits: {}, usdPayout: ['bank', 'cash'] },
  NGN: { country: 'NG', name: 'Nigeria', midRate: 1495, methods: ['bank', 'wallet', 'cash'], banks: ['Access Bank', 'GTBank', 'Zenith'], wallets: ['OPay', 'PalmPay'], limits: {}, usdPayout: ['bank', 'cash'] },
  GHS: { country: 'GH', name: 'Ghana', midRate: 12.4, methods: ['wallet', 'bank', 'cash'], banks: ['GCB', 'Ecobank'], wallets: ['MTN MoMo', 'Telecel Cash'], limits: {}, usdPayout: ['bank', 'cash'] },
  MXN: { country: 'MX', name: 'Mexico', midRate: 18.6, methods: ['bank', 'cash', 'home'], banks: ['BBVA', 'Banorte'], wallets: [], limits: {}, usdPayout: ['bank', 'cash'] },
  INR: { country: 'IN', name: 'India', midRate: 88.3, methods: ['bank', 'wallet'], banks: ['SBI', 'HDFC', 'ICICI'], wallets: ['UPI'], limits: {}, usdPayout: ['bank'] },
  PHP: { country: 'PH', name: 'Philippines', midRate: 58.4, methods: ['wallet', 'bank', 'cash', 'home'], banks: ['BDO', 'BPI'], wallets: ['GCash', 'Maya'], limits: {}, usdPayout: ['bank', 'cash'] },
  EUR: { country: 'EU', name: 'Europe (SEPA)', midRate: 0.86, methods: ['bank'], banks: ['Any SEPA bank (IBAN)'], wallets: [], limits: {}, usdPayout: [] }
};

// Fees in USD cents: [economy, express].
export const methodFees = {
  bank: [199, 399],
  wallet: [99, 249],
  cash: [299, 499],
  home: [599, 599]
};

// Exchange-rate markup vs. mid-market, by speed.
export const markup = { economy: 0.006, express: 0.012 };

// Extra fee (USD cents) when the recipient is paid in US dollars instead of local currency.
// Which methods can pay USD depends on your payout partner and the destination's rules.
export const usdPayoutFeeCents = 100;

export const sendLimitsUsdCents = { perTransfer: 299900, min: 100 };
