# Runtime audit fixes

- [x] One backend connection for chat, OKF, tools and RAW.
- [x] Explicit approval for publish/activate/import.
- [x] Decimal strings and per-conversation identity explanation in simulator.
- [x] Offer confirmation bound to actual user message and offer ID.
- [x] Native streamed messages, reconnect and provider cancellation checks.
- [x] TypeScript, lint (no errors), optimized build and local browser journeys.
- [x] Authorized Railway publication: deployment 4e662b1a-1927-47cc-aeae-5f9b8b4be0c2,
  package 0.1.0; real Qwen tool smoke and browser reload passed (2026-09-14).
- [ ] Validate journeys and latency with the real configured Qwen endpoint.

## Candidate 0.1.1 — post-stream diagnostics

- [x] Render optional response_audit metadata beside the original streamed text.
- [x] Explain that numeric checks are not semantic approval or pre-display protection.
- [x] Warning survives reload, without duplicate messages; 10 local Playwright tests pass.
- [x] Local TypeScript and optimized webpack build pass; lint: zero errors, 24 existing warnings.
- [ ] Publish this candidate and validate its UI against the deployed backend.
