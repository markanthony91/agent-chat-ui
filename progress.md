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
## Tool usage details — 0.1.4

- Reuse Tools panel to display actual model descriptions and public parameters.
- Read-only disclosure; existing enable/disable behavior preserved.
- Typecheck/build pass; targeted lint has no errors and one existing effect warning.
- Nine browser tests pass: name/header regression plus tool details at three widths,
  keyboard disclosure, legacy backend, error response, no execution operations.
- Local UI against published backend 0.2.3 verified eleven real descriptions/schemas,
  zero page errors and only list_tools. First attempt hit a stopped local server;
  retry after restarting that test server passed. No real LLM calls.
- Published source 785c595 / frontend 0.1.4, Railway deployment
  1d976f00-d066-4abb-9bfb-e5c2a142df65 (SUCCESS), container version confirmed.
- Nine browser tests pass against published UI with mocked API. A separate live
  backend/UI inspection verifies all eleven schemas and descriptions, zero page
  errors, only list_tools, no tool execution or setting changes.

## Agente Zerai — 0.1.3

- Rename visible chat/connection titles and page metadata; runtime unchanged.
- Stacked on the published header-settings branch to preserve current UI.
- Typecheck/build pass; targeted lint has zero errors and four pre-existing
  warnings. Six browser checks pass at 1440/1024/390px (empty and active chat),
  checking visible name, page title, settings and horizontal overflow.
- Published source c5dd9c1 / frontend 0.1.3 as deployment
  572bf1d5-0fa5-4b18-80ee-870ab30bf61f (SUCCESS). Name also verified in 0.1.4.

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
