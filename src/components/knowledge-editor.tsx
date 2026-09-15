"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, RefreshCw, Search, X } from "lucide-react";
import { runOkfAdmin } from "@/lib/okf-admin";
import { OkfDraftsPanel } from "@/components/okf-drafts-panel";
import { OkfVersionsPanel } from "@/components/okf-versions-panel";

type KnowledgeFile = { path: string; content?: string; title?: string; type?: string; status?: string; metadata_warning?: boolean; snippet?: string; line?: number };

function typeStyle(type?: string): string {
  switch (type) {
    case "POLICY": return "border-rose-200 text-rose-700 dark:text-rose-300";
    case "TOOL": return "border-violet-200 text-violet-700 dark:text-violet-300";
    case "FLOW": return "border-amber-200 text-amber-700 dark:text-amber-300";
    case "PLAYBOOK": return "border-emerald-200 text-emerald-700 dark:text-emerald-300";
    default: return "border-sky-200 text-sky-700 dark:text-sky-300";
  }
}

function catalogFiles(value: unknown): KnowledgeFile[] {
  if (!Array.isArray(value)) throw new Error("Catálogo indisponível. Atualize o backend antes de usar a busca por conteúdo.");
  return value.filter((item): item is KnowledgeFile => !!item && typeof item.path === "string");
}

type FileNode = { name: string; path: string; count: number; children: Map<string, FileNode>; file?: KnowledgeFile };

function normalized(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

function fileTree(files: KnowledgeFile[]): Map<string, FileNode> {
  const roots = new Map<string, FileNode>();
  for (const file of files) {
    let level = roots;
    const parts = file.path.split("/");
    parts.forEach((name, index) => {
      let node = level.get(name);
      if (!node) {
        node = { name, path: parts.slice(0, index + 1).join("/"), count: 0, children: new Map() };
        level.set(name, node);
      }
      node.count++;
      if (index === parts.length - 1) node.file = file;
      level = node.children;
    });
  }
  return roots;
}

export function KnowledgeEditor(): React.ReactNode {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [selected, setSelected] = useState<KnowledgeFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [closedMatches, setClosedMatches] = useState<Set<string>>(new Set());
  const [cache, setCache] = useState<Record<string, string>>({});
  const [bundleName, setBundleName] = useState("OKF ativo");
  const [bundleVersion, setBundleVersion] = useState("0.2");
  const [bundleId, setBundleId] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [searchResult, setSearchResult] = useState<{ query: string; bundle: string; files: KnowledgeFile[]; error?: string } | null>(null);

  const searchActive = normalized(query).length > 0;
  const searchCurrent = searchResult?.query === query && searchResult?.bundle === bundleId;
  const searching = searchActive && !!bundleId && !searchCurrent;
  const matches = searchActive ? (searchCurrent ? searchResult!.files : []) : files;
  const filteredFiles = useMemo(() => selectedType ? matches.filter((file) => file.type === selectedType) : matches, [matches, selectedType]);
  const types = useMemo(() => Array.from(new Set(files.map((file) => file.type || "SEM TIPO"))).sort(), [files]);
  const tree = useMemo(() => fileTree(filteredFiles), [filteredFiles]);

  useEffect(() => {
    if (!query.trim() || !bundleId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      runOkfAdmin({ operation: "catalog", query, bundle_id: bundleId }).then((result) => {
        const found = catalogFiles(result.documents);
        if (!cancelled) setSearchResult({ query, bundle: bundleId, files: found });
      }).catch(() => {
        if (!cancelled) setSearchResult({ query, bundle: bundleId, files: [], error: "Falha na busca por conteúdo. Altere a busca ou atualize para tentar novamente." });
      });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, bundleId]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const result = await runOkfAdmin({ operation: "catalog" });
      setFiles(catalogFiles(result.documents));
      setBundleId(typeof result.bundle_id === "string" ? result.bundle_id : "");
      setSearchResult(null); setSelectedType(""); setQuery(""); setClosedMatches(new Set());
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
    if (typeof direct === "string") { setSelected({ ...file, content: direct }); return; }
    setLoading(true);
    try {
      const result = await runOkfAdmin({ operation: "read", path: file.path, bundle_id: bundleId });
      const content = typeof result.content === "string" ? result.content : "";
      setCache((current) => ({ ...current, [file.path]: content }));
      setSelected({ ...file, content });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao abrir arquivo OKF.");
    } finally {
      setLoading(false);
    }
  };

  const filtering = searchActive || !!selectedType;
  const toggleFolder = (folder: string) => (filtering ? setClosedMatches : setOpenFolders)((current) => {
    const next = new Set(current);
    if (next.has(folder)) next.delete(folder); else next.add(folder);
    return next;
  });
  const filter = (value: string) => { setQuery(value); setClosedMatches(new Set()); };

  const renderTree = (nodes: Map<string, FileNode>): React.ReactNode => (
    <ul className="min-w-0 space-y-0.5">
      {Array.from(nodes.values()).sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name, "pt-BR")).map((node) => {
        const expanded = filtering ? !closedMatches.has(node.path) : openFolders.has(node.path);
        return <li key={node.path}>
          {node.file ? <button type="button" onClick={() => void openFile(node.file!)}
            disabled={loading} aria-label={`Arquivo ${node.path}`} aria-current={selected?.path === node.path ? "true" : undefined}
            className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${selected?.path === node.path ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
            <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500" />
            <span className="min-w-0 flex-1" title={node.path}>
              <span className="block truncate font-medium">{node.file.title || node.name}</span>
              <span className="block truncate text-[11px] text-neutral-500">{node.name}</span>
              {node.file.snippet && <span className="mt-1 block line-clamp-2 text-xs text-neutral-500">L{node.file.line}: {node.file.snippet}</span>}
              {node.file.metadata_warning && <span className="block text-xs text-amber-700">Revisar metadados</span>}
            </span>
            <span className={`shrink-0 max-w-24 truncate rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${typeStyle(node.file.type)}`}>{node.file.type || "SEM TIPO"}</span>
          </button> : <>
            <button type="button" onClick={() => toggleFolder(node.path)} aria-expanded={expanded} aria-label={`Pasta ${node.path}`}
              className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-neutral-900">
              {expanded ? <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" /> : <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />}
              <Folder aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="min-w-0 flex-1 truncate" title={node.path}>{node.name}</span>
              <span className="shrink-0 text-xs text-neutral-500" title="Arquivos neste ramo">{node.count}</span>
            </button>
            {expanded && <div className="ml-3 border-l pl-2 dark:border-neutral-800">{renderTree(node.children)}</div>}
          </>}
        </li>;
      })}
    </ul>
  );

  return <div className="p-5">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="font-semibold">Dataset</h3><p className="mt-1 text-sm text-neutral-500">{bundleName} · OKF {bundleVersion} · storage persistente</p></div>
      <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</button>
    </div>
    {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    {searchCurrent && searchResult?.error && <p role="alert" className="mt-3 text-sm text-red-700">{searchResult.error}</p>}
    <div className="mt-5"><OkfDraftsPanel onPublished={() => void load()} /></div>
    <OkfVersionsPanel onActivated={() => void load()} />
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">Bundles publicados são somente leitura. Para alterar conhecimento, crie um Draft, edite, valide e publique uma nova versão.</div>
    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo de documento">
      {["", ...types].map((type) => <button key={type} type="button" aria-pressed={selectedType === type} onClick={() => { setSelectedType(type); setClosedMatches(new Set()); }} className={`rounded-lg border px-3 py-2 text-xs font-medium ${selectedType === type ? "border-blue-600 bg-blue-600 text-white" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>{type || "Todos"} ({type ? matches.filter((file) => file.type === type).length : matches.length})</button>)}
    </div>
    <div className="mt-3 grid min-h-[52vh] grid-cols-1 gap-4 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-xl border p-3">
        <div className="mb-3 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500"><span>Dataset OKF</span><span role="status" aria-live="polite">{searching ? "Buscando…" : `${filteredFiles.length} de ${files.length}`}</span></div>
        <div className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 focus-within:ring-2 focus-within:ring-neutral-400"><Search aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500" /><input type="search" aria-label="Filtrar arquivos e pastas" value={query} maxLength={200} onChange={(event) => filter(event.target.value)} placeholder="Buscar no conteúdo, título ou caminho…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{query && <button onClick={() => filter("")} aria-label="Limpar busca" className="shrink-0 rounded p-1 focus-visible:outline-2"><X className="h-4 w-4 text-neutral-500" /></button>}</div>
        <p className="mb-2 text-xs text-neutral-500">Busca no texto completo e nos metadados. Tipos declarados nos arquivos, sem inferência.</p>
        <nav aria-label="Arquivos do Dataset" aria-busy={searching || loading} className="max-h-[52vh] overflow-auto p-1">
        {loading && files.length === 0 && <p className="px-2 py-3 text-sm text-neutral-500">Carregando storage...</p>}
        {!loading && files.length === 0 && <p className="px-2 py-3 text-sm text-neutral-500">Nenhum bundle OKF ativo no storage persistente.</p>}
        {!loading && !searching && !(searchCurrent && searchResult?.error) && files.length > 0 && filteredFiles.length === 0 && <p className="px-2 py-3 text-sm text-neutral-500">Nenhum arquivo ou pasta corresponde ao filtro.</p>}
        {renderTree(tree)}
        </nav>
      </div>
      <div className="min-w-0 rounded-xl border">
        <div className="border-b px-4 py-3"><div className="flex flex-wrap items-center gap-2"><h4 className="min-w-0 break-words text-lg font-semibold">{selected?.title || selected?.path || "Selecione um arquivo"}</h4>{selected && <span className={`rounded-full border px-2 py-0.5 text-xs ${typeStyle(selected.type)}`}>{selected.type || "SEM TIPO"}</span>}</div>{selected && <p className="mt-1 break-all font-mono text-xs text-neutral-500">{selected.path}</p>}{selected?.status && <p className="mt-1 text-xs text-neutral-500">Status declarado: {selected.status}</p>}</div>
        <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-neutral-700 dark:text-neutral-300">{loading && selected ? "Carregando..." : selected?.content ?? "Selecione um arquivo OKF para visualizar seu conteúdo."}</pre>
      </div>
    </div>
  </div>;
}
