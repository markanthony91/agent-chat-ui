# Instruction versioning - 2026-09-16

Frontend 0.2.0 builds on the deployed 0.1.9 branch, retaining managed assistant,
dataset search and previous runtime fixes. Backend 0.2.7 builds on deployed 0.2.6.

System Prompt and Agent Instructions reuse native Assistant versions; no history
is stored in localStorage or copied into the model context. Save reads fresh
context, patches only edited fields, reads back, and confirms the returned
version exists in history. Native simultaneous edits remain last-writer-wins;
a changed version during confirmation is reported as unconfirmed, not success.
The history displays complete Assistant snapshot version numbers (including
saves of other settings). Missing overrides are identified as default content;
repository defaults from the past cannot be reconstructed from those records.
Restoration copies only the selected field into the editor and needs Save.

RAW history is atomic at /data/okf/raw/agents_versions.json; the first save
preserves the exact legacy AGENTS.md/default as v1 with its capture timestamp.
The latest record is the authoritative active RAW instruction. The legacy file
is retained. Histories are paginated by 20; none are silently discarded.

Local validation: 135 Python unit tests, 86% overall backend coverage, 90% RAW
compiler coverage; Ruff, TypeScript, production webpack build and ESLint (0 errors,
25 existing warnings). 25 browser/unit cases passed against the production build,
covering desktop/mobile, history, restore, reload and rejected saves and Workflow save feedback. Development-server HMR/origin issues were avoided
by testing the production build. Toasts are placed at the top with a close button
to avoid covering Save controls. Frontend coverage percentage was not measured.

Backup before rollout: /data/backups/pre-instruction-versions-20260916T194309Z,
31 conversation exports, 4 assistants and histories, 4148 Markdown hashes, volume
archive SHA-256 e196fc794327543a3c4c8d9b94e6c98adcee3824b09f72d4f416bebcdb0c5f2e.
No prompt content or conversation exports belong in Git.

Rollback: frontend can return to deployment 7ffa2304-1181-4669-83b2-ff6101b0a968.
Backend can return to d3a3f10a-84b8-465a-a006-2bf3299927c7, but it reads the
legacy RAW AGENTS.md: export the desired latest RAW history content to that file
atomically before using the old backend, retaining history and backup.
Keep the existing managed assistant, /data and one replica. LangGraph dev's
periodic persistence and abrupt-host-failure limitation remain unchanged.

Backend publication: 7eb7e7ab-4907-4e58-8d5e-ee601e33fd20 SUCCESS, installed
0.2.7 verified by SSH. All 31 conversation exports, managed Assistant context and
version, and 4148 Markdown hashes match the pre-deploy backup.

Frontend publication: f1430cd8-8194-4e41-bed6-7b4821fdd111 SUCCESS, source
b93cbe7, installed 0.2.0 verified by SSH. The published browser check passed in
20.9 seconds: disposable Assistant versions 1-4, prompt/instruction saves, history
preview, restoration as a new version, reload, and preservation of other fields.
The disposable Assistant was deleted after validation. The global RAW editor
saved identical content, retained v1, created v2, and reloaded the same content.
The managed Assistant context remained unchanged; no browser JavaScript errors.

PRs: frontend https://github.com/markanthony91/agent-chat-ui/pull/14 and backend
https://github.com/markanthony91/simple-agent-template/pull/11. Both target the
previously deployed dataset-content-search branches, retaining the published
fixes not yet integrated into main. Railway publication used the tested branches.

## Workflow history - 2026-09-22

Frontend 0.5.1 extends the same native Assistant history to each saved Workflow.
The selected Workflow shows the current Assistant version, historical content
and restoration into the editor. Restoration remains explicit: loading history
does not change the runtime until the operator clicks Save, which creates and
confirms a new Assistant version while preserving other context fields. Create,
activate, deactivate and remove operations also report their confirmed version.

The workflow content itself remains in Assistant storage and is not committed to
Git. The rollout uses the existing managed Assistant and requires read-back of
`workflows`, `active_workflow_id` and `active_workflow` before success is reported.
