# NOTES — Assumptions & where to change things

## Swap the schema later
Edit ONLY `db/schema.sql`, `db/seed.sql`, `api/_lib/queries.js` (all SQL) and `api/_lib/db.js` (connection).

## Assumptions (simplest reasonable choice)
- One khatian row points to exactly one plot (dag). Joint ownership = several rows in `plot_owners` with `share_pct`.
- Sale/gift/khas replace all current owners with the buyer (100%). Partition: shares must total 100% and every sharer must already be a current co-owner.
- Bayna and POA are recorded (deed + timeline) but do NOT change ownership and create no mutation.
- A Rehen (mortgage) deed also creates an active mortgage for the chosen bank, so a second mortgage is blocked.
- Blocking rules (mortgage, injunction, khas, acquired, pending mutation) are re-checked inside the locked transaction.
- Hash chain: DB trigger `land_events_chain` fills seq/prev_hash/hash; `land_events` is append-only (update/delete raise errors). `verifyChain()` recomputes in SQL.
- Citizen tokens: `/api/citizen/unlock` consumes one use; later requests send header `x-land-token` (a token never unlocked has used_count = 0 and is rejected). Keep the token in sessionStorage; do not re-unlock on every page load.
- Rate limits are stored in the `rate_hits` table (works on serverless).
- Public deed verification shows no personal data (no names/NIDs).
- Demo password for all users: `Demo@1234` (bcrypt via pgcrypto). Demo tokens: LAND-DEMO-1111, LAND-DEMO-2222 (LAND-DEMO-9999 is expired).

## Hooks
- OCR: `api/ocr-check.js` (stub) — plug the Python OCR service there.
- Chatbot: a future `/api/chat` endpoint (UI comes in Phase 5).

## Nagorik Seba (public, no login)
- Content you can edit lives in `js/content-*.js`: `content-deeds.js` (7 deeds), `content-scams.js` (12 scams + shared guidance: documents, offices, hotlines, don'ts, emergency steps, disclaimer), `content-terms.js` (glossary, land types, annotated porcha), `content-checklist.js` (7 checks).
- Adding an object to `SCAMS` or `DEEDS_CONTENT` automatically creates its card, detail view and "what to do" workflow. A checklist item links to scams through `scams: [ids]`.
- The risk check is the 7-point checklist: unticked items decide the level (0 = low, 1-2 = medium, 3+ = high) and the related scam cards.
- Hotline numbers (333, 999, 16122, 16430) are shown with a "verify before use" disclaimer; edit them in `SCAM_COMMON.hotlines`.
- Rapid check sends `multipart/form-data` (`docType`, `files`) to `/api/ocr-check`. Limits (6 images, 2 MB each, 4 MB total) keep the request under Vercel's ~4.5 MB body limit. The stub never reads or stores the bytes.

## Hooks
- OCR: `api/ocr-check.js` — plug the Python OCR service there (read the multipart fields, forward, return fields).
- Chatbot: `LT` help widget in `js/common.js` (`mountHelp`). Set `CHAT_ENDPOINT = '/api/chat'` and add an `api/chat.js` returning `{ ok:true, reply }`; the input and send button then enable themselves.

## Vercel Hobby: 8 functions (limit 12)
`api/*.js` are the only functions; everything under `api/_handlers` and `api/_lib` is bundled into them (folders starting with `_` are never routed).
| Function | URLs served (via `vercel.json` rewrites) |
|---|---|
| `auth.js` | `/api/auth/login`, `/logout`, `/me` |
| `lookup.js` | `/api/geo/:kind`, `/api/khatians`, `/api/people`, `/api/banks` |
| `land.js` | `/api/khatian/:id`, `/api/land/track` |
| `registry.js` | `/api/registry/transfer`, `/mutations` |
| `bank.js` | `/api/bank/mark-loan`, `/release-loan` |
| `citizen.js` | `/api/citizen/unlock` |
| `verify.js` | `/api/verify/:deedNo` |
| `ocr-check.js` | `/api/ocr-check` |
Frontend URLs did not change. Adding a route: handler in `api/_handlers`, one line in a dispatcher, one rewrite, then `npm run check`. See `DEPLOY.md`.

## Tooling
- `npm run check` — function count (fails above 12), rewrites -> files, every `/api/...` URL used by the frontend is served, JS syntax.
- `npm test` — 86 API checks on an in-process Postgres (PGlite): login/roles, blocking rules, all 7 deed types, auto mutation, hash chain, loans, citizen token gate, rate limit. The connection layer is swapped only in a temp copy.
- `npm run db:setup | db:reset | db:check` — create/reset/inspect the Neon database (`DATABASE_URL_UNPOOLED` is preferred when present).
- `npm run smoke -- <url>` — read-only live check after each deploy.
Not covered by tests: true concurrent transfers (rely on `SELECT ... FOR UPDATE` on Neon) and the Neon HTTP/WebSocket drivers themselves.
