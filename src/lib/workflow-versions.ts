import { Client } from "@langchain/langgraph-sdk";

export type WorkflowMap = Record<string, string>;
export type WorkflowVersionMap = Record<string, number>;
export type WorkflowRevision = {
  version: number;
  created_at: string;
  content: string;
};
type AssistantVersionRecord = {
  version: number;
  created_at: string;
  context?: unknown;
};

function contextMap(
  assistant: AssistantVersionRecord,
  field: "workflows" | "workflow_versions",
): Record<string, unknown> {
  const value = (assistant.context as Record<string, unknown> | undefined)?.[
    field
  ];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadAllAssistantVersions(
  client: Client,
  assistantId: string,
): Promise<AssistantVersionRecord[]> {
  const records: AssistantVersionRecord[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await client.assistants.getVersions(assistantId, {
      limit,
      offset,
    });
    records.push(...page);
    if (page.length < limit) return records;
  }
}

export function workflowRevisions(
  records: AssistantVersionRecord[],
  workflowId: string,
): WorkflowRevision[] {
  const revisions: WorkflowRevision[] = [];
  let previous: string | undefined;
  let present = false;
  for (const record of [...records].sort((a, b) => a.version - b.version)) {
    const content = contextMap(record, "workflows")[workflowId];
    if (typeof content !== "string") {
      present = false;
      previous = undefined;
      continue;
    }
    if (present && content === previous) continue;
    const storedVersion = contextMap(record, "workflow_versions")[workflowId];
    revisions.push({
      version:
        typeof storedVersion === "number" && storedVersion > 0
          ? storedVersion
          : (revisions.at(-1)?.version ?? 0) + 1,
      created_at: record.created_at,
      content,
    });
    present = true;
    previous = content;
  }
  return revisions;
}

export function workflowVersionMap(
  records: AssistantVersionRecord[],
  workflows: WorkflowMap,
): WorkflowVersionMap {
  return Object.fromEntries(
    Object.keys(workflows).map((id) => [
      id,
      workflowRevisions(records, id).at(-1)?.version ?? 1,
    ]),
  );
}

export function advanceWorkflowVersions(
  currentWorkflows: WorkflowMap,
  nextWorkflows: WorkflowMap,
  currentVersions: WorkflowVersionMap,
): WorkflowVersionMap {
  return Object.fromEntries(
    Object.entries(nextWorkflows).map(([id, content]) => [
      id,
      currentWorkflows[id] === undefined
        ? 1
        : currentWorkflows[id] === content
          ? (currentVersions[id] ?? 1)
          : (currentVersions[id] ?? 1) + 1,
    ]),
  );
}
