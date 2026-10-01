"use client";

import { FormEvent, useEffect, useState } from "react";

type Portfolio = {
  scope_id: number;
  tenant_name: string;
  portfolio_name: string;
  assistant_name: string;
  assistant_id: string | null;
  chat_ready: boolean;
};
type Message = { role: "human" | "ai"; content: string };

export function PortfolioPlayground({ signedIn }: { signedIn: boolean }) {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(signedIn);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [scopeId, setScopeId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadToken, setThreadToken] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
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

  function selectPortfolio(value: number) {
    setScopeId(value);
    setThreadToken(null);
    setMessages([]);
    setError("");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!scopeId || !draft.trim() || busy) return;
    const message = draft.trim();
    setDraft("");
    setMessages((current) => [...current, { role: "human", content: message }]);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/portfolio/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope_id: scopeId,
          thread_token: threadToken,
          message,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Falha na resposta do agente.");
      setThreadToken(data.thread_token);
      setMessages((current) => [
        ...current,
        { role: "ai", content: data.reply },
      ]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha na resposta do agente.",
      );
    } finally {
      setBusy(false);
    }
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
    <main className="portfolio-playground">
      <header>
        <div>
          <h1>Playground de carteiras</h1>
          <p>Teste interno dos agentes</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/portfolio/auth", { method: "DELETE" });
            setLoggedIn(false);
            setMessages([]);
            setScopeId(null);
            setThreadToken(null);
          }}
        >
          Sair
        </button>
      </header>
      <section className="portfolio-toolbar">
        <label htmlFor="portfolio">Carteira</label>
        <select
          id="portfolio"
          value={scopeId ?? ""}
          onChange={(event) => selectPortfolio(Number(event.target.value))}
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
        {selected && (
          <p>
            Agente: <strong>{selected.assistant_name}</strong>
            {selected.assistant_id && <small> · {selected.assistant_id}</small>}
          </p>
        )}
        <button
          type="button"
          disabled={!selected || busy}
          onClick={() => {
            setThreadToken(null);
            setMessages([]);
            setError("");
          }}
        >
          Nova conversa
        </button>
      </section>
      {!selected ? (
        <p>Selecione uma carteira para iniciar.</p>
      ) : !selected.chat_ready ? (
        <p role="status">
          Esta carteira já pode ser configurada, mas o chat aguarda isolamento
          de dados no Runtime.
        </p>
      ) : (
        <section
          className="portfolio-conversation"
          aria-label="Conversa"
        >
          <div
            className="portfolio-messages"
            aria-live="polite"
          >
            {messages.map((message, index) => (
              <p
                key={index}
                className={
                  message.role === "human" ? "from-human" : "from-agent"
                }
              >
                <strong>
                  {message.role === "human" ? "Você" : selected.assistant_name}
                </strong>
                <span>{message.content}</span>
              </p>
            ))}
            {busy && <p role="status">Agente respondendo…</p>}
          </div>
          <form onSubmit={send}>
            <label htmlFor="message">Mensagem</label>
            <textarea
              id="message"
              value={draft}
              maxLength={4000}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button
              type="submit"
              disabled={!draft.trim() || busy}
            >
              Enviar
            </button>
          </form>
        </section>
      )}
      {error && (
        <p
          role="alert"
          className="portfolio-error"
        >
          {error}
        </p>
      )}
    </main>
  );
}
