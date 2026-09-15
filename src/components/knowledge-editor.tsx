"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, RefreshCw, Search, X } from "lucide-react";
import { runOkfAdmin } from "@/lib/okf-admin";
import { OkfDraftsPanel } from "@/components/okf-drafts-panel";
import { OkfVersionsPanel } from "@/components/okf-versions-panel";

type KnowledgeFile = { path: string; content?: string };

function topFolder(path: string): string { return path.includes("/") ? path.split("/")[0] : "root"; }

export function KnowledgeEditor(): React.ReactNode {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [selected, setSelected] = useState<KnowledgeFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [cache, setCache] = useState<Record<string, string>>({});
  const [bundleName, setBundleName] = useState("OKF ativo");
  const [bundleVersion, setBundleVersion] = useState("0.2");

  const filteredFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? files.filter((file) => file.path.toLowerCase().includes(needle)) : files;
  }, [files, query]);
  const folders = useMemo(() => Array.from(new Set(filteredFiles.map((file) => topFolder(file.path)))), [filteredFiles]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const result = await runOkfAdmin({ operation: "list" });
      const paths = Array.isArray(result.files) ? result.files.filter((item): item is string => typeof item === "string") : [];
      setFiles(paths.map((path) => ({ path })));
      if (typeof result.bundle_name === "string" && result.bundle_name) setBundleName(result.bundle_name);
      if (typeof result.bundle_version === "string" && result.bundle_version) setBundleVersion(result.bundle_version);
      setSelected(null); setOpenFolders(new Set()); setCache({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar OKF.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openFile = async (file: KnowledgeFile) => {
    setError(null);
    const direct = cache[file.path];
    if (typeof direct === "string") { setSelected({ path: file.path, content: direct }); return; }
    setLoading(true);
    try {
      const result = await runOkfAdmin({ operation: "read", path: file.path });
      const content = typeof result.content === "string" ? result.content : "";
      setCache((current) => ({ ...current, [file.path]: content }));
      setSelected({ path: file.path, content });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao abrir arquivo OKF.");
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folder: string) => setOpenFolders((current) => {
    const next = new Set(current);
    if (next.has(folder)) next.delete(folder); else next.add(folder);
    return next;
  });
  const searchActive = query.trim().length > 0;

  return <div className="p-5">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="font-semibold">Dataset</h3><p className="mt-1 text-sm text-neutral-500">{bundleName} · OKF {bundleVersion} · storage persistente</p></div>
      <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</button>
    </div>
    {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    <div className="mt-5"><OkfDraftsPanel onPublished={() => void load()} /></div>
    <OkfVersionsPanel onActivated={() => void load()} />
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">Bundles publicados são somente leitura. Para alterar conhecimento, crie um Draft, edite, valide e publique uma nova versão.</div>
    <div className="mt-4 flex items-center gap-2 rounded-lg border px-3 py-2"><Search className="h-4 w-4 shrink-0 text-neutral-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar arquivo por nome ou path..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{query && <button onClick={() => setQuery("")} aria-label="Limpar busca"><X className="h-4 w-4 text-neutral-400" /></button>}</div>
    <div className="mt-5 grid min-h-[52vh] grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      <div className="max-h-[58vh] overflow-auto rounded-xl border p-3">
        <div className="mb-3 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400"><span>Dataset OKF</span><span>{filteredFiles.length}</span></div>
        {loading && files.length === 0 && <p className="px-2 py-3 text-sm text-neutral-500">Carregando storage...</p>}
        {!loading && files.length === 0 && <p className="px-2 py-3 text-sm text-neutral-500">Nenhum bundle OKF ativo no storage persistente.</p>}
        {folders.map((folder) => {
          const children = filteredFiles.filter((file) => topFolder(file.path) === folder);
          const expanded = searchActive || openFolders.has(folder);
          return <div key={folder} className="mb-2">
            <button type="button" onClick={() => toggleFolder(folder)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900">{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<Folder className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{folder}</span><span className="text-xs text-neutral-400">{children.length}</span></button>
            {expanded && children.map((file) => <button key={file.path} onClick={() => void openFile(file)} className={`mt-1 flex w-full items-center gap-2 rounded-lg py-2 pr-2 pl-8 text-left text-sm ${selected?.path === file.path ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}><FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate" title={file.path}>{folder === "root" ? file.path : file.path.slice(folder.length + 1)}</span></button>)}
          </div>;
        })}
      </div>
      <div className="min-w-0 rounded-xl border">
        <div className="border-b px-4 py-3"><p className="truncate text-sm font-medium">{selected?.path ?? "Selecione um arquivo"}</p></div>
        <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-neutral-700 dark:text-neutral-300">{loading && selected ? "Carregando..." : selected?.content ?? "Selecione um arquivo OKF para visualizar seu conteúdo."}</pre>
      </div>
    </div>
  </div>;
}
