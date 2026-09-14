"use client";

import React, { useRef, useState } from "react";
import { FileArchive, Upload, X } from "lucide-react";
import { readOkfZip, type ImportedOkfBundle } from "@/lib/okf-zip";
import { runOkfAdmin } from "@/lib/okf-admin";

type Props = { onImported: () => Promise<void> | void };

export function OkfBundleImporter({ onImported }: Props): React.ReactNode {
  const inputRef = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState<ImportedOkfBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const choose = async (file?: File) => {
    if (!file) return;
    setLoading(true); setError(null); setSuccess(null);
    try { setBundle(await readOkfZip(file)); }
    catch (cause) { setBundle(null); setError(cause instanceof Error ? cause.message : "Falha ao ler o bundle OKF."); }
    finally { setLoading(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const importBundle = async () => {
    if (!bundle) return;
    if (!window.confirm("Aprovar a importação e ativação deste bundle completo? Para adicionar um documento, use a ingestão RAW.")) return;
    setImporting(true); setError(null);
    try {
      const result = await runOkfAdmin({ operation: "import_bundle", approved: true, bundle_name: bundle.name, bundle_version: bundle.version, files: bundle.files });
      const count = typeof result.file_count === "number" ? result.file_count : bundle.paths.length;
      setSuccess(`Bundle ${bundle.name} persistido com ${count} arquivos.`);
      setBundle(null);
      await onImported();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao importar o bundle OKF."); }
    finally { setImporting(false); }
  };

  return <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-medium">Importar bundle OKF</p><p className="mt-1 text-xs text-neutral-500">ZIP com index.md raiz e arquivos Markdown OKF 0.2. Persistência em storage durável.</p></div>
      <><input ref={inputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => void choose(event.target.files?.[0])} /><button type="button" onClick={() => inputRef.current?.click()} disabled={loading || importing} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><Upload className="h-4 w-4" /> {loading ? "Lendo ZIP..." : "Upload OKF ZIP"}</button></>
    </div>
    {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    {success && <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{success}</div>}
    {bundle && <div className="mt-4 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-900"><div className="flex items-start gap-3"><FileArchive className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{bundle.name}.zip</p><div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-500"><span>OKF {bundle.version}</span><span>{bundle.paths.length} Markdown</span><span>{new Set(bundle.paths.map((path) => path.includes("/") ? path.split("/")[0] : "root")).size} áreas</span></div><div className="mt-3 max-h-28 overflow-auto rounded border bg-white p-2 font-mono text-xs dark:bg-neutral-950">{bundle.paths.map((path) => <div key={path}>{path}</div>)}</div></div></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setBundle(null)} disabled={importing} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><X className="h-4 w-4" />Cancelar</button><button type="button" onClick={() => void importBundle()} disabled={importing} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-950">{importing ? "Persistindo..." : "Importar bundle"}</button></div></div>}
  </div>;
}
