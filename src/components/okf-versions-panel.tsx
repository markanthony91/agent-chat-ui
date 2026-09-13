"use client";

import React, { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { runOkfAdmin } from "@/lib/okf-admin";

type Version = {
  bundle_id: string;
  bundle_name?: string;
  bundle_version?: string;
  published_at?: string;
  file_count?: number;
  active?: boolean;
  source_draft_id?: string | null;
};

type Props = { onActivated?: () => void };

export function OkfVersionsPanel({ onActivated }: Props): React.ReactNode {
  const [versions, setVersions] = useState<Version[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const raw = (await runOkfAdmin({ operation: "list_versions" })) as unknown;
    const items = Array.isArray(raw) ? raw : [];
    setVersions(items.filter((item): item is Version => Boolean(item && typeof item === "object" && typeof (item as Version).bundle_id === "string")));
  };

  useEffect(() => { void load(); }, []);

  const activate = async (version: Version) => {
    if (version.active) return;
    setBusy(true); setMessage(null);
    try {
      await runOkfAdmin({ operation: "activate_bundle", bundle_id: version.bundle_id });
      setMessage(`Versão ativada: ${version.bundle_name || version.bundle_id}`);
      await load();
      onActivated?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao ativar versão.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="mb-5 rounded-xl border p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="flex items-center gap-2 font-medium"><History className="h-4 w-4" />Versões publicadas</h4>
        <p className="mt-1 text-xs text-neutral-500">Bundles publicados são imutáveis. Ativar uma versão anterior faz rollback sem copiar arquivos.</p>
      </div>
    </div>
    <div className="mt-4 space-y-2">
      {versions.length === 0 && <p className="text-sm text-neutral-500">Nenhuma versão publicada encontrada.</p>}
      {versions.map((version) => <div key={version.bundle_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{version.bundle_name || version.bundle_id}</span>
            {version.active && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Ativa</span>}
          </div>
          <p className="mt-1 break-all text-xs text-neutral-400">{version.bundle_id}</p>
          <p className="mt-1 text-xs text-neutral-500">OKF {version.bundle_version || "0.2"} · {version.file_count ?? 0} arquivos{version.published_at ? ` · ${new Date(version.published_at).toLocaleString()}` : ""}</p>
        </div>
        {!version.active && <button onClick={() => void activate(version)} disabled={busy} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><RotateCcw className="h-4 w-4" />Ativar / rollback</button>}
      </div>)}
    </div>
    {message && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}
  </div>;
}
