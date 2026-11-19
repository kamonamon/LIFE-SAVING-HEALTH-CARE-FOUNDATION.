# Life Saving Foundation — Relworx integration

The project uses **Relworx Payments** (payments.relworx.com), not Flutterwave.
Existing website design and responsive styles are preserved.

## API integration
Relworx Uganda mobile money collects UGX 500–5,000,000 from MTN or Airtel numbers.
- POST /api/payments/initiate — sends a Relworx payment request. A successful API initiation means **pending**, NOT paid.
- POST /api/payments/verify — checks Relworx status using its internal reference and a server-signed intent, and verifies phone, reference, currency and amount before reporting success.
- GET /api/payments/config — tells the frontend whether payment collection is intentionally enabled.
- POST /api/payments/webhook — validates Relworx-Signature (timestamp + webhook URL + signed fields) and acknowledges the event. It does NOT store transactions or issue receipts.
- /lib/relworx.js — shared API/auth, amount and phone rules, signed-intent helpers.

Unlike Flutterwave, **Relworx mobile money does not return a redirect checkout URL**: the donor approves a prompt on their own phone. The website must never collect a mobile money PIN.

## How to activate
1. The foundation applies for a Relworx business account under its verified legal entity.
2. In the Relworx dashboard, create a business account, obtain its account number, generate an API key, and grant the key access to that business account.
3. Copy .env.example to .env.local and set:
   RELWORX_API_KEY, RELWORX_ACCOUNT_NO, RELWORX_INTENT_SECRET,
   RELWORX_WEBHOOK_KEY, RELWORX_WEBHOOK_URL.
4. Keep RELWORX_ENABLED=false while setting up and testing. **There is no documented separate sandbox endpoint in the official documentation we reviewed**; do not presume test keys are harmless.
5. Only after confirming the provider's test arrangements, merchant permissions, authorized IP requirements, settlement ownership and website disclosures should the owner intentionally set RELWORX_ENABLED=true.
6. For deployment, set the same variables in Vercel Project Settings > Environment Variables and redeploy. Keep secrets server-side and excluded from Git.
7. Configure the exact webhook URL in the Relworx business-account settings. It must exactly match RELWORX_WEBHOOK_URL; trailing slash or query differences invalidate signatures.
8. Verify at least one controlled real/sandbox transaction (depending on Relworx's instructions), pending, decline, duplicate reference, mismatched amounts, timeouts, webhook signatures, and mobile UX before general release.

### Limits and security caveats
- Relworx documents a 5 requests per 10 minutes limit for the same Mobile Money number.
- The verified donor amount is bound to a signed intent for 24 hours; the browser keeps its pending token only in sessionStorage. On another browser or after the token expires, visitors need assistance or the Relworx dashboard. This is a practical, database-free first phase, **not a full payment ledger**.
- This website doesn't persist pending or completed donations. The webhook acknowledges authenticated events, but cannot create durable financial records; use the Relworx merchant dashboard for reconciliation until a transactional database and event processing are implemented.
- Do not enable automatic receipts, subscriptions, memberships, or benefits without persistent and idempotent records.
- Do not issue live payments from the developer's personal credentials.
- Any payment processing requires owner-approved privacy/donation/refund policies and legal/regulatory verification. The advertised insurance programme has separate compliance considerations.

## Local setup
Node.js 20+; npm run dev; visit http://localhost:4173. Use npm run check for mocked payment/backend tests.
No MySQL, Supabase or Firebase connection is required just for the Relworx payment push, but durable finance and donor management should use a database.

## Official references
https://payments.relworx.com/docs
https://payments.relworx.com/docs/mobile_money/request_payment/
https://payments.relworx.com/docs/mobile_money/check_request_status/
https://payments.relworx.com/docs/webhooks/
https://payments.relworx.com/docs/webhooks/authenticate_webhook_requests/
https://payments.relworx.com/docs/FAQs/api_key/

### Vercel outbound IP / account authorization check
Relworx documents an **API Authorized IPs** setting under Edit Business Account. Requests from other IPs may be rejected. Standard Vercel Functions use dynamic outbound IP addresses. Before enabling live payments, confirm with Relworx whether the owner must maintain a fixed allowlist. If so, use an approved static egress IP (for example, compatible server hosting or eligible Vercel static-IP networking) and register that IP with Relworx. Do not guess or whitelist arbitrary IP ranges.

Relworx also requires an API key with permission to access the selected business account; the owner may need to enable UGX transactions. The organization should receive the settlement funds in its own approved account.

Reference: https://payments.relworx.com/docs/FAQs/No%20Authorized%20IP%20Access/

VERCEL COMPATIBILITY UPDATE:
This handoff includes vercel.json (Framework Other, npm run build, output public/), module-based Vercel payment entrypoints api/payments/*.mjs and private payment handlers lib/handlers/*.cjs.
The browser website is generated into public/ at build time. Deploy the whole inner project folder, not only the static public files. Configure the private environment values in Vercel Project Settings and redeploy.
Read VERCEL-DEPLOYMENT.md. The owner's actual Vercel deployment and Relworx account are still untested, and approved outgoing server IP requirements must be resolved before real payments.
