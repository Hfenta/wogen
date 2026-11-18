// Supported send corridors (from USD). Mid-market rates here are DEMO values.
// In production, load live rates from your FX/payout partner and cache them.
export const corridors = {
  ETB: {
    country: 'ET', name: 'Ethiopia', midRate: 150.2,
    methods: ['bank', 'wallet', 'cash'],
    banks: ['Commercial Bank of Ethiopia', 'Awash Bank', 'Dashen Bank', 'Bank of Abyssinia'],
    wallets: ['telebirr', 'M-PESA Ethiopia', 'CBE Birr'],
    // Per-transfer payout limits in receive currency (check with your partner).
    limits: { bank: 600000, wallet: 150000, cash: 150000 }
  },
  KES: { country: 'KE', name: 'Kenya', midRate: 129.1, methods: ['wallet', 'bank', 'cash'], banks: ['Equity Bank', 'KCB'], wallets: ['M-PESA', 'Airtel Money'], limits: {} },
  NGN: { country: 'NG', name: 'Nigeria', midRate: 1495, methods: ['bank', 'wallet', 'cash'], banks: ['Access Bank', 'GTBank', 'Zenith'], wallets: ['OPay', 'PalmPay'], limits: {} },
  GHS: { country: 'GH', name: 'Ghana', midRate: 12.4, methods: ['wallet', 'bank', 'cash'], banks: ['GCB', 'Ecobank'], wallets: ['MTN MoMo', 'Telecel Cash'], limits: {} },
  MXN: { country: 'MX', name: 'Mexico', midRate: 18.6, methods: ['bank', 'cash', 'home'], banks: ['BBVA', 'Banorte'], wallets: [], limits: {} },
  INR: { country: 'IN', name: 'India', midRate: 88.3, methods: ['bank', 'wallet'], banks: ['SBI', 'HDFC', 'ICICI'], wallets: ['UPI'], limits: {} },
  PHP: { country: 'PH', name: 'Philippines', midRate: 58.4, methods: ['wallet', 'bank', 'cash', 'home'], banks: ['BDO', 'BPI'], wallets: ['GCash', 'Maya'], limits: {} },
  EUR: { country: 'EU', name: 'Europe (SEPA)', midRate: 0.86, methods: ['bank'], banks: ['Any SEPA bank (IBAN)'], wallets: [], limits: {} }
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

export const sendLimitsUsdCents = { perTransfer: 299900, min: 100 };
