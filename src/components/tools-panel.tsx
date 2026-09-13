"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { runToolAdmin } from "@/lib/tool-admin";

type ToolRecord = {
  name: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  mode?: string;
  risk?: string;
  requires_auth?: boolean;
};

export function ToolsPanel(): React.ReactNode {
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const raw = await runToolAdmin({ operation: "list_tools" });
      const items = Array.isArray(raw) ? raw : [];
      setTools(items.filter((item): item is ToolRecord => Boolean(item && typeof item === "object" && typeof (item as ToolRecord).name === "string")));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar tools.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const categories = useMemo(() => {
    const grouped = new Map<string, ToolRecord[]>();
    for (const item of tools) {
      const category = item.category || "other";
      grouped.set(category, [...(grouped.get(category) ?? []), item]);
    }
    return Array.from(grouped.entries());
  }, [tools]);

  const toggle = async (item: ToolRecord, enabled: boolean) => {
    setChanging(item.name); setMessage(null); setError(null);
    setTools((current) => current.map((tool) => tool.name === item.name ? { ...tool, enabled } : tool));
    try {
      await runToolAdmin({ operation: "set_tool_enabled", tool_name: item.name, enabled });
      setMessage(`${item.name} ${enabled ? "habilitada" : "desabilitada"}. A mudança vale para os próximos model calls.`);
    } catch (cause) {
      setTools((current) => current.map((tool) => tool.name === item.name ? { ...tool, enabled: item.enabled } : tool));
      setError(cause instanceof Error ? cause.message : "Falha ao alterar tool.");
    } finally {
      setChanging(null);
    }
  };

  const reset = async () => {
    setLoading(true); setMessage(null); setError(null);
    try {
      await runToolAdmin({ operation: "reset_tools" });
      await load();
      setMessage("Configuração padrão das tools restaurada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao restaurar tools.");
      setLoading(false);
    }
  };

  return <div className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 font-semibold"><Wrench className="h-4 w-4" />Tools</h3>
        <p className="mt-1 text-sm text-neutral-500">O registry controla quais tools o modelo pode enxergar. A decisão de usar uma tool continua sendo da LLM.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</button>
        <button onClick={() => void reset()} disabled={loading} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><RotateCcw className="h-4 w-4" />Restaurar padrão</button>
      </div>
    </div>

    {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</div>}

    <div className="mt-5 space-y-5">
      {categories.map(([category, items]) => <section key={category}>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{category}</div>
        <div className="divide-y rounded-xl border dark:divide-neutral-800">
          {items.map((item) => <div key={item.name} className="flex items-start justify-between gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold">{item.name}</span><span className="rounded-full border px-2 py-0.5 text-[11px] text-neutral-500">{item.mode || "read_only"}</span><span className="rounded-full border px-2 py-0.5 text-[11px] text-neutral-500">risk: {item.risk || "low"}</span>{item.requires_auth && <span className="rounded-full border px-2 py-0.5 text-[11px] text-neutral-500">auth</span>}</div>
              <p className="mt-1 text-sm text-neutral-500">{item.description || "Sem descrição."}</p>
            </div>
            <div className="flex items-center gap-2"><span className="text-xs text-neutral-400">{item.enabled ? "ON" : "OFF"}</span><Switch checked={item.enabled === true} disabled={changing === item.name || loading} onCheckedChange={(value) => void toggle(item, value)} /></div>
          </div>)}
        </div>
      </section>)}
      {!loading && tools.length === 0 && <p className="text-sm text-neutral-500">Nenhuma tool registrada.</p>}
    </div>
  </div>;
}
