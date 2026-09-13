"use client";

import React, { useEffect, useState } from "react";

const STORAGE_KEY = "agent-chat-ui:system-prompt";
const DEFAULT_PROMPT = `# System Prompt\n\nVocê é um agente de atendimento especializado.\n\n## Behavior\n\n- Converse naturalmente.\n- Não invente informações.\n- Consulte o conhecimento institucional quando a resposta depender de regras ou políticas.\n- Use as tools disponíveis quando necessário.\n`;

export function SystemPromptPanel(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_PROMPT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setPrompt(stored);
      setSavedPrompt(stored);
    }
  }, []);

  const isDirty = prompt !== savedPrompt;

  const save = () => {
    window.localStorage.setItem(STORAGE_KEY, prompt);
    setSavedPrompt(prompt);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const reset = () => {
    setPrompt(DEFAULT_PROMPT);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-4 z-40 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        aria-label="Open system prompt settings"
      >
        System Prompt
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-neutral-950">
            <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <div>
                <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">System Prompt</h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Edite as instruções base do agente. Nesta primeira etapa, o conteúdo fica salvo neste navegador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-4 rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Fechar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="system-prompt-editor">
                Prompt em Markdown
              </label>
              <textarea
                id="system-prompt-editor"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                spellCheck={false}
                className="min-h-[52vh] w-full resize-y rounded-xl border border-neutral-300 bg-neutral-50 p-4 font-mono text-sm leading-6 text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-800"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                <span>{prompt.length.toLocaleString()} caracteres</span>
                <span>{isDirty ? "Alterações não salvas" : "Salvo localmente"}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Restaurar padrão
              </button>
              <div className="flex items-center gap-3">
                {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Salvo</span>}
                <button
                  type="button"
                  onClick={save}
                  disabled={!isDirty}
                  className="rounded-lg bg-neutral-950 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
