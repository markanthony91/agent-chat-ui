# Runtime audit fixes

- Workflow editor 0.6.2: each Workflow file now has an independent persisted
  revision counter used by its sidebar badge, save feedback and filtered history.

- Workflow editor 0.6.1: Markdown upload moved beside New and the redundant
  Assistant version label is hidden while version history remains available.

- Instruction editors 0.6.0: System Prompt and Agent Instructions now support
  highlighted search, Enter navigation and automatic scrolling to each match.

- Workflow editor 0.5.5: Enter scrolls the editor to keep the active search
  occurrence visible without moving focus away from the search field.

- Workflow editor 0.5.4: Enter keeps focus in the workflow search and advances
  through matches without changing the document.

- Workflow editor 0.5.3: persistent Markdown upload named from the file,
  per-document version badges, yellow match highlighting and Enter navigation.

- Workflow editor 0.5.2: full-screen editing and in-content search with previous
  and next occurrence navigation.

- Dataset 0.1.7: nested folder navigation and in-panel normalized name/path filter.
- Browser regression includes nested disclosure, keyboard, preview paths, empty
  results, accent-insensitive matching, case-sensitive folder identities and errors.
- Fifteen local browser cases pass at 1440/1024/390 widths. Typecheck/build pass;
  targeted lint has zero errors and one pre-existing effect warning.
- Published frontend 0.1.7, source 3323535, successful Railway deployment
  d44da267-8cdb-4113-a87e-e06567ccbfc6; container version verified directly.
- Fifteen published Playwright cases pass (mocked API), plus separate real-backend
  browser validation: 469 files, Aurora filter returns 18, INSTITUTIONS expands
  banco-aurora-demo/fastpay/usedigi; exact index preview opens, zero JS errors.
  Sizes 1440/1024/390 verified. Only list/list_drafts/list_versions/read called.
- No backend, document or snapshot change. Filter searches names/paths, not bodies.
- Rollback: frontend 0.1.6 deployment ebf30064-72a2-419f-8742-7ba605da20f1;
  preserve connection environment variables and the backend unchanged.

- Published 0.1.6 / 914aeb1: deployment ebf30064-72a2-419f-8742-7ba605da20f1.
  Dataset and persisted identity controls verified with real backend in Chromium.
  Twelve published browser cases also pass (mocked API); no JS errors in live inspection.
  Backend 0.2.5 / 4cc6424 successfully validates partial CPF + name with Qwen.

- Requested follow-up: rename Knowledge tab/title to Dataset (0.1.6), no data migration.

- Identity configuration 0.1.5: native controls in the existing Simulator panel.
- 12 local Playwright cases passed at 1440/1024/390 widths, including save/reload,
  errors, tool-contract panel and header regressions. API mocked in these cases.
- Typecheck and build pass; targeted lint zero errors, one pre-existing effect warning.
- Publication and real-backend browser verification pending.

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

## Instruction versions (0.2.0)

- [x] Native Assistant version history, previews and restoration into the editor.
- [x] Version-confirmed saves and success feedback in all Save-button panels.
- [x] RAW AGENTS.md atomic persistent history through backend 0.2.7.
- [x] Published frontend/backend; live save/history/restore/reload passed, existing data preserved.
- Evidence: `docs/INSTRUCTION_VERSIONS.md`.
