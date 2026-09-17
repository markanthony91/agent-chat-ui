# LLM and agent profile settings - 2026-09-17

Frontend/backend 0.3.0 build on their instruction-versioning branches; main does
not yet include all deployed fixes. No new dependencies. The settings menu adds
LLM and Perfil do agente. Existing prompt editors/history remain unchanged.

The LLM tab also exposes sanitized integration metadata and selects primary and
fallback connections (server, Lovable Gemini/GPT, other OpenAI-compatible).
Endpoint/model/key registration stays in server variables. Missing connections
are disabled; the form does not claim they are operational merely because a
configuration exists. The dedicated Lovable bridge source lives in the backend
repo and still needs separate deployment/credential configuration and live E2E.

The forms use the existing managed Assistant resolver, admin graph connection,
versioned save/read-back helper and toast. Settings are scoped to the selected
Assistant and are sent to the managed graph on subsequent runs. Names apply to
model presentation, not a rename of the app or technical Assistant identifier.

Validation covers temperature zero, invalid ranges, read-back, version advancement,
reload, profile fields, preservation of other context, clearing overrides and
failed saves on desktop/mobile, including persistence of fallback selection and
disabled unconfigured connections. Backend protocol tests exercise an actual graph
tool loop against intercepted HTTP (not live inference). Do not interpret these
checks as a new adherence benchmark or a guarantee of exact output.

Local checks passed: production webpack build, TypeScript and ESLint (zero errors,
25 existing warnings); 16 existing browser/unit regression cases and both new
desktop/mobile scenarios passed. Frontend coverage percentage was not measured.

Railway 0.3.0 was published on 2026-09-17 with explicit deployment-only approval.
Backend deployment: `bcdffb85-71cf-4906-b058-0408ba2b806f`. Frontend deployment:
`5962ca83-8fd3-47a7-9caa-8201b7197d22`, source `d0ef04f`. Both SUCCESS; installed
versions verified by SSH. Optional provider activation remains exclusively Marcelo's
action. Lovable bridge was not deployed and no optional credentials were configured.

Published browser validation passed in 24.6 seconds with a disposable Assistant:
saved zero temperature and profile, created/confirmed versions 1-3, reloaded,
checked desktop/mobile layout, kept fallback off/unconfigured options disabled,
and made a real Qwen utc_now tool call. The model recognized the configured name
on an explicit follow-up. No browser JavaScript errors; managed Assistant remained
unchanged. Disposable Assistant and its conversation were deleted.

Behavioral limit: the initial stricter probe failed because Qwen answered the time
without spontaneously introducing itself as Sofia. That finding is retained; the
functional test now records spontaneous introduction separately and requires the
explicit name check. This release does not guarantee automatic self-introduction
or full prompt adherence.

For subsequent rollouts, deploy backend 0.3.0 first;
older backends return an error rather than letting these forms report a valid save.
Follow the backend deployment guide for backups and preserved conversation state.
Published validation should use a disposable Assistant, leaving the operator's
current prompts/profile/sampling unchanged.

Rollback both services to their previous deployments, retaining the existing
volume and Assistant history. Older runtimes ignore the new context fields.
