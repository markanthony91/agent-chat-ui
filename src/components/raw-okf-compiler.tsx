"use client";

import { toast } from "sonner";
import { InstructionHistory } from "@/components/instruction-history";

import React, { useState } from "react";
import { FileText, FileUp, FlaskConical, LoaderCircle, Save } from "lucide-react";
import { runRawCompiler } from "@/lib/raw-compiler";

type PlannedFile = { path?: string; type?: string; reason?: string };
type Plan = { summary?: string; institution?: string | null; product?: string | null; domain?: string; files?: PlannedFile[]; warnings?: string[] };
type View = "ingestion" | "agents";

export function RawOkfCompiler(): React.ReactNode {
  const [view, setView] = useState<View>("ingestion");
  const [sourceName, setSourceName] = useState("source.txt");
  const [text, setText] = useState("");
  const [ingestionId, setIngestionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [agentsContent, setAgentsContent] = useState("");
  const [agentsVersion, setAgentsVersion] = useState<number>();
  const [agentsSource, setAgentsSource] = useState("");
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (![".txt", ".md", ".csv", ".json"].some((ext) => lower.endsWith(ext))) {
      setError("Use TXT, MD, CSV ou JSON nesta versão.");
      return;
    }
    setError(null); setSourceName(file.name); setText(await file.text());
  };

  const analyze = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await runRawCompiler({ operation: "analyze", source_name: sourceName, raw_text: text });
      setIngestionId(typeof result.ingestion_id === "string" ? result.ingestion_id : null);
      setPlan((result.plan && typeof result.plan === "object" ? result.plan : {}) as Plan);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao analisar conteúdo."); }
    finally { setBusy(false); }
  };

  const createDraft = async () => {
    if (!ingestionId) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await runRawCompiler({ operation: "create_draft", ingestion_id: ingestionId });
      setMessage(`Draft criado: ${typeof result.draft_id === "string" ? result.draft_id : "novo draft"}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao criar draft."); }
    finally { setBusy(false); }
  };

  const loadAgents = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await runRawCompiler({ operation: "get_agents" });
      setAgentsContent(typeof result.content === "string" ? result.content : "");
      setAgentsSource(typeof result.source === "string" ? result.source : "default");
      setAgentsVersion(typeof result.version === "number" ? result.version : undefined);
      setAgentsLoaded(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar RAW AGENTS.md."); }
    finally { setBusy(false); }
  };

  const saveAgents = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await runRawCompiler({ operation: "save_agents", agents_content: agentsContent });
      if (result.saved !== true || typeof result.content !== "string" || typeof result.version !== "number") throw new Error("Não foi possível confirmar a versão salva.");
      setAgentsContent(result.content);
      setAgentsVersion(result.version);
      toast.success("Salvo com sucesso", { description: `RAW AGENTS.md · versão ${result.version}` });
      setAgentsSource(typeof result.source === "string" ? result.source : "runtime_override");
      setMessage("RAW AGENTS.md salvo no storage persistente.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar RAW AGENTS.md."); }
    finally { setBusy(false); }
  };

  const switchView = (next: View) => {
    setView(next);
    if (next === "agents" && !agentsLoaded) void loadAgents();
  };

  return <div className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-semibold"><FlaskConical className="h-4 w-4" />RAW → OKF Compiler</h3><p className="mt-1 text-sm text-neutral-500">Analise o conteúdo, revise o plano e só então gere um Draft.</p></div>
      <div className="flex rounded-lg border p-1 text-sm">
        <button onClick={() => switchView("ingestion")} className={`rounded-md px-3 py-1.5 ${view === "ingestion" ? "bg-neutral-100 font-medium dark:bg-neutral-800" : "text-neutral-500"}`}>Ingestão</button>
        <button onClick={() => switchView("agents")} className={`rounded-md px-3 py-1.5 ${view === "agents" ? "bg-neutral-100 font-medium dark:bg-neutral-800" : "text-neutral-500"}`}>AGENTS.md</button>
      </div>
    </div>
    {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

    {view === "agents" ? <div className="mt-5 rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h4 className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" />RAW AGENTS.md</h4><p className="mt-1 text-xs text-neutral-500">Estas instruções são usadas diretamente pelo compilador na próxima análise RAW → OKF.</p></div>
        <div className="text-right"><div className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{agentsSource === "runtime_override" ? "Override ativo" : "Default"}</div>{agentsSource && <div className="mt-1 font-mono text-[10px] text-neutral-400">{agentsSource}</div>}</div>
      </div>
      {agentsLoaded && <InstructionHistory key={agentsVersion ?? 0} version={agentsVersion} disabled={busy} onSelect={setAgentsContent} />}
      {busy && !agentsLoaded ? <div className="flex min-h-[42vh] items-center justify-center text-sm text-neutral-500"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Carregando instruções...</div> : <textarea disabled={busy} value={agentsContent} onChange={(e) => setAgentsContent(e.target.value)} className="min-h-[48vh] w-full rounded-xl border bg-transparent p-4 font-mono text-xs leading-5" />}
      <div className="mt-3 flex justify-end"><button onClick={() => void saveAgents()} disabled={busy || !agentsContent.trim()} className="flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar AGENTS.md</button></div>
    </div> : <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border p-4">
        <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm" />
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm"><FileUp className="h-4 w-4" />Carregar arquivo textual<input type="file" className="hidden" accept=".txt,.md,.csv,.json" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFile(file); }} /></label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Cole o conteúdo bruto aqui..." className="mt-3 min-h-[38vh] w-full rounded-xl border bg-transparent p-4 font-mono text-xs" />
        <div className="mt-3 flex justify-end"><button onClick={() => void analyze()} disabled={busy || !text.trim()} className="flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Analisar</button></div>
      </div>
      <div className="rounded-xl border p-4">
        <h4 className="font-medium">Plano de ingestão</h4>
        {!plan && <p className="mt-3 text-sm text-neutral-500">Nenhuma análise ainda.</p>}
        {plan && <div className="mt-3 space-y-3 text-sm">
          <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900"><div><strong>Domínio:</strong> {plan.domain || "-"}</div><div><strong>Instituição:</strong> {plan.institution || "-"}</div><div><strong>Produto:</strong> {plan.product || "-"}</div>{plan.summary && <p className="mt-2 text-neutral-500">{plan.summary}</p>}</div>
          {(plan.files ?? []).map((file, index) => <div key={index} className="rounded-lg border p-3"><div className="font-mono text-xs font-semibold">{file.path}</div><div className="mt-1 text-xs text-neutral-500">{file.type}{file.reason ? ` · ${file.reason}` : ""}</div></div>)}
          {(plan.warnings?.length ?? 0) > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{plan.warnings?.map((warning, index) => <div key={index}>• {warning}</div>)}</div>}
          <button onClick={() => void createDraft()} disabled={busy || !ingestionId || !(plan.files?.length)} className="w-full rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950">Criar Draft</button>
        </div>}
      </div>
    </div>}
  </div>;
}
