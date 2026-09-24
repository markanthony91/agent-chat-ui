import { test, expect } from "@playwright/test";

for (const width of [1440, 1024, 390]) {
  test(`identity policy saves and reloads at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let fixture = { full_name: "João da Silva", cpf: "12345678900", phone: "+5511949994528",
      identity_policy: { cpf_mode: "full", secondary: "either", max_attempts: 3 } };
    let fail = false;
    await page.route("https://runtime.invalid/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const body = request.postDataJSON();
      if (path.endsWith("/runs/stream")) {
        if (body.input.operation === "save_simulator_fixture" && !fail) fixture = body.input.fixture;
        return route.fulfill({ contentType: "text/event-stream",
          body: `event: values\ndata: ${JSON.stringify({ result: fixture, error: fail ? "Falha controlada" : "" })}\n\n` });
      }
      return route.fulfill({ json: path === "/assistants/search"
        ? [{ assistant_id: "admin", graph_id: body?.graph_id || "agent", context: {} }]
        : path === "/threads" ? { thread_id: "test" } : [] });
    });
    const url = new URL(process.env.HEADER_CHAT_URL || "http://127.0.0.1:3045/");
    url.searchParams.set("apiUrl", "https://runtime.invalid");
    url.searchParams.set("assistantId", "agent");
    await page.goto(url.toString());
    await page.getByRole("button", { name: "Abrir configurações", exact: true }).click();
    await page.getByRole("button", { name: "Simulator", exact: true }).click();
    await expect(page.getByLabel("Telefone dummy")).toHaveValue("+5511949994528");
    await page.getByLabel("Conferência do CPF").selectOption("first4");
    await page.getByLabel("Fator adicional").selectOption("both");
    await page.getByLabel("Máximo de tentativas").fill("4");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText(/Fixture salva/)).toBeVisible();
    expect(fixture.phone).toBe("+5511949994528");
    expect(fixture.identity_policy).toEqual({ cpf_mode: "first4", secondary: "both", max_attempts: 4 });
    await page.getByRole("button", { name: "Recarregar", exact: true }).click();
    await expect(page.getByLabel("Conferência do CPF")).toHaveValue("first4");
    await page.getByLabel("Conferência do CPF").selectOption("last4");
    await page.getByLabel("Fator adicional").selectOption("birth_date");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText(/Fixture salva/)).toBeVisible();
    await page.getByLabel("Conferência do CPF").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `test-results/identity-policy-${width}.png` });
    fail = true;
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Falha controlada", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Dataset", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dataset", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Knowledge", exact: true })).toHaveCount(0);
  });
}
