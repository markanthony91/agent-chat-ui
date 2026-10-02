"use client";

import { FormEvent, useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
  Zap,
} from "lucide-react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [otpPending, setOtpPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    setBusy(true);
    try {
      const response = await fetch("/api/portfolio/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok)
        return setError(
          "E-mail ou senha inválidos, ou acesso temporariamente indisponível.",
        );
      setPassword("");
      setOtpPending(true);
    } catch {
      setError("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/portfolio/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok)
        return setError(
          "Código inválido ou expirado. Confira o e-mail e tente novamente.",
        );
      setCode("");
      setLoggedIn(true);
    } catch {
      setError("Não foi possível verificar o código. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function selectPortfolio(value: number) {
    await setThreadId(null);
    setScopeId(value);
    setError("");
  }

  if (!loggedIn)
    return (
      <main className="portfolio-login">
        <div className="portfolio-login__layout">
          <section className="portfolio-login__intro">
            <div className="portfolio-login__brand">
              <span
                className="portfolio-login__wordmark"
                aria-label="Zerai"
              >
                <span>Z</span>erai
              </span>
              <span className="portfolio-login__brand-caption">
                Plataforma de Inteligência Conversacional
              </span>
            </div>

            <div className="portfolio-login__welcome">
              <h1>
                Bem-vindo <span>de volta!</span>
              </h1>
              <p>
                Acesse o ambiente interno e continue impulsionando conversas que
                geram resultados.
              </p>
            </div>

            <div className="portfolio-login__features">
              <div className="portfolio-login__feature">
                <span className="portfolio-login__feature-icon">
                  <MessageCircle aria-hidden="true" />
                </span>
                <div>
                  <strong>Agentes por carteira</strong>
                  <p>Teste cada agente no seu próprio contexto.</p>
                </div>
              </div>
              <div className="portfolio-login__feature">
                <span className="portfolio-login__feature-icon">
                  <Zap aria-hidden="true" />
                </span>
                <div>
                  <strong>Conversas em tempo real</strong>
                  <p>Acompanhe respostas e chamadas de tools.</p>
                </div>
              </div>
              <div className="portfolio-login__feature">
                <span className="portfolio-login__feature-icon">
                  <BarChart3 aria-hidden="true" />
                </span>
                <div>
                  <strong>Testes com clareza</strong>
                  <p>Valide o comportamento antes de avançar.</p>
                </div>
              </div>
            </div>

            <p className="portfolio-login__signature">
              Pessoas. Conversas. Resultados.
              <br />
              Isso é Zerai.
            </p>
          </section>

          <form
            className="portfolio-login__card"
            onSubmit={otpPending ? verifyCode : login}
          >
            <span
              className="portfolio-login__wordmark portfolio-login__wordmark--card"
              aria-label="Zerai"
            >
              <span>Z</span>erai
            </span>
            <h2>{otpPending ? "Confirme seu acesso" : "Acesso interno"}</h2>
            <p className="portfolio-login__card-lead">
              {otpPending
                ? `Enviamos um código de seis dígitos para ${email}.`
                : "Entre com seu e-mail e senha para continuar."}
            </p>
            {otpPending ? (
              <>
                <label htmlFor="code">Código de acesso</label>
                <div className="portfolio-login__password">
                  <LockKeyhole aria-hidden="true" />
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <label htmlFor="email">E-mail</label>
                <div className="portfolio-login__password">
                  <Mail aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="seu@email.com"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <label htmlFor="password">Senha</label>
                <div className="portfolio-login__password">
                  <LockKeyhole aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>
              </>
            )}
            {error && <p role="alert">{error}</p>}
            <button
              className="portfolio-login__submit"
              type="submit"
              disabled={busy}
            >
              {otpPending ? "Confirmar código" : "Enviar código"}{" "}
              <ArrowRight aria-hidden="true" />
            </button>
            {otpPending && (
              <button
                type="button"
                className="portfolio-login__back"
                onClick={() => {
                  setOtpPending(false);
                  setCode("");
                  setError("");
                }}
              >
                Voltar ao login
              </button>
            )}
            <div className="portfolio-login__restricted">
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>Acesso restrito</strong>
                <p>Ambiente exclusivo para a equipe Zerai.</p>
              </div>
            </div>
          </form>
        </div>
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
