"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Plus, Rocket, ShieldCheck, XCircle } from "lucide-react";
import { runOkfAdmin } from "@/lib/okf-admin";

type Draft = { draft_id: string; draft_name?: string; bundle_version?: string; file_count?: number };
type Validation = { valid?: boolean; errors?: Array<Record<string, unknown>>; warnings?: Array<Record<string, unknown>> };

type Props = { onPublished?: () => void };

export function OkfDraftsPanel({ onPublished }: Props): React.ReactNode {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const raw = (await runOkfAdmin({ operation: "list_drafts" })) as unknown;
    const items = Array.isArray(raw) ? raw : [];
    setDrafts(items.filter((item): item is Draft => Boolean(item && typeof item === "object" && typeof (item as Draft).draft_id === "string")));
  };

  useEffect(() => { void load(); }, []);

  const create = async () => {
    setBusy(true); setMessage(null);
    try {
      const result = await runOkfAdmin({ operation: "create_draft", bundle_name: `draft-${Date.now()}`, bundle_version: "0.2", from_active: true });
      await load();
      if (typeof result.draft_id === "string") setSelected({ draft_id: result.draft_id, draft_name: typeof result.draft_name === "string" ? result.draft_name : result.draft_id, bundle_version: "0.2", file_count: typeof result.file_count === "number" ? result.file_count : undefined });
      setMessage("Draft criado a partir do bundle ativo.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao criar draft."); }
    finally { setBusy(false); }
  };

  const validate = async () => {
    if (!selected) return;
    setBusy(true); setMessage(null);
    try {
      const result = await runOkfAdmin({ operation: "validate_draft", draft_id: selected.draft_id });
      setValidation(result as Validation);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao validar draft."); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!selected || !validation?.valid) return;
    if (!window.confirm("Aprovar e publicar este draft? Novas conversas usarão esta versão.")) return;
    setBusy(true); setMessage(null);
    try {
      const result = await runOkfAdmin({ operation: "publish_draft", approved: true, draft_id: selected.draft_id });
      setMessage(`Publicado: ${typeof result.bundle_id === "string" ? result.bundle_id : "novo bundle"}`);
      onPublished?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao publicar draft."); }
    finally { setBusy(false); }
  };

  return <div className="mb-5 rounded-xl border p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h4 className="font-medium">Drafts OKF</h4><p className="mt-1 text-xs text-neutral-500">Mudanças ficam isoladas até Validate + Publish.</p></div>
      <button onClick={() => void create()} disabled={busy} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><Plus className="h-4 w-4" />Novo draft</button>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">{drafts.map((draft) => <button key={draft.draft_id} onClick={() => { setSelected(draft); setValidation(null); setMessage(null); }} className={`rounded-lg border px-3 py-2 text-left text-sm ${selected?.draft_id === draft.draft_id ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}><span className="block font-medium">{draft.draft_name || draft.draft_id}</span><span className="block text-xs text-neutral-400">{draft.file_count ?? 0} arquivos</span></button>)}</div>
    {selected && <div className="mt-4 flex flex-wrap items-center gap-2"><button onClick={() => void validate()} disabled={busy} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><ShieldCheck className="h-4 w-4" />Validar</button><button onClick={() => void publish()} disabled={busy || !validation?.valid} className="flex items-center gap-2 rounded-lg bg-neutral-950 px-3 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"><Rocket className="h-4 w-4" />Publicar</button>{validation && <span className={`flex items-center gap-1 text-sm ${validation.valid ? "text-emerald-600" : "text-red-600"}`}>{validation.valid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{validation.valid ? "Válido" : `${validation.errors?.length ?? 0} erro(s)`}</span>}</div>}
    {message && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}
  </div>;
}
