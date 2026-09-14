# Runtime integration changes (0.1.0)

Companion backend: simple-agent-template 0.2.0, branch fix/runtime-audit-six-items.

- Chat, OKF administration, simulator and RAW use the same apiUrl / NEXT_PUBLIC_API_URL.
  Removed hardcoded production admin URL and separate okfApiUrl override.
- Publishing, importing a full bundle and rollback require explicit confirmation.
  New clients send approved=true only following that confirmation.
- Monetary fixture fields remain decimal strings. Only installment count is numeric.
- Fixture edits affect NEW conversations. Global Identity Validated checkbox removed:
  only backend tools establish verification in the current server thread.
- Offers expose a confirmation card bound to offer_id, including the full exact
  installment schedule. It remains available with debug tool calls hidden.
- Chat requests messages and values. SDK reconnectOnMount tracks the run ID so
  Cancel cancels on the server; session storage supports reconnect on reload.
- Reuse native LangGraph streaming and history; no fake typing or custom tokenizer.

Commands: pnpm typecheck; pnpm lint; pnpm build; pnpm test:e2e.
Browser tests target loopback ONLY and require the backend's synthetic protocol
fixture. See its docs/VALIDATION.md for setup and measured/untested boundaries.

No Railway or Lovable publication is represented by this local branch. Existing
ESLint warnings and Tailwind configuration warning are not claimed resolved.
Authentication remains the existing operator-lab behavior; confirmation dialogs
are not access controls. Do not configure real debtor data in this anonymous lab.

Validation on 2026-09-14: 9 Playwright tests passed against the local LangGraph API
and synthetic OpenAI-compatible streaming fixture. Three journeys (happy, negative,
neutral), cancellation observed at provider, incomplete-response error, sequential
turns, simulator save/document preview and 1440x900, 1024x768, 390x844 layouts.
Latest long-response sample: first visible text 1045 ms, final marker 3975 ms.
These timings do not measure the real Qwen model or claim a before/after gain.
