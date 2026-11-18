// Units of each currency per 1 US dollar. DEMO values for the prototype only.
// In production, load live rates from your FX / payout partner (and refresh them often):
// some currencies (ARS, LBP, SSP, SYP, VES, ZWG, IRR...) move fast or have parallel-market rates.
export const RATES = {
  USD: 1, EUR: 0.86, GBP: 0.76, CAD: 1.4, AUD: 1.53, NZD: 1.74, CHF: 0.8, JPY: 152, CNY: 7.12, HKD: 7.78,
  SGD: 1.3, KRW: 1400, TWD: 30.5, INR: 88.3, PKR: 281, BDT: 122, LKR: 300, NPR: 141, BTN: 88.3, MVR: 15.4,
  AFN: 66, IRR: 42000, IQD: 1310, SYP: 13000, LBP: 89500, JOD: 0.709, ILS: 3.3, TRY: 42, AED: 3.6725, SAR: 3.75,
  QAR: 3.64, KWD: 0.306, BHD: 0.376, OMR: 0.385, YER: 239, EGP: 47.5, LYD: 5.45, TND: 2.95, DZD: 130, MAD: 9.2,
  MRU: 40, SDG: 600, SSP: 4500, ETB: 150.2, ERN: 15, DJF: 177.7, SOS: 571, KES: 129.1, UGX: 3500, TZS: 2450,
  RWF: 1450, BIF: 2950, CDF: 2800, AOA: 915, ZMW: 23, MWK: 1740, MZN: 63.9, ZWG: 26.8, ZAR: 17.4, NAD: 17.4,
  BWP: 13.6, LSL: 17.4, SZL: 17.4, MGA: 4500, MUR: 46, SCR: 14, KMF: 423, NGN: 1495, GHS: 12.4, XOF: 565,
  XAF: 565, GMD: 72, GNF: 8680, SLE: 23, LRD: 180, CVE: 95, STN: 21, MXN: 18.6, GTQ: 7.67, HNL: 26.2,
  NIO: 36.8, CRC: 503, PAB: 1, BZD: 2, DOP: 63, HTG: 131, JMD: 160, TTD: 6.78, BBD: 2, BSD: 1,
  XCD: 2.7, KYD: 0.83, AWG: 1.79, ANG: 1.79, BMD: 1, CUP: 24, COP: 3900, VES: 200, PEN: 3.4, CLP: 940,
  ARS: 1450, BOB: 6.91, PYG: 7100, UYU: 40, BRL: 5.4, GYD: 209, SRD: 38, RUB: 81, UAH: 41.6, BYN: 3,
  MDL: 17, PLN: 3.65, CZK: 20.9, HUF: 335, RON: 4.37, BGN: 1.68, RSD: 101, MKD: 53, ALL: 83, BAM: 1.68,
  ISK: 123, SEK: 9.5, NOK: 10.1, DKK: 6.4, GEL: 2.7, AMD: 385, AZN: 1.7, KZT: 520, UZS: 12000, KGS: 87.4,
  TJS: 9.3, TMT: 3.5, MNT: 3600, THB: 32.5, MYR: 4.2, IDR: 16500, PHP: 58.4, VND: 26300, KHR: 4020, LAK: 21700,
  MMK: 2100, BND: 1.3, MOP: 8, FJD: 2.27, PGK: 4.2, WST: 2.75, TOP: 2.38, VUV: 120, SBD: 8.3, XPF: 103
};

// Shown first in pickers.
export const POPULAR = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'ETB', 'KES', 'NGN', 'GHS', 'INR', 'PHP', 'MXN', 'AED', 'SAR', 'CNY'];

export const isCurrency = (code) => Object.prototype.hasOwnProperty.call(RATES, code);

// Cross rate: how many `to` units for 1 `from` unit (before Wogen's markup).
export const crossRate = (from, to) => RATES[to] / RATES[from];

// Convert an amount between currencies at the mid-market cross rate.
export const convert = (amount, from, to) => amount * crossRate(from, to);
