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

for (const width of [1440, 390]) {
  for (const [label, text] of [
    ["new", summary],
    ["existing", previous],
  ]) {
    test(`${label} payment summary preserves currency and lines at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
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
      await page.route("https://runtime.invalid/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
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
      const message = page
        .locator(".markdown-content")
        .filter({ hasText: "Resumo da sua negociação" })
        .last();
      await expect(message).toBeVisible();
      await expect(message.locator(".katex")).toHaveCount(0);
      await expect(message).not.toContainText("**");
      for (const line of [
        "1ª parcela: R$ 1.174,69",
        "2ª parcela: R$ 1.174,69",
        "3ª parcela: R$ 1.174,68",
        "4ª parcela: R$ 1.174,68",
        "5ª parcela: R$ 1.174,68",
      ]) {
        await expect(message).toContainText(line);
      }
      const tops = await message.evaluate((el) => {
        const result: number[] = [];
        for (let i = 1; i <= 5; i++) {
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
      });
      expect(tops).toHaveLength(5);
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
