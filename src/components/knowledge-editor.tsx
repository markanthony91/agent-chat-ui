"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, RefreshCw, Search, X } from "lucide-react";
import { runOkfAdmin } from "@/lib/okf-admin";
import { OkfDraftsPanel } from "@/components/okf-drafts-panel";
import { OkfVersionsPanel } from "@/components/okf-versions-panel";

type KnowledgeFile = { path: string; content?: string };

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

  const filteredFiles = useMemo(() => {
    const needle = normalized(query);
    return needle ? files.filter((file) => normalized(file.path).includes(needle)) : files;
  }, [files, query]);
  const tree = useMemo(() => fileTree(filteredFiles), [filteredFiles]);

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

  const searchActive = normalized(query).length > 0;
  const toggleFolder = (folder: string) => (searchActive ? setClosedMatches : setOpenFolders)((current) => {
    const next = new Set(current);
    if (next.has(folder)) next.delete(folder); else next.add(folder);
    return next;
  });
  const filter = (value: string) => { setQuery(value); setClosedMatches(new Set()); };

  const renderTree = (nodes: Map<string, FileNode>): React.ReactNode => (
    <ul className="min-w-0 space-y-0.5">
      {Array.from(nodes.values()).sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name, "pt-BR")).map((node) => {
        const expanded = searchActive ? !closedMatches.has(node.path) : openFolders.has(node.path);
        return <li key={node.path}>
          {node.file ? <button type="button" onClick={() => void openFile(node.file!)}
            disabled={loading} aria-label={`Arquivo ${node.path}`} aria-current={selected?.path === node.path ? "true" : undefined}
            className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${selected?.path === node.path ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
            <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500" />
            <span className="min-w-0 truncate" title={node.path}>{node.name}</span>
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
    <div className="mt-5"><OkfDraftsPanel onPublished={() => void load()} /></div>
    <OkfVersionsPanel onActivated={() => void load()} />
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">Bundles publicados são somente leitura. Para alterar conhecimento, crie um Draft, edite, valide e publique uma nova versão.</div>
    <div className="mt-5 grid min-h-[52vh] grid-cols-1 gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-xl border p-3">
        <div className="mb-3 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500"><span>Dataset OKF</span><span role="status" aria-live="polite">{filteredFiles.length} de {files.length}</span></div>
        <div className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 focus-within:ring-2 focus-within:ring-neutral-400"><Search aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500" /><input type="search" aria-label="Filtrar arquivos e pastas" value={query} onChange={(event) => filter(event.target.value)} placeholder="Filtrar arquivos e pastas…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{query && <button onClick={() => filter("")} aria-label="Limpar busca" className="shrink-0 rounded p-1 focus-visible:outline-2"><X className="h-4 w-4 text-neutral-500" /></button>}</div>
        <nav aria-label="Arquivos do Dataset" className="max-h-[52vh] overflow-auto p-1">
        {loading && files.length === 0 && <p className="px-2 py-3 text-sm text-neutral-500">Carregando storage...</p>}
        {!loading && files.length === 0 && <p className="px-2 py-3 text-sm text-neutral-500">Nenhum bundle OKF ativo no storage persistente.</p>}
        {!loading && files.length > 0 && filteredFiles.length === 0 && <p className="px-2 py-3 text-sm text-neutral-500">Nenhum arquivo ou pasta corresponde ao filtro.</p>}
        {renderTree(tree)}
        </nav>
      </div>
      <div className="min-w-0 rounded-xl border">
        <div className="border-b px-4 py-3"><p className="truncate text-sm font-medium">{selected?.path ?? "Selecione um arquivo"}</p></div>
        <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-neutral-700 dark:text-neutral-300">{loading && selected ? "Carregando..." : selected?.content ?? "Selecione um arquivo OKF para visualizar seu conteúdo."}</pre>
      </div>
    </div>
  </div>;
}
