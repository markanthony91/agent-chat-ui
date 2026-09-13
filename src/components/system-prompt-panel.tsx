"use client";

import React, { useEffect, useState } from "react";
import { Settings, FileText, Folder, ChevronRight, RefreshCw } from "lucide-react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { getApiKey } from "@/lib/api-key";

const DEFAULT_PROMPT = `# System Prompt\n\nVocê é um agente de atendimento especializado.\n\n## Behavior\n\n- Converse naturalmente.\n- Não invente informações.\n- Consulte o conhecimento institucional quando a resposta depender de regras ou políticas.\n- Use as tools disponíveis quando necessário.\n`;

type SettingsTab = "prompt" | "knowledge";
type KnowledgeFile = { path: string; content?: string };

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    assistantId: params.get("assistantId") || process.env.NEXT_PUBLIC_ASSISTANT_ID || "agent",
    apiKey: getApiKey() || undefined,
  };
}

async function getAssistant(client: Client, assistantId: string): Promise<Assistant> {
  try { return await client.assistants.get(assistantId); }
  catch {
    const assistants = await client.assistants.search({ graphId: assistantId, limit: 20, offset: 0 });
    const assistant = assistants.find((item) => item.graph_id === assistantId);
    if (!assistant) throw new Error("Nenhum assistant encontrado para este graph ID.");
    return assistant;
  }
}

function parseToolResult(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.content === "string") return record.content;
    if (Array.isArray(record.content)) return record.content.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join("\n");
  }
  return String(value ?? "");
}

async function callKnowledgeTool(client: Client, assistantId: string, toolName: string, args: Record<string, unknown>): Promise<string> {
  const thread = await client.threads.create();
  const run = client.runs.stream(thread.thread_id, assistantId, {
    input: { messages: [{ type: "human", content: `Use somente a tool ${toolName} com estes argumentos: ${JSON.stringify(args)}. Retorne o resultado sem resumir.` }] },
    streamMode: ["values"],
  });
  let last = "";
  for await (const event of run) {
    const data = event.data as { messages?: Array<Record<string, unknown>> } | undefined;
    const messages = data?.messages ?? [];
    for (const message of messages) {
      if (message.type === "tool" && message.name === toolName) last = parseToolResult(message.content);
    }
  }
  await client.threads.delete(thread.thread_id);
  if (!last) throw new Error(`A tool ${toolName} não retornou conteúdo.`);
  return last;
}

export function SystemPromptPanel(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("prompt");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_PROMPT);
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  useEffect(() => {
    const openSettings = () => setOpen(true);
    window.addEventListener("agent-settings:open", openSettings);
    return () => window.removeEventListener("agent-settings:open", openSettings);
  }, []);

  useEffect(() => {
    if (!open || tab !== "prompt") return;
    void (async () => {
      setLoading(true); setError(null);
      try {
        const { apiUrl, assistantId, apiKey } = getConnection();
        if (!apiUrl) throw new Error("Deployment URL não configurada.");
        const client = new Client({ apiUrl, apiKey });
        const record = await getAssistant(client, assistantId);
        const context = (record.context ?? {}) as Record<string, unknown>;
        const remotePrompt = typeof context.system_prompt === "string" ? context.system_prompt : DEFAULT_PROMPT;
        setAssistant(record); setPrompt(remotePrompt); setSavedPrompt(remotePrompt);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar o prompt."); }
      finally { setLoading(false); }
    })();
  }, [open, tab]);

  const loadKnowledge = async () => {
    setKnowledgeLoading(true); setKnowledgeError(null);
    try {
      const { apiUrl, assistantId, apiKey } = getConnection();
      if (!apiUrl) throw new Error("Deployment URL não configurada.");
      const client = new Client({ apiUrl, apiKey });
      const result = await callKnowledgeTool(client, assistantId, "okf_list", {});
      const files = result.split("\n").map((path) => path.trim()).filter((path) => path.endsWith(".md")).map((path) => ({ path }));
      setKnowledgeFiles(files);
      if (!selectedFile && files.length) await openKnowledgeFile(files[0], client, assistantId);
    } catch (cause) { setKnowledgeError(cause instanceof Error ? cause.message : "Falha ao carregar OKF."); }
    finally { setKnowledgeLoading(false); }
  };

  const openKnowledgeFile = async (file: KnowledgeFile, existingClient?: Client, existingAssistantId?: string) => {
    setKnowledgeLoading(true); setKnowledgeError(null);
    try {
      const connection = getConnection();
      const client = existingClient ?? new Client({ apiUrl: connection.apiUrl, apiKey: connection.apiKey });
      const assistantId = existingAssistantId ?? connection.assistantId;
      const content = await callKnowledgeTool(client, assistantId, "okf_read", { path: file.path });
      setSelectedFile({ ...file, content });
    } catch (cause) { setKnowledgeError(cause instanceof Error ? cause.message : "Falha ao abrir arquivo OKF."); }
    finally { setKnowledgeLoading(false); }
  };

  useEffect(() => { if (open && tab === "knowledge" && knowledgeFiles.length === 0) void loadKnowledge(); }, [open, tab]);

  const isDirty = prompt !== savedPrompt;
  const save = async () => {
    if (!assistant) return;
    setSaving(true); setError(null);
    try {
      const { apiUrl, apiKey } = getConnection();
      const client = new Client({ apiUrl, apiKey });
      const currentContext = (assistant.context ?? {}) as Record<string, unknown>;
      const updated = await client.assistants.update(assistant.assistant_id, { context: { ...currentContext, system_prompt: prompt } });
      setAssistant(updated); setSavedPrompt(prompt); setSaved(true); window.setTimeout(() => setSaved(false), 1800);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar o prompt."); }
    finally { setSaving(false); }
  };

  const folders = Array.from(new Set(knowledgeFiles.map((f) => f.path.includes("/") ? f.path.split("/")[0] : "root")));

  return <>
    {!open && <button type="button" onClick={() => setOpen(true)} className="fixed right-14 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800" aria-label="Abrir configurações do agente" title="Configurações do agente"><Settings className="h-5 w-5" /></button>}
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-neutral-950">
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800"><div><h2 className="text-lg font-semibold">Configurações do agente</h2><p className="mt-1 text-sm text-neutral-500">Prompt, conhecimento e recursos do runtime.</p></div><button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100">Fechar</button></div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="flex gap-2 border-b p-3 sm:w-52 sm:flex-col sm:border-r sm:border-b-0 dark:border-neutral-800">
            {(["prompt","knowledge"] as SettingsTab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${tab===item?"bg-neutral-100 text-neutral-950 dark:bg-neutral-800 dark:text-white":"text-neutral-500 hover:bg-neutral-50"}`}>{item === "prompt" ? "System Prompt" : "Knowledge"}</button>)}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "prompt" ? <><div className="p-5"><h3 className="font-semibold">System Prompt</h3><p className="mt-1 mb-4 text-sm text-neutral-500">Sincronizado com o Assistant do LangGraph.</p>{error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}<textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} disabled={loading||saving} spellCheck={false} className="min-h-[48vh] w-full resize-y rounded-xl border bg-neutral-50 p-4 font-mono text-sm leading-6 dark:bg-neutral-900"/><div className="mt-2 flex justify-between text-xs text-neutral-500"><span>{prompt.length.toLocaleString()} caracteres</span><span>{loading?"Carregando...":isDirty?"Alterações não salvas":"Sincronizado com o runtime"}</span></div></div><div className="flex justify-end gap-3 border-t px-5 py-4">{saved&&<span className="text-sm text-emerald-600">Salvo no runtime</span>}<button onClick={()=>void save()} disabled={!isDirty||loading||saving||!assistant} className="rounded-lg bg-neutral-950 px-5 py-2 text-sm font-medium text-white disabled:opacity-40">{saving?"Salvando...":"Salvar"}</button></div></> :
            <div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Knowledge</h3><p className="mt-1 text-sm text-neutral-500">OKF 0.2 disponível para o agente — somente leitura.</p></div><button onClick={()=>void loadKnowledge()} disabled={knowledgeLoading} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${knowledgeLoading?"animate-spin":""}`}/>Atualizar</button></div>{knowledgeError&&<div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{knowledgeError}</div>}<div className="mt-5 grid min-h-[52vh] grid-cols-1 gap-4 md:grid-cols-[260px_1fr]"><div className="rounded-xl border p-3"><div className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">knowledge/okf</div>{folders.map((folder)=><div key={folder} className="mb-3"><div className="flex items-center gap-2 px-2 py-1 text-sm font-medium"><Folder className="h-4 w-4"/>{folder}</div>{knowledgeFiles.filter((f)=>(f.path.includes("/")?f.path.split("/")[0]:"root")===folder).map((file)=><button key={file.path} onClick={()=>void openKnowledgeFile(file)} className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${selectedFile?.path===file.path?"bg-neutral-100 dark:bg-neutral-800":"hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}><FileText className="h-4 w-4 shrink-0"/><span className="min-w-0 flex-1 truncate">{file.path.split("/").pop()}</span><ChevronRight className="h-3 w-3"/></button>)}</div>)}</div><div className="min-w-0 rounded-xl border"><div className="border-b px-4 py-3"><p className="truncate text-sm font-medium">{selectedFile?.path ?? "Selecione um arquivo"}</p></div><pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-neutral-700 dark:text-neutral-300">{knowledgeLoading&&!selectedFile?"Carregando...":selectedFile?.content??"Selecione um arquivo OKF para visualizar seu conteúdo."}</pre></div></div><div className="mt-4 flex gap-4 text-xs text-neutral-500"><span>{knowledgeFiles.length} arquivos Markdown</span><span>OKF 0.2</span><span>Read-only</span></div></div>}
          </div>
        </div>
      </div>
    </div>}
  </>;
}
