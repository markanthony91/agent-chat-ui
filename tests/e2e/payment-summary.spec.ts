import { test, expect } from "@playwright/test";

const summary = `Resumo da sua negociação

Valor da dívida: R$ 5.873,42
Forma de pagamento: Parcelado
Método: Boleto

Parcelamento
1ª parcela: R$ 1.174,69
2ª parcela: R$ 1.174,69
3ª parcela: R$ 1.174,68
4ª parcela: R$ 1.174,68
5ª parcela: R$ 1.174,68

Total da negociação: R$ 5.873,42`;
const previous = `**Resumo da sua negociação**
Valor da dívida: **R$ 5.873,42**
**Valor final: R$ 5.873,42**
Forma de pagamento: **Parcelado**
Método: **Boleto**
1ª parcela: **R$ 1.174,69**
2ª parcela: **R$ 1.174,69**
3ª parcela: **R$ 1.174,68**
4ª parcela: **R$ 1.174,68**
5ª parcela: **R$ 1.174,68**`;

// Reference supplied by the operator: presentation only, never compute amounts.
const reference = {
  valor_divida: "R$ 5.873,42",
  forma_pagamento: "Parcelado",
  metodo_pagamento: "Boleto",
  parcelas: ["R$ 1.957,81", "R$ 1.957,81", "R$ 1.957,80"],
  total_negociacao: "R$ 5.873,42",
  codigo_dummy: "DUMMY-BOLETO-346C0ECE0B5A49D48B82EDE2799EA45B",
  mensagem_simulacao: "Esta simulação não gera cobrança nem pagamento real.",
  proxima_etapa:
    "Para concluir, informe o e-mail que receberá a proposta e as instruções simuladas.",
};
const requested = `Resumo da sua negociação

Valor da dívida: ${reference.valor_divida}
Forma de pagamento: ${reference.forma_pagamento}
Método: ${reference.metodo_pagamento}

Parcelamento
${reference.parcelas.map((value, index) => `${index + 1}ª parcela: ${value}`).join("\n")}

Total da negociação: ${reference.total_negociacao}

Código dummy: ${reference.codigo_dummy}

${reference.mensagem_simulacao}

${reference.proxima_etapa}`;
const cash = `**Resumo da sua negociação**
Valor da dívida: **R$ 5.873,42**
Desconto à vista (3%): − **R$ 176,20**
**Valor final: R$ 5.697,22**
Forma de pagamento: **À vista**
Método: **PIX**
**Você economiza R$ 176,20 pagando à vista.**

Código dummy: DUMMY-PIX-346C0ECE0B5A49D48B82EDE2799EA45B

${reference.mensagem_simulacao}

${reference.proxima_etapa}`;

for (const width of [1440, 390]) {
  for (const [label, text] of [
    ["new", summary],
    ["existing", previous],
    ["requested", requested],
    ["stream", requested],
    ["cash", cash],
  ]) {
    test(`${label} payment summary preserves currency and lines at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.route("**/*", (route) => {
        const request = new URL(route.request().url());
        const frontend = new URL(
          process.env.SUMMARY_CHAT_URL || "http://127.0.0.1:3048/",
        );
        return (request.origin === frontend.origin &&
          !request.pathname.startsWith("/api/")) ||
          request.hostname === "runtime.invalid"
          ? route.continue()
          : route.abort();
      });
      const streaming = label === "stream";
      const state = {
        values: {
          messages: [
            {
              id: "summary",
              type: "ai",
              content: text,
              tool_calls: [],
              response_metadata: { finish_reason: "stop" },
            },
          ],
        },
        next: [],
        tasks: [],
        metadata: { step: 1 },
        checkpoint: {
          thread_id: "summary-test",
          checkpoint_id: "summary-checkpoint",
          checkpoint_ns: "",
        },
        parent_checkpoint: null,
        created_at: "2026-09-28T00:00:00Z",
      };
      const finalMessages = state.values.messages;
      if (streaming) state.values.messages = [];
      await page.route("https://runtime.invalid/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/runs/stream")) {
          state.values.messages = finalMessages;
          return route.fulfill({
            contentType: "text/event-stream",
            body: `event: metadata\ndata: {"run_id":"summary-run"}\n\nevent: values\ndata: ${JSON.stringify(state.values)}\n\nevent: end\ndata: {}\n\n`,
          });
        }
        const assistant = {
          assistant_id: "summary-agent",
          graph_id: "agent",
          context: {},
          metadata: { created_by: "operator" },
        };
        await route.fulfill({
          json: path.endsWith("/history")
            ? [state]
            : path.endsWith("/state")
              ? state
              : path === "/assistants/search"
                ? [assistant]
                : path.startsWith("/assistants/")
                  ? assistant
                  : path.endsWith("/search") || path.endsWith("/runs")
                    ? []
                    : path === "/info"
                      ? {}
                      : {
                          thread_id: "summary-test",
                          values: state.values,
                          metadata: {},
                          status: "idle",
                        },
        });
      });
      const url = new URL(
        process.env.SUMMARY_CHAT_URL || "http://127.0.0.1:3048/",
      );
      url.searchParams.set("apiUrl", "https://runtime.invalid");
      url.searchParams.set("assistantId", "summary-agent");
      url.searchParams.set("threadId", "summary-test");
      await page.goto(url.toString());
      if (streaming) {
        const input = page.locator("textarea");
        await input.fill("Quero parcelar em três vezes por boleto.");
        await input.press("Enter");
      }
      const message = page
        .locator(".payment-summary")
        .filter({ hasText: "Resumo da sua negociação" })
        .last();
      await expect(message).toBeVisible();
      await expect(message.locator(".katex")).toHaveCount(0);
      await expect(message).not.toContainText("**");
      const expectedLines = text
        .replace(/\*\*([^*\n]+)\*\*/g, "$1")
        .split("\n")
        .filter(Boolean);
      for (const line of expectedLines)
        await expect(message.getByText(line, { exact: true })).toBeVisible();
      const count =
        label === "cash" ? 0 : ["requested", "stream"].includes(label) ? 3 : 5;
      const tops = await message.evaluate((el, count) => {
        const result: number[] = [];
        for (let i = 1; i <= count; i++) {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let node: Node | null;
          while ((node = walker.nextNode())) {
            const index = (node.textContent || "").indexOf(`${i}ª parcela:`);
            if (index < 0) continue;
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + 2);
            result.push(range.getBoundingClientRect().top);
            break;
          }
        }
        return result;
      }, count);
      expect(tops).toHaveLength(count);
      for (let i = 1; i < tops.length; i++)
        expect(tops[i]).toBeGreaterThan(tops[i - 1]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await message.screenshot({
        path: `test-results/payment-summary-${label}-${width}.png`,
      });
    });
  }
}
