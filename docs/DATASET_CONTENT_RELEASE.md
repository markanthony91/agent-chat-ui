# Dataset content search - published validation

2026-09-15: frontend 0.1.9, app source f54cbbc.
Railway deployment 7ffa2304-1181-4669-83b2-ff6101b0a968: SUCCESS;
container package version independently confirmed.
Backend 0.2.6, app source 1168772,
deployment d3a3f10a-84b8-465a-a006-2bf3299927c7: SUCCESS.

## Checks

- TypeScript and production webpack build passed; lint had no errors
  (25 warnings in the existing codebase).
- 21 unit/browser checks passed locally and against the published JavaScript.
  These regression checks use synthetic mocked APIs, including save failures,
  slow search responses, content-only searches, accents and type filters.
- Separate real published UI/backend checks at 1440 and 390 pixels:
  469 documents loaded; CPF returned 8 body matches absent from filenames/titles;
  exact document preview opened. No JavaScript errors or horizontal overflow.
  The root chat URL required no connection setup.
- Search visible latency: 3,849 ms desktop; 3,840 ms mobile. These are individual
  samples including debounce, browser, network and backend, not LLM benchmarks.
- Backend: 133 unit tests passed, 86% overall coverage, 96% new catalog coverage.
- All 469 published Markdown documents matched the pre-deploy archive.
- Recovered System Prompt remained intact after restart and backend deployment;
  25 conversation states matched the pre-deploy backup.

The tree shows source-declared types and titles, not semantic approval.
Search is literal text, not semantic/vector search. Published documents are
read-only. No financial tools or source content were changed.

Known independent issue: the original saved System Prompt contains a customer
name placeholder which the LLM echoed in a separate conversation test. Its text
was restored exactly, not rewritten as part of persistence or Dataset changes.

Runtime release details and rollback:
https://github.com/markanthony91/simple-agent-template/blob/feat/dataset-content-search/docs/DATASET_SEARCH_2026-09-15.md
