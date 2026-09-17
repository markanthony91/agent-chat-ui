"use client";

import { useEffect, useState } from "react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { toast } from "sonner";
import { resolveAssistant, saveAssistantContext } from "@/lib/assistant-config";
import { getRuntimeConnection } from "@/lib/runtime-connection";
import { runOkfAdmin } from "@/lib/okf-admin";

type Section = "llm_settings" | "agent_profile";
type ModelInfo = {
  model: string;
  provider: string;
  defaults: Record<string, number | null>;
};

const llmFields = [
  {
    key: "temperature",
    label: "Temperatura",
    min: 0,
    max: 2,
    step: "any",
    help: "Controla a variação das respostas. Valores menores tendem a variar menos; não garantem obediência às instruções.",
  },
  {
    key: "top_p",
    label: "Top-p",
    min: 0.000001,
    max: 1,
    step: "any",
    help: "Limita a diversidade de palavras consideradas. Deve ser maior que 0 e até 1. Ajuste um parâmetro de amostragem por vez para comparar os testes.",
  },
  {
    key: "max_tokens",
    label: "Limite de tokens da resposta",
    min: 1,
    max: 32768,
    step: "1",
    help: "Máximo de tokens gerados por chamada, incluindo chamadas de ferramentas. Um limite baixo pode interromper a resposta. O modelo também aplica seu limite de contexto.",
  },
];
const profileFields = [
  {
    key: "name",
    label: "Nome do agente",
    maxLength: 80,
    placeholder: "Ex.: Sofia",
  },
  {
    key: "role",
    label: "Função do agente",
    maxLength: 500,
    placeholder: "Ex.: Assistente virtual de atendimento da Zerai",
  },
  {
    key: "tone",
    label: "Tom de voz",
    maxLength: 200,
    placeholder: "Ex.: Cordial, claro e objetivo",
  },
];

export function RuntimeSettingsPanel({ section }: { section: Section }) {
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const isLLM = section === "llm_settings";
  const title = isLLM ? "LLM" : "Perfil do agente";
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { apiUrl, apiKey } = getRuntimeConnection();
        if (!apiUrl) throw new Error("Deployment URL não configurada.");
        const id =
          new URLSearchParams(window.location.search).get("assistantId") ||
          process.env.NEXT_PUBLIC_ASSISTANT_ID ||
          "agent";
        const [record, info] = await Promise.all([
          resolveAssistant(new Client({ apiUrl, apiKey }), id),
          isLLM
            ? runOkfAdmin({ operation: "get_llm_config" })
            : Promise.resolve(null),
        ]);
        if (info && (typeof info.model !== "string" || !info.defaults))
          throw new Error(
            "O backend ainda não disponibiliza as configurações de LLM.",
          );
        const configured = (
          record.context as Record<string, unknown> | undefined
        )?.[section] as Record<string, unknown> | undefined;
        const fields = isLLM ? llmFields : profileFields;
        const loaded = Object.fromEntries(
          fields.map(({ key }) => [
            key,
            configured?.[key] == null ? "" : String(configured[key]),
          ]),
        );
        if (active) {
          setAssistant(record);
          setModel(info as ModelInfo | null);
          setValues(loaded);
          setSaved(loaded);
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Falha ao carregar configurações.",
          );
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [section, isLLM]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assistant) return;
    setBusy(true);
    setError("");
    try {
      const settings = Object.fromEntries(
        Object.entries(values).flatMap(([key, value]) => {
          if (isLLM && !value.trim()) return [];
          return [[key, isLLM ? Number(value) : value.trim()]];
        }),
      );
      const validated = await runOkfAdmin({
        operation: "validate_runtime_settings",
        settings: { [section]: settings },
      });
      if (!validated[section])
        throw new Error("O backend não confirmou as configurações.");
      const { apiUrl, apiKey } = getRuntimeConnection();
      const updated = await saveAssistantContext(
        new Client({ apiUrl, apiKey }),
        assistant.assistant_id,
        { [section]: validated[section] },
      );
      const normalized = Object.fromEntries(
        Object.keys(values).map((key) => [
          key,
          settings[key] == null ? "" : String(settings[key]),
        ]),
      );
      setAssistant(updated);
      setValues(normalized);
      setSaved(normalized);
      toast.success("Salvo com sucesso", {
        description: `${title} · versão ${updated.version}`,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao salvar configurações.",
      );
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm disabled:opacity-50";
  return (
    <form
      onSubmit={save}
      className="space-y-5 p-5"
    >
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-neutral-500">
          {isLLM
            ? "Parâmetros enviados ao modelo nas próximas respostas deste agente. Deixe um campo vazio para usar o padrão do servidor ou provedor."
            : "Identidade e estilo usados nas próximas respostas. Campos preenchidos prevalecem sobre nomes e estilos definidos nos prompts, sem substituir as regras operacionais."}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Para comparar configurações, inicie uma conversa nova após salvar.
        </p>
      </div>
      {busy && (
        <p
          role="status"
          className="text-sm"
        >
          Carregando ou salvando...
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {isLLM && model && (
        <div className="space-y-1 rounded-lg border p-3 text-sm">
          <p>
            Modelo: <span className="font-mono break-all">{model.model}</span>
          </p>
          <p>Conexão: {model.provider}</p>
          <p className="text-neutral-500">
            Modelo e credenciais são definidos no servidor.
          </p>
        </div>
      )}
      {isLLM
        ? llmFields.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`llm-${field.key}`}
                className="text-sm font-medium"
              >
                {field.label}
              </label>
              <input
                id={`llm-${field.key}`}
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={values[field.key] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [field.key]: event.target.value })
                }
                disabled={busy || !assistant}
                placeholder="Usar padrão"
                aria-describedby={`help-${field.key}`}
                className={inputClass}
              />
              <p
                id={`help-${field.key}`}
                className="mt-1 text-xs text-neutral-500"
              >
                {field.help}
              </p>
              {model && (
                <p className="mt-1 text-xs text-neutral-500">
                  Salvo:{" "}
                  {saved[field.key] ||
                    (model.defaults[field.key] == null
                      ? "Padrão do provedor (valor não informado pelo servidor)"
                      : `${model.defaults[field.key]} (padrão do servidor)`)}
                </p>
              )}
            </div>
          ))
        : profileFields.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`profile-${field.key}`}
                className="text-sm font-medium"
              >
                {field.label}
              </label>
              <input
                id={`profile-${field.key}`}
                maxLength={field.maxLength}
                value={values[field.key] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [field.key]: event.target.value })
                }
                disabled={busy || !assistant}
                placeholder={field.placeholder}
                className={inputClass}
              />
            </div>
          ))}
      {!isLLM && (
        <p className="text-xs text-neutral-500">
          Campos vazios preservam o comportamento dos prompts. O nome é usado na
          apresentação ao cliente; não altera o identificador técnico do
          assistente.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-neutral-500">
          {assistant && `Versão atual: ${assistant.version} · `}
          {dirty ? "Alterações não salvas" : "Sincronizado"}
        </p>
        <button
          type="submit"
          disabled={busy || !assistant || !dirty}
          className="rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"
        >
          Salvar {isLLM ? "LLM" : "perfil"}
        </button>
      </div>
    </form>
  );
}
