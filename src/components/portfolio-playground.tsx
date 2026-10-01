"use client";

import { FormEvent, useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { LegacyChatPage } from "@/components/legacy-chat-page";
import { LangGraphLogoSVG } from "@/components/icons/langgraph";

type Portfolio = {
  scope_id: number;
  tenant_name: string;
  portfolio_name: string;
  assistant_name: string;
  assistant_id: string | null;
  chat_ready: boolean;
};
export function PortfolioPlayground({
  signedIn,
  runtimeUrl,
}: {
  signedIn: boolean;
  runtimeUrl: string;
}) {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(signedIn);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [scopeId, setScopeId] = useState<number | null>(null);
  const [, setThreadId] = useQueryState("threadId");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loggedIn) return;
    fetch("/api/portfolio/list", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Não foi possível consultar as carteiras.");
        return response.json();
      })
      .then((data) => setPortfolios(data.portfolios))
      .catch((reason) => setError(reason.message));
  }, [loggedIn]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/portfolio/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok)
      return setError("Senha incorreta ou acesso temporariamente bloqueado.");
    setPassword("");
    setLoggedIn(true);
  }

  async function selectPortfolio(value: number) {
    await setThreadId(null);
    setScopeId(value);
    setError("");
  }

  if (!loggedIn)
    return (
      <main className="portfolio-login">
        <form onSubmit={login}>
          <h1>Playground de carteiras</h1>
          <p>Acesso interno para testar agentes por carteira.</p>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit">Entrar</button>
          {error && <p role="alert">{error}</p>}
        </form>
      </main>
    );

  const selected = portfolios.find((item) => item.scope_id === scopeId);
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <LangGraphLogoSVG className="size-8 shrink-0" />
        <div className="mr-auto">
          <h1 className="text-lg font-semibold">Agent Chat</h1>
          <p className="text-muted-foreground text-xs">
            Playground de carteiras
          </p>
        </div>
        <label
          htmlFor="portfolio"
          className="text-sm font-medium"
        >
          Carteira
        </label>
        <select
          id="portfolio"
          className="max-w-[300px] min-w-[180px] rounded-md border bg-white px-3 py-2 text-sm"
          value={scopeId ?? ""}
          onChange={(event) => void selectPortfolio(Number(event.target.value))}
        >
          <option
            value=""
            disabled
          >
            Selecione uma carteira
          </option>
          {portfolios.map((portfolio) => (
            <option
              key={portfolio.scope_id}
              value={portfolio.scope_id}
            >
              {portfolio.tenant_name} · {portfolio.portfolio_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={async () => {
            await fetch("/api/portfolio/auth", { method: "DELETE" });
            await setThreadId(null);
            setLoggedIn(false);
            setScopeId(null);
          }}
        >
          Sair
        </button>
      </header>
      {selected && (
        <div className="text-muted-foreground border-b px-4 py-2 text-xs">
          Agente:{" "}
          <strong className="text-foreground">{selected.assistant_name}</strong>
          {selected.assistant_id && <span> · {selected.assistant_id}</span>}
        </div>
      )}
      <section className="min-h-0 flex-1">
        {!selected ? (
          <p className="text-muted-foreground p-8 text-center">
            Selecione uma carteira para iniciar.
          </p>
        ) : !selected.chat_ready || !selected.assistant_id || !runtimeUrl ? (
          <p
            role="status"
            className="text-muted-foreground p-8 text-center"
          >
            O agente desta carteira ainda não está disponível para teste.
          </p>
        ) : (
          <LegacyChatPage
            key={selected.scope_id}
            embedded
            fixedConfig={{
              apiUrl: runtimeUrl,
              assistantId: selected.assistant_id,
            }}
          />
        )}
      </section>
      {error && (
        <p
          role="alert"
          className="px-4 py-2 text-red-700"
        >
          {error}
        </p>
      )}
    </main>
  );
}
