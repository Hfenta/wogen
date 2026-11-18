import { COUNTRIES, RESTRICTED, SEPA } from './countries.js';
import { ApiError } from '../middleware/errors.js';

// Payout details we know per country. Every other country gets a generic bank deposit.
// DEMO data: in production, load methods, banks and wallets from your payout partner.
const DETAILS = {
  ET: {
    methods: ['bank', 'wallet', 'cash'],
    banks: ['Commercial Bank of Ethiopia', 'Awash Bank', 'Dashen Bank', 'Bank of Abyssinia'],
    wallets: ['telebirr', 'M-PESA Ethiopia', 'CBE Birr'],
    // Per-transfer payout limits in receive currency (check with your partner).
    limits: { bank: 600000, wallet: 150000, cash: 150000 },
    fxPayout: ['bank', 'cash']
  },
  KE: { methods: ['wallet', 'bank', 'cash'], banks: ['Equity Bank', 'KCB'], wallets: ['M-PESA', 'Airtel Money'], fxPayout: ['bank', 'cash'] },
  NG: { methods: ['bank', 'wallet', 'cash'], banks: ['Access Bank', 'GTBank', 'Zenith'], wallets: ['OPay', 'PalmPay'], fxPayout: ['bank', 'cash'] },
  GH: { methods: ['wallet', 'bank', 'cash'], banks: ['GCB', 'Ecobank'], wallets: ['MTN MoMo', 'Telecel Cash'], fxPayout: ['bank', 'cash'] },
  MX: { methods: ['bank', 'cash', 'home'], banks: ['BBVA', 'Banorte'], fxPayout: ['bank', 'cash'] },
  IN: { methods: ['bank', 'wallet'], banks: ['SBI', 'HDFC', 'ICICI'], wallets: ['UPI'], fxPayout: ['bank'] },
  PH: { methods: ['wallet', 'bank', 'cash', 'home'], banks: ['BDO', 'BPI'], wallets: ['GCash', 'Maya'], fxPayout: ['bank', 'cash'] },
  PK: { methods: ['bank', 'wallet', 'cash'], banks: ['HBL', 'MCB', 'UBL', 'Meezan Bank'], wallets: ['JazzCash', 'Easypaisa'], fxPayout: ['bank'] },
  BD: { methods: ['wallet', 'bank', 'cash'], banks: ['Sonali Bank', 'Dutch-Bangla Bank', 'BRAC Bank'], wallets: ['bKash', 'Nagad'], fxPayout: ['bank'] },
  NP: { methods: ['bank', 'wallet', 'cash'], banks: ['Nabil Bank', 'NIC Asia'], wallets: ['eSewa', 'Khalti'], fxPayout: ['bank'] },
  VN: { methods: ['bank', 'wallet', 'cash'], banks: ['Vietcombank', 'BIDV'], wallets: ['MoMo'], fxPayout: ['bank'] },
  EG: { methods: ['bank', 'wallet', 'cash'], banks: ['National Bank of Egypt', 'Banque Misr'], wallets: ['Vodafone Cash'], fxPayout: ['bank'] },
  UG: { methods: ['wallet', 'bank', 'cash'], banks: ['Stanbic', 'Centenary Bank'], wallets: ['MTN MoMo', 'Airtel Money'], fxPayout: ['bank'] },
  TZ: { methods: ['wallet', 'bank', 'cash'], banks: ['CRDB', 'NMB'], wallets: ['M-Pesa', 'Airtel Money'], fxPayout: ['bank'] },
  SO: { methods: ['wallet', 'cash'], banks: [], wallets: ['EVC Plus', 'Zaad'], fxPayout: ['cash'] },
  CO: { methods: ['bank', 'wallet', 'cash'], banks: ['Bancolombia', 'Davivienda'], wallets: ['Nequi'], fxPayout: ['bank'] },
  GT: { methods: ['bank', 'cash', 'home'], banks: ['Banrural', 'Banco Industrial'], fxPayout: ['bank', 'cash'] },
  HN: { methods: ['bank', 'cash'], banks: ['Banco Atlántida', 'BAC'], fxPayout: ['bank', 'cash'] },
  SV: { methods: ['bank', 'cash'], banks: ['Banco Agrícola', 'Banco Cuscatlán'], fxPayout: [] },
  DO: { methods: ['bank', 'cash', 'home'], banks: ['Banreservas', 'Banco Popular'], fxPayout: ['bank', 'cash'] }
};

function build(code, name, currency) {
  const d = DETAILS[code] || {};
  return {
    country: code,
    name,
    currency,
    available: !RESTRICTED.has(code),
    methods: d.methods || ['bank'],
    banks: d.banks || [SEPA.has(code) ? 'Any bank (IBAN)' : 'Any local bank'],
    wallets: d.wallets || [],
    limits: d.limits || {},
    // Methods that can pay out in a currency other than the local one (e.g. USD into Ethiopia).
    fxPayout: d.fxPayout || (currency === 'EUR' ? [] : ['bank'])
  };
}

// Every destination, keyed by ISO country code.
export const corridors = Object.fromEntries(COUNTRIES.map(([code, name, cur]) => [code, build(code, name, cur)]));

// Older clients send only `currency`. It maps to a country when exactly one country uses it,
// or when that currency has a detailed home corridor (e.g. ETB -> ET).
const HOME = {};
for (const [code, , cur] of COUNTRIES) (HOME[cur] ||= []).push(code);
export const currencyHome = (cur) => {
  const list = HOME[cur] || [];
  return list.length === 1 ? list[0] : list.find((c) => DETAILS[c]) || null;
};

// Find the corridor from { country } (preferred) or a legacy { currency }.
export function resolveCorridor({ country, currency }) {
  let code = country?.toUpperCase();
  if (!code && currency) {
    code = currencyHome(currency.toUpperCase());
    if (!code) {
      const many = HOME[currency.toUpperCase()];
      throw new ApiError(400, many ? 'country_required' : 'unsupported_corridor',
        many ? `${currency} is used in several countries - pass "country" (ISO code)` : `Sending to ${currency} is not supported`);
    }
  }
  const c = corridors[code];
  if (!c) throw new ApiError(400, 'unsupported_corridor', `Sending to ${country || currency} is not supported`);
  if (!c.available) throw new ApiError(400, 'restricted_destination', `Sending to ${c.name} is not available`);
  return c;
}

// Fees in USD cents: [economy, express]. Converted into the sender's currency when quoting.
export const methodFees = {
  bank: [199, 399],
  wallet: [99, 249],
  cash: [299, 499],
  home: [599, 599]
};

// Exchange-rate markup vs. mid-market, by speed.
export const markup = { economy: 0.006, express: 0.012 };

// Extra fee (USD cents) when the recipient is paid in a currency other than the destination's own
// (e.g. USD or EUR into Ethiopia). Which methods can do this depends on the partner and local rules.
export const fxPayoutFeeUsdCents = 100;

// Limits are in USD; sends in other currencies are converted to USD to check them.
export const sendLimitsUsdCents = { perTransfer: 299900, min: 100 };
