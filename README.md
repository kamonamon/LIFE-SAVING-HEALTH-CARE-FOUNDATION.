# Life Saving Health Care Foundation — Polished Website

The existing teal/rose/white/gray design is preserved. This working copy includes responsive padding and navigation fixes, visible mobile Donate buttons, the calmer event announcement, and a secure provider-facing payment flow.

## Local website (VS Code, Windows)
1. Open this project folder in VS Code.
2. Ensure Node.js 20+ is installed.
3. Run: npm run dev
4. Visit: http://localhost:4173
5. Run: npm run check

## Payments — Relworx (Uganda MTN / Airtel)
See **PAYMENT-SETUP.md** for the full activation checklist.
The earlier Flutterwave code has been replaced by **Relworx Payments** from https://payments.relworx.com/docs.

API routes:
- POST /api/payments/initiate — submits a Relworx mobile money collection request; result is PENDING, not paid.
- POST /api/payments/verify — uses a signed token to check Relworx status against reference, amount, phone and UGX currency.
- GET /api/payments/config — safe public availability flag (no secret fields).
- POST /api/payments/webhook — verifies the documented Relworx signature and acknowledges; it does **not** store transactions.
- lib/relworx.js — shared Relworx API and signed intent helpers.

Set all merchant credentials in server-side environment variables; never commit .env.local. Payment collection is intentionally disabled until RELWORX_ENABLED=true and an API key and business account number are supplied.

**The gateway is implemented but not approved or tested with real Relworx credentials.** Do not launch without merchant authorization, a live controlled test, correct business account permissions, agreement on transaction fees, owner-approved policies, and robust financial reconciliation.

### Hosting warning: Relworx authorized IP addresses
Relworx may require API Authorized IPs to include the backend server's outbound address. Standard Vercel Functions use dynamic outbound IPs. If this restriction applies to the merchant account, discuss approved IP settings with Relworx, or use stable-egress backend hosting/appropriate Vercel networking. Simply adding API keys may not be sufficient. See https://payments.relworx.com/docs/FAQs/No%20Authorized%20IP%20Access/ and https://vercel.com/academy/optimize-your-vercel-account/backend-egress

### No database (initial phase)
The site's status verification uses a signed intent that lasts 24 hours in the browser session. This prevents fake success from a manipulated amount, but **does not provide a permanent donation ledger**. The Relworx dashboard can be used for merchant reconciliation. Automatic receipts, recurring donations and detailed finance reports require reliable persistent records, replay-safe webhooks and idempotent processing.

## UI and quality assurance
- Responsive refinements live in assets/mobile.css and shared behavior in assets/site.js.
- Donate is always accessible from the phone header and bottom action bar.
- The 640px breakpoint previously made medical cards 346–366px tall. The current layout uses much more compact tiles without changing brand colors.
- Mobile drawer stays within the viewport when closed; no overflow-x masking is required.
- The blog health-camp banner declares intrinsic width/height to avoid layout shifts.
- npm run check — offline Relworx fixture tests, no real payments.
- npm run test:browser / npm run test:horizontal / npm run test:padding — browser emulation (Chrome DevTools test instance required).
- node tests/relworx-ui-mock.js — mocked Mobile Money popup progression; never invokes the real provider.

## Pending owner verification before go-live
- Legal entity, registration and business account ownership; licence/insurance claims.
- Public privacy policy, donation/refund terms, and clear accountability content.
- Relworx account approval, UGX collection permission, authorized IPs, verified webhooks.
- Real payment reconciliation, abuse prevention, duplicate processing, and donor support contact.

This folder is a localhost development copy; the public Vercel website was not updated as part of the Relworx switch.

VERCEL COMPATIBILITY UPDATE:
This handoff includes vercel.json (Framework Other, npm run build, output public/), module-based Vercel payment entrypoints api/payments/*.mjs and private payment handlers lib/handlers/*.cjs.
The browser website is generated into public/ at build time. Deploy the whole inner project folder, not only the static public files. Configure the private environment values in Vercel Project Settings and redeploy.
Read VERCEL-DEPLOYMENT.md. The owner's actual Vercel deployment and Relworx account are still untested, and approved outgoing server IP requirements must be resolved before real payments.
