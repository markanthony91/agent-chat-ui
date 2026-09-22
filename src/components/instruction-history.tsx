"use client";

import { type ReactNode, useState } from "react";
import { Client } from "@langchain/langgraph-sdk";
import { getRuntimeConnection } from "@/lib/runtime-connection";
import { runRawCompiler } from "@/lib/raw-compiler";

type Revision = { version: number; created_at: string; content?: string };
type Props = {
  assistantId?: string;
  field?: "system_prompt" | "agent_instructions" | "workflows";
  workflowId?: string;
  version?: number;
  disabled: boolean;
  onSelect: (content: string) => void;
  action?: ReactNode;
};

export function InstructionHistory({
  assistantId,
  field,
  workflowId,
  version,
  disabled,
  onSelect,
  action,
}: Props) {
  const [versions, setVersions] = useState<Revision[]>([]);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");

  const load = async (offset = 0) => {
    setBusy(true);
    setError("");
    setOpen(true);
    try {
      let records: Revision[];
      if (assistantId && field) {
        const client = new Client(getRuntimeConnection());
        const history = await client.assistants.getVersions(assistantId, {
          limit: 20,
          offset,
        });
        records = history.map((item) => {
          const value = (item.context as Record<string, unknown> | undefined)?.[
            field
          ];
          const content =
            field === "workflows" && workflowId
              ? (value as Record<string, unknown> | undefined)?.[workflowId]
              : value;
          return {
            version: item.version,
            created_at: item.created_at,
            content: typeof content === "string" ? content : undefined,
          };
        });
      } else {
        const result = await runRawCompiler({
          operation: "get_agents_versions",
          limit: 20,
          offset,
        });
        if (!Array.isArray(result.versions))
          throw new Error("Histórico indisponível no runtime.");
        records = result.versions as Revision[];
      }
      setVersions((current) => (offset ? [...current, ...records] : records));
      setMore(records.length === 20);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao carregar histórico.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Histórico de versões"
      className="mt-4 rounded-lg border p-3 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span>
          {version ? `Versão atual: ${version}` : "Histórico de versões"}
        </span>
        <div className="flex items-center gap-2">
          {action}
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => (open ? setOpen(false) : void load())}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            {open ? "Ocultar histórico" : "Ver histórico"}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-neutral-500">
            {assistantId
              ? "Versões do Assistant: cada salvamento preserva a configuração completa. "
              : "Versões do RAW AGENTS.md. "}
            Carregue uma versão no editor e clique em Salvar para criar uma nova
            versão.
          </p>
          {error && (
            <p
              role="alert"
              className="text-red-600"
            >
              {error}
            </p>
          )}
          {busy && <p role="status">Carregando histórico...</p>}
          {!busy && !error && !versions.length && (
            <p>
              Nenhuma versão registrada. O conteúdo atual será preservado no
              primeiro salvamento.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {versions.map((item) => (
              <button
                type="button"
                key={item.version}
                onClick={() => setSelected(item)}
                className="rounded border px-3 py-1"
                aria-pressed={selected?.version === item.version}
              >
                v{item.version} ·{" "}
                {new Date(item.created_at).toLocaleString("pt-BR")}
              </button>
            ))}
          </div>
          {more && (
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => void load(versions.length)}
              className="rounded border px-3 py-1"
            >
              Carregar mais versões
            </button>
          )}
          {selected && (
            <div className="space-y-2">
              {selected.content === undefined ? (
                <p>
                  {field === "workflows"
                    ? "Esta versão não contém este workflow."
                    : "Esta versão utiliza as instruções padrão, sem conteúdo personalizado salvo."}
                </p>
              ) : (
                <>
                  <pre
                    aria-label="Conteúdo da versão"
                    className="max-h-60 overflow-auto rounded bg-neutral-100 p-3 text-xs whitespace-pre-wrap dark:bg-neutral-900"
                  >
                    {selected.content}
                  </pre>
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => onSelect(selected.content!)}
                    className="rounded border px-3 py-1 disabled:opacity-40"
                  >
                    Carregar v{selected.version} no editor
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
