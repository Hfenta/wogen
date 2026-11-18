# Wogen API

The backend for the Wogen money transfer app. It handles rate quotes with a 30-minute rate lock, the sender profile and ID check, recipients, transfers, live tracking and webhooks from the payout partner.

> ⚠️ Demo rates and an in-memory database. Real money needs a licensed partner (see "Going live").

## Run it

```bash
cd api
npm install
npm run dev        # http://localhost:4000
npm test           # 15 end-to-end tests
```

Copy `.env.example` to `.env` to change settings. The default dev login token is `dev-token-hailey`:

```bash
curl -H "Authorization: Bearer dev-token-hailey" http://localhost:4000/v1/me
```

## Endpoints

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/health` | – | Service status |
| GET | `/v1/corridors` | – | All 208 destination countries: ISO code, local currency, `available`, delivery methods, banks, wallets, limits |
| GET | `/v1/currencies` | – | All ~150 supported currencies with demo rates per USD |
| GET | `/v1/rates` | – | Same rates, as a plain map |
| GET | `/v1/track/:code` | – | Public tracking for the recipient (no sender details) |
| POST | `/v1/webhooks/:provider` | signature | Status updates from the payout partner |
| GET / PATCH | `/v1/me` | ✓ | Sender profile and the ID details partners require |
| GET / POST | `/v1/recipients` | ✓ | Saved recipients (account numbers masked) |
| DELETE | `/v1/recipients/:id` | ✓ | Remove a recipient |
| POST | `/v1/quotes` | ✓ | Locked quote with `sendAmount` **or** `receiveAmount`. `sendCurrency` (any code, default USD) and `payoutCurrency` (`local` or any code, e.g. USD, EUR) |
| GET | `/v1/quotes/:id` | ✓ | Quote, including `expired` |
| POST | `/v1/transfers` | ✓ | Send money (pass an `Idempotency-Key` header) |
| GET | `/v1/transfers` / `/v1/transfers/:id` | ✓ | History and the full status timeline |
| POST | `/v1/transfers/:id/cancel` | ✓ | Cancel before delivery |

### Example: send $200 to a bank in Ethiopia

```bash
# 1. Quote (first transfer is free)
POST /v1/quotes      {"country":"ET","method":"bank","speed":"express","sendAmount":200}
# 2. Recipient
POST /v1/recipients  {"name":"Abeba Tesfaye","phone":"+251911000000","country":"ET","method":"bank","bankName":"Commercial Bank of Ethiopia","accountNumber":"1000123456789"}
# 3. Send
POST /v1/transfers   {"quoteId":"qt_…","recipientId":"rc_…","purpose":"family_support"}   + header Idempotency-Key
# 4. Track
GET  /v1/track/WGXXXXXXXX
```

Destinations are picked by `country` (ISO code). The older `currency` field still works when only one country uses that currency (`ETB`), but shared currencies (`EUR`, `XOF`, `USD`…) return `country_required`. Cuba, Iran and North Korea are listed with `available: false` and return `restricted_destination`.

Transfer statuses: `created → funded → sent_to_partner → delivered` (or `ready_for_pickup` for cash), plus `failed` and `cancelled`.

## How it's built

```
src/
  app.js, server.js       Express app, security headers, JSON errors
  config.js               Settings from environment variables
  data/countries.js       Every country, its currency, restricted and SEPA lists
  data/corridors.js       Payout methods per country, fees, markup, limits
  data/currencies.js      Demo rates for every currency
  store.js                In-memory database (swap for Firestore or Postgres)
  middleware/             Auth (dev tokens; swap for Firebase Auth) and errors
  services/quotes.js      Pricing, rate lock, first-transfer promotion
  services/transfers.js   Transfer lifecycle, idempotency, tracking codes
  providers/              Payout partners: mock (simulator) and rafiki (skeleton)
```

Payout partners are plug-ins. `PAYOUT_PROVIDER=mock` simulates delivery. `PAYOUT_PROVIDER=rafiki` uses the Rafiki adapter. To add another partner, create `providers/<name>.js` with `createPayout`, `cancelPayout` and `parseWebhook`.

## Going live checklist

- [ ] Sign with a licensed partner, then fill in the provider adapter (check field names against the partner's docs)
- [ ] Replace dev tokens with Firebase Auth (`verifyIdToken`) in `middleware/auth.js`
- [ ] Replace `store.js` with Firestore or Postgres
- [ ] Charge the card or bank account before calling `createPayout` (see `services/transfers.js`)
- [ ] Use live FX rates from your partner instead of `midRate`
- [ ] Send IDs to a KYC provider, and add sanctions screening and per-user limits
- [ ] Add rate limiting, logging and alerts, and deploy behind HTTPS
