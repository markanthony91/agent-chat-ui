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
## Authorized rollout — 2026-09-15

- Configure the existing NEXT_PUBLIC_API_URL / NEXT_PUBLIC_ASSISTANT_ID defaults
  at build time so a clean browser opens the intended chat without setup.
- Model selection remains server-side. No credentials or conversation IDs in
  the shared root link; anonymous operator controls remain a lab limitation.
- Typecheck/build pass; lint has zero errors and 24 existing warnings. Frontend
  e44769f / 0.1.1 published as e00a7b4f-4d98-4cb0-88bf-9f4ba8251247.
- Published clean-browser Qwen smoke passed: root without setup/key, UTC and OKF
  tools, post-stream audit, history/reload, zero page errors and three widths.
  First visible text 3958 ms, total first turn 4153 ms (single UTC scenario).
  The deployed model was Qwen/Qwen3-30B-A3B-Instruct-2507-FP8 from backend 0.2.2.
## Header settings — 0.1.2

- Replace both header GitHub links with the existing settings action and remove
  the floating trigger. Panel remains mounted at page level to preserve its state.
- Stacked on the published OKF branch; no backend changes. Typecheck/build pass;
  changed-file lint has zero errors and two existing ref warnings. Six browser
  checks pass (empty/active chat at 1440, 1024 and 390 widths), including keyboard
  activation and panel close.
- Published frontend source 068e974 as deployment
  8670d040-adb0-4c62-8527-229a69c25698 (SUCCESS); container version 0.1.2
  confirmed. The same six browser checks pass against the published UI with
  mocked runtime responses (no LLM calls or production configuration writes).
- PR: https://github.com/markanthony91/agent-chat-ui/pull/7.
