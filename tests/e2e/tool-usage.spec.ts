import { test, expect } from "@playwright/test";

for (const width of [1440, 1024, 390]) {
  test(`tool usage is readable and read-only at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let legacy = false;
    let fail = false;
    const operations: string[] = [];
    await page.route("https://runtime.invalid/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const body = request.postDataJSON();
      if (path.endsWith("/runs/stream")) {
        operations.push(body.input.operation);
        const tool = {
          name: "verify_customer_identity",
          enabled: true,
          category: "collection",
          description: "Resumo do catálogo",
          mode: "write",
          risk: "medium",
          ...(!legacy
            ? {
                usage_description:
                  "Verify CPF plus full_name OR birth_date.\nOnly verified=true establishes identity.",
                parameters: {
                  type: "object",
                  properties: { cpf: { type: "string" } },
                  required: ["cpf"],
                },
              }
            : {}),
        };
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: values\ndata: ${JSON.stringify({ result: fail ? [] : [tool], error: fail ? "Falha controlada" : "" })}\n\n`,
        });
      }
      return route.fulfill({
        json:
          path === "/assistants/search"
            ? [
                {
                  assistant_id: "admin-test",
                  graph_id: body?.graph_id || "agent",
                  context: {},
                },
              ]
            : path === "/threads"
              ? { thread_id: "admin-test" }
              : [],
      });
    });
    const url = new URL(
      process.env.HEADER_CHAT_URL || "http://127.0.0.1:3045/",
    );
    url.searchParams.set("apiUrl", "https://runtime.invalid");
    url.searchParams.set("assistantId", "agent");
    await page.goto(url.toString());
    await page
      .getByRole("button", { name: "Abrir configurações", exact: true })
      .click();
    await page.getByRole("button", { name: "Tools", exact: true }).click();
    const summary = page.getByText("Detalhes de uso", { exact: true });
    await expect(summary).toBeVisible();
    await summary.focus();
    await summary.press("Enter");
    await expect(
      page.getByText(/Only verified=true establishes identity/),
    ).toBeVisible();
    await expect(page.locator("pre")).toContainText('"required"');
    await expect(page.locator("pre")).toContainText('"cpf"');
    await expect(
      page.getByRole("switch", { name: "Habilitar verify_customer_identity" }),
    ).toBeChecked();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: `test-results/tool-usage-${width}.png`,
      fullPage: true,
    });
    legacy = true;
    await page.getByRole("button", { name: "Atualizar", exact: true }).click();
    await expect(
      page.getByText("Descrição de uso indisponível nesta versão do backend."),
    ).toBeVisible();
    fail = true;
    await page.getByRole("button", { name: "Atualizar", exact: true }).click();
    await expect(
      page.getByText("Falha controlada", { exact: true }),
    ).toBeVisible();
    expect(operations).toEqual(["list_tools", "list_tools", "list_tools"]);
  });
}
