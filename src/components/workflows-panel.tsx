"use client";

import { toast } from "sonner";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { InstructionHistory } from "@/components/instruction-history";
import { getApiKey } from "@/lib/api-key";
import { resolveAssistant, saveAssistantContext } from "@/lib/assistant-config";

type WorkflowMap = Record<string, string>;

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    assistantId:
      params.get("assistantId") ||
      process.env.NEXT_PUBLIC_ASSISTANT_ID ||
      "agent",
    apiKey: getApiKey() || undefined,
  };
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "workflow"
  );
}

function workflowVersion(id: string, content: string): string {
  const declared = content.match(
    /\bvers(?:ã|a)o\s*:\s*v?(\d+(?:\.\d+)*)/i,
  )?.[1];
  const filename = id.match(/(?:^|[_.-])v(\d+(?:\.\d+)*)(?=[_.-]|$)/i)?.[1];
  return `V${declared ?? filename ?? "1"}`;
}

export function WorkflowsPanel(): React.ReactNode {
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowMap>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(-1);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedSaved = selectedId ? (workflows[selectedId] ?? "") : "";
  const ids = useMemo(() => Object.keys(workflows).sort(), [workflows]);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return [];
    const source = draft.toLocaleLowerCase("pt-BR");
    const found: number[] = [];
    for (
      let position = source.indexOf(needle);
      position >= 0;
      position = source.indexOf(needle, position + needle.length)
    )
      found.push(position);
    return found;
  }, [draft, query]);
  const highlightedDraft = useMemo(() => {
    if (!matches.length) return draft;
    const length = query.trim().length;
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    matches.forEach((start, index) => {
      parts.push(draft.slice(cursor, start));
      parts.push(
        <mark
          key={`${start}-${index}`}
          data-active={index === matchIndex || undefined}
          className={
            index === matchIndex
              ? "rounded-sm bg-amber-400 text-inherit"
              : "rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-600"
          }
        >
          {draft.slice(start, start + length)}
        </mark>,
      );
      cursor = start + length;
    });
    parts.push(draft.slice(cursor));
    return parts;
  }, [draft, matchIndex, matches, query]);

  useEffect(() => {
    if (!fullscreen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [fullscreen]);

  const selectMatch = (nextIndex: number) => {
    if (!matches.length) return;
    const index = (nextIndex + matches.length) % matches.length;
    const start = matches[index];
    setMatchIndex(index);
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(start, start + query.trim().length);
      searchRef.current?.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        if (!highlightRef.current) return;
        highlightRef.current.scrollTop = editor.scrollTop;
        highlightRef.current.scrollLeft = editor.scrollLeft;
      });
    });
  };

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const { apiUrl, assistantId, apiKey } = getConnection();
      if (!apiUrl) throw new Error("Deployment URL não configurada.");
      const client = new Client({ apiUrl, apiKey });
      const record = await resolveAssistant(client, assistantId);
      const context = (record.context ?? {}) as Record<string, unknown>;
      const remote =
        context.workflows && typeof context.workflows === "object"
          ? (context.workflows as WorkflowMap)
          : {};
      const active =
        typeof context.active_workflow_id === "string"
          ? context.active_workflow_id
          : null;
      setAssistant(record);
      setWorkflows(remote);
      setActiveId(active);
      const first =
        active && remote[active] ? active : (Object.keys(remote)[0] ?? null);
      setSelectedId(first);
      setDraft(first ? (remote[first] ?? "") : "");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao carregar workflows.",
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateContext = async (
    nextWorkflows: WorkflowMap,
    nextActiveId: string | null,
  ) => {
    if (!assistant) return null;
    const { apiUrl, apiKey } = getConnection();
    const client = new Client({ apiUrl, apiKey });
    const activeWorkflow = nextActiveId
      ? (nextWorkflows[nextActiveId] ?? "")
      : "";
    const updated = await saveAssistantContext(client, assistant.assistant_id, {
      workflows: nextWorkflows,
      active_workflow_id: nextActiveId,
      active_workflow: activeWorkflow,
    });
    setAssistant(updated);
    setWorkflows(nextWorkflows);
    setActiveId(nextActiveId);
    return updated;
  };

  const create = async () => {
    const id = slug(newName);
    if (!newName.trim()) return;
    if (workflows[id]) {
      setError("Já existe um workflow com esse identificador.");
      return;
    }
    const template = `# ${newName.trim()}\n\n## Objetivo\n\nDescreva o objetivo do processo.\n\n## Etapas\n\n1. Defina a primeira etapa.\n2. Defina a próxima etapa.\n\n## Gates obrigatórios\n\n- Registre aqui validações que não podem ser puladas.\n`;
    const next = { ...workflows, [id]: template };
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateContext(next, activeId);
      setSelectedId(id);
      setDraft(template);
      setNewName("");
      setMessage(`Workflow criado · versão ${updated?.version}.`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao criar workflow.",
      );
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!selectedId || !draft.trim()) return;
    const next = { ...workflows, [selectedId]: draft };
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateContext(next, activeId);
      setMessage(`Workflow salvo · versão ${updated?.version}.`);
      toast.success("Salvo com sucesso", {
        description: `Workflow · versão ${updated?.version}`,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao salvar workflow.",
      );
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!file.name.toLowerCase().endsWith(".md"))
        throw new Error("Selecione um arquivo .md.");
      const content = await file.text();
      if (!content.trim()) throw new Error("O arquivo Markdown está vazio.");
      const next = { ...workflows, [file.name]: content };
      const updated = await updateContext(next, activeId);
      setSelectedId(file.name);
      setDraft(content);
      setQuery("");
      setMatchIndex(-1);
      setMessage(`${file.name} salvo · versão ${updated?.version}.`);
      toast.success("Salvo com sucesso", {
        description: `${file.name} · ${workflowVersion(file.name, content)}`,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao carregar workflow.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const activate = async (id: string | null) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateContext(workflows, id);
      setMessage(
        `${id ? `Workflow ${id} ativado` : "Workflow ativo removido"} · versão ${updated?.version}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao ativar workflow.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    const next = { ...workflows };
    delete next[selectedId];
    const nextActive = activeId === selectedId ? null : activeId;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateContext(next, nextActive);
      const first = Object.keys(next)[0] ?? null;
      setSelectedId(first);
      setDraft(first ? (next[first] ?? "") : "");
      setMessage(`Workflow removido · versão ${updated?.version}.`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao remover workflow.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[60] overflow-y-auto bg-white p-5 dark:bg-neutral-950"
          : "p-5"
      }
    >
      <div>
        <h3 className="font-semibold">Workflows</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Guias processuais agentic. O workflow ativo entra no prompt do runtime
          sem criar router determinístico.
        </p>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Nome do novo workflow"
          className="min-w-[220px] flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
        />
        <button
          onClick={() => void create()}
          disabled={busy || !newName.trim()}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Novo
        </button>
      </div>
      <div
        className={`mt-5 grid gap-4 md:grid-cols-[240px_1fr] ${fullscreen ? "min-h-[calc(100vh-10rem)]" : ""}`}
      >
        <div className="rounded-xl border p-2">
          {ids.map((id) => (
            <button
              key={id}
              onClick={() => {
                setSelectedId(id);
                setDraft(workflows[id] ?? "");
                setQuery("");
                setMatchIndex(-1);
                setMessage(null);
              }}
              className={`mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${selectedId === id ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}
            >
              <span className="min-w-0 truncate">{id}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100">
                  {workflowVersion(id, workflows[id] ?? "")}
                </span>
                {activeId === id && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
              </span>
            </button>
          ))}
          {ids.length === 0 && (
            <p className="p-3 text-sm text-neutral-500">
              Nenhum workflow criado.
            </p>
          )}
        </div>
        <div className="rounded-xl border">
          {selectedId ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                <div>
                  <p className="font-mono text-sm font-semibold">
                    {selectedId}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {activeId === selectedId ? "Ativo no runtime" : "Inativo"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".md,text/markdown"
                    aria-label="Arquivo Markdown do workflow"
                    className="hidden"
                    onChange={(event) => void upload(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    <Upload className="h-4 w-4" />
                    Carregar .md
                  </button>
                  <button
                    type="button"
                    onClick={() => setFullscreen((value) => !value)}
                    className="rounded-lg border p-2"
                    aria-label={
                      fullscreen
                        ? "Sair da tela cheia"
                        : "Ver workflow em tela cheia"
                    }
                    title={
                      fullscreen ? "Sair da tela cheia" : "Ver em tela cheia"
                    }
                  >
                    {fullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </button>
                  {activeId === selectedId ? (
                    <button
                      onClick={() => void activate(null)}
                      disabled={busy}
                      className="rounded-lg border px-3 py-1.5 text-sm"
                    >
                      Desativar
                    </button>
                  ) : (
                    <button
                      onClick={() => void activate(selectedId)}
                      disabled={busy}
                      className="rounded-lg border px-3 py-1.5 text-sm"
                    >
                      Ativar
                    </button>
                  )}
                  <button
                    onClick={() => void remove()}
                    disabled={busy}
                    aria-label="Excluir workflow"
                    className="rounded-lg border px-3 py-1.5 text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {assistant && (
                <div className="px-3">
                  <InstructionHistory
                    key={`${assistant.assistant_id}:${assistant.version}:${selectedId}`}
                    assistantId={assistant.assistant_id}
                    field="workflows"
                    workflowId={selectedId}
                    version={assistant.version}
                    disabled={busy}
                    onSelect={setDraft}
                  />
                </div>
              )}
              <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-neutral-500" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setMatchIndex(-1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      selectMatch(
                        event.shiftKey
                          ? matchIndex < 0
                            ? matches.length - 1
                            : matchIndex - 1
                          : matchIndex + 1,
                      );
                    }
                  }}
                  aria-label="Buscar no workflow"
                  placeholder="Buscar no workflow"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                <span className="shrink-0 text-xs text-neutral-500">
                  {query.trim()
                    ? matches.length
                      ? matchIndex >= 0
                        ? `${matchIndex + 1} de ${matches.length}`
                        : `${matches.length} ${matches.length === 1 ? "resultado" : "resultados"}`
                      : "0 resultados"
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    selectMatch(
                      matchIndex < 0 ? matches.length - 1 : matchIndex - 1,
                    )
                  }
                  disabled={!matches.length}
                  aria-label="Ocorrência anterior"
                  className="rounded p-1 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => selectMatch(matchIndex + 1)}
                  disabled={!matches.length}
                  aria-label="Próxima ocorrência"
                  className="rounded p-1 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="relative">
                {matches.length > 0 && (
                  <pre
                    ref={highlightRef}
                    data-testid="workflow-highlight-layer"
                    aria-hidden="true"
                    className={`${fullscreen ? "min-h-[calc(100vh-20rem)]" : "min-h-[48vh]"} pointer-events-none absolute inset-0 overflow-hidden p-4 font-mono text-sm leading-6 break-words whitespace-pre-wrap`}
                    style={{ scrollbarGutter: "stable" }}
                  >
                    {highlightedDraft}
                    {draft.endsWith("\n") ? " " : null}
                  </pre>
                )}
                <textarea
                  ref={editorRef}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setMatchIndex(-1);
                  }}
                  onScroll={(event) => {
                    if (!highlightRef.current) return;
                    highlightRef.current.scrollTop =
                      event.currentTarget.scrollTop;
                    highlightRef.current.scrollLeft =
                      event.currentTarget.scrollLeft;
                  }}
                  spellCheck={false}
                  style={{ scrollbarGutter: "stable" }}
                  className={`${fullscreen ? "min-h-[calc(100vh-20rem)]" : "min-h-[48vh]"} relative w-full resize-y bg-transparent p-4 font-mono text-sm leading-6 outline-none ${matches.length ? "text-transparent caret-neutral-950 selection:bg-blue-200 dark:caret-white dark:selection:bg-blue-800" : ""}`}
                />
              </div>
              <div className="flex justify-end border-t p-3">
                <button
                  onClick={() => void save()}
                  disabled={busy || !draft.trim() || draft === selectedSaved}
                  className="flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </button>
              </div>
            </>
          ) : (
            <p className="p-5 text-sm text-neutral-500">
              Crie ou selecione um workflow.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
