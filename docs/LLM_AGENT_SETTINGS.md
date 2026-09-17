# LLM and agent profile settings - 2026-09-17

Frontend/backend 0.3.0 build on their instruction-versioning branches; main does
not yet include all deployed fixes. No new dependencies. The settings menu adds
LLM and Perfil do agente. Existing prompt editors/history remain unchanged.

The forms use the existing managed Assistant resolver, admin graph connection,
versioned save/read-back helper and toast. Settings are scoped to the selected
Assistant and are sent to the managed graph on subsequent runs. Names apply to
model presentation, not a rename of the app or technical Assistant identifier.

Validation covers temperature zero, invalid ranges, read-back, version advancement,
reload, profile fields, preservation of other context, clearing overrides and
failed saves on desktop/mobile. Backend protocol tests exercise an actual graph
tool loop against intercepted HTTP (not live inference). Do not interpret these
checks as a new adherence benchmark or a guarantee of exact output.

Local checks passed: production webpack build, TypeScript and ESLint (zero errors,
25 existing warnings); 16 existing browser/unit regression cases and both new
desktop/mobile scenarios passed. Frontend coverage percentage was not measured.

Publication is pending the separate Railway rollout. Deploy backend 0.3.0 first;
older backends return an error rather than letting these forms report a valid save.
Follow the backend deployment guide for backups and preserved conversation state.
Published validation should use a disposable Assistant, leaving the operator's
current prompts/profile/sampling unchanged.

Rollback both services to their previous deployments, retaining the existing
volume and Assistant history. Older runtimes ignore the new context fields.
