# Persistent assistant configuration - 2026-09-15

## Root cause

The published LangGraph dev runtime removes assistants marked
`metadata.created_by=system` during startup and recreates graph defaults with
empty context. The editor wrote to that default assistant. Version history
survived, but active System Prompt configuration did not. Conversation checkpoints
and volume persistence alone did not prevent this behavior.

## Correction

Use the native regular assistant record, marked `metadata.zerai_default=true`,
for the agent graph. The chat and all three instruction editors share one
resolver. Graph aliases resolve this record; explicit UUIDs remain exact.
Multiple managed defaults are rejected rather than selecting arbitrarily.
The graph filter in conversation history remains unchanged to retain old threads.

Saves read current context, update only the edited fields, and read back the
result. They reject system-created assistants. This prevents older open panels
from overwriting unrelated fields; simultaneous writes are still last-writer-wins
because the native API has no compare-and-swap in this flow.

## Recovery performed

Recovered the original 21,329-character System Prompt from the system assistant's
version 2 (2026-09-15 18:14:39 UTC), preserving all context fields exactly.

- Original assistant: `fe096781-5601-53d2-b2f6-0d3403f7e9ca`.
- Persistent assistant: `dd5766a7-2237-5e12-b949-7236c459698c`.
- Prompt SHA-256: `684cdcb76a886852d96e4ec2b2c64afa58dacdba2691b43183ac3d2ba2815174`.
- Private backup: `/data/backups/pre-persistent-assistant-20260915T202306Z`.
- Backup includes assistant history, 24 conversation state exports and volume archive.
- Archive SHA-256: `ea4b5bc75227d4702062eb4adfa8c6b09657944a512c556f3121ea29684a3d09`.

No prompt text, customer fixture or credentials are copied into this repository.
Do not send both `config.configurable` and `context` when creating the recovered
record: this API mirrors these fields on reads but rejects both in one request.
Keep other config keys and use context as the canonical recovery input.

## Checks and operating limits

Local checks: TypeScript, production webpack build, lint (existing warnings), and
21 unit/browser cases including save/reload, graph alias/UUID, read-back failure,
system-edit refusal, and Dataset/identity/tool UI regressions. Browser APIs are
mocked in that suite. Published checks and restart evidence are recorded separately.
Local Turbopack cannot build with the worktree's external node_modules symlink;
the webpack build validates the same source without changing project dependencies.

No backend runtime code or financial/security logic was changed. Retain the
single Railway replica, /data volume, exec start command and graceful shutdown.
Native dev persistence flushes periodically (10 seconds in the installed version);
this fix is not a new transactional database or a guarantee against abrupt host
failure between flushes. Test planned restarts only after backups and no busy runs.

Rollback: keep the managed assistant and backup. Rolling back the frontend alone
returns graph-name chat to the system assistant, so use the persistent UUID in
the chat URL until the corrected frontend is restored. Old frontend editors do
not support UUID lookup correctly. Never overwrite the recovered record with an
empty default and never remove the Railway volume.
