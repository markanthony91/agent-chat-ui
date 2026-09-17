import { test, expect } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`LLM and profile save, reload, defaults and errors (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const id = "2c03ca0a-4481-4e9d-943f-9a1382e644be";
    let record = {
      assistant_id: id,
      graph_id: "agent",
      version: 1,
      metadata: { zerai_default: true },
      context: {
        system_prompt: "Keep prompt",
        agent_instructions: "Keep AGENTS",
        active_workflow: "Keep workflow",
      } as Record<string, unknown>,
    };
    let fail = false;
    let validations = 0;
    await page.route("https://runtime.invalid/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const body = req.postDataJSON();
      if (path === "/assistants/search")
        return route.fulfill({
          json: [{ ...record, graph_id: body.graph_id }],
        });
      if (path.endsWith("/versions")) return route.fulfill({ json: [record] });
      if (path === `/assistants/${id}`) {
        if (req.method() === "PATCH")
          record = {
            ...record,
            version: record.version + 1,
            context: body.context,
          };
        return route.fulfill({ json: record });
      }
      if (path.endsWith("/runs/stream")) {
        const input = body.input;
        let result: Record<string, unknown> = {};
        if (input.operation === "get_llm_config")
          result = {
            model: "Qwen/test-model",
            provider: "API compatível com OpenAI",
            defaults: { temperature: null, top_p: null, max_tokens: null },
          };
        if (input.operation === "validate_runtime_settings") {
          validations++;
          result = input.settings;
        }
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: values\ndata: ${JSON.stringify({ result, error: fail ? "Falha controlada ao validar" : "" })}\n\nevent: end\ndata: {}\n\n`,
        });
      }
      return route.fulfill({
        json: path === "/threads" ? { thread_id: "synthetic-admin" } : [],
      });
    });
    const url = new URL(
      process.env.HEADER_CHAT_URL || "http://127.0.0.1:3046/",
    );
    url.searchParams.set("apiUrl", "https://runtime.invalid");
    url.searchParams.set("assistantId", "agent");
    await page.goto(url.toString());
    const open = async (tab: string) => {
      await page
        .getByRole("button", { name: "Abrir configurações", exact: true })
        .click();
      await page.getByRole("button", { name: tab, exact: true }).click();
    };
    await open("LLM");
    await expect(page.getByText("Qwen/test-model")).toBeVisible();
    await expect(page.getByText(/Salvo: Padrão do provedor/)).toHaveCount(3);
    await page.getByLabel("Temperatura", { exact: true }).fill("3");
    await page.getByRole("button", { name: "Salvar LLM", exact: true }).click();
    expect(validations).toBe(0);
    await page.getByLabel("Temperatura", { exact: true }).fill("0");
    await page.getByLabel("Top-p", { exact: true }).fill("0.8");
    await page
      .getByLabel("Limite de tokens da resposta", { exact: true })
      .fill("1024");
    await page.getByRole("button", { name: "Salvar LLM", exact: true }).click();
    await expect(
      page.getByText("Salvo com sucesso", { exact: true }),
    ).toBeVisible();
    expect(record.context.llm_settings).toEqual({
      temperature: 0,
      top_p: 0.8,
      max_tokens: 1024,
    });
    await page.reload();
    await open("LLM");
    await expect(page.getByLabel("Temperatura", { exact: true })).toHaveValue(
      "0",
    );
    await expect(page.getByLabel("Top-p", { exact: true })).toHaveValue("0.8");
    await expect(
      page.getByLabel("Limite de tokens da resposta", { exact: true }),
    ).toHaveValue("1024");
    await page
      .getByRole("button", { name: "Perfil do agente", exact: true })
      .click();
    await expect(page.getByLabel("Nome do agente")).toBeEnabled();
    await page.getByLabel("Nome do agente").fill("Sofia");
    await page.getByLabel("Função do agente").fill("Atendimento Zerai");
    await page.getByLabel("Tom de voz").fill("Cordial");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(
      page.getByText("Salvo com sucesso", { exact: true }),
    ).toBeVisible();
    expect(record.context.agent_profile).toEqual({
      name: "Sofia",
      role: "Atendimento Zerai",
      tone: "Cordial",
    });
    expect(record.context.system_prompt).toBe("Keep prompt");
    expect(record.context.agent_instructions).toBe("Keep AGENTS");
    expect(record.context.active_workflow).toBe("Keep workflow");
    await page.reload();
    await open("Perfil do agente");
    await expect(page.getByLabel("Nome do agente")).toHaveValue("Sofia");
    await page.getByRole("button", { name: "LLM", exact: true }).click();
    await expect(page.getByLabel("Temperatura", { exact: true })).toBeEnabled();
    for (const label of [
      "Temperatura",
      "Top-p",
      "Limite de tokens da resposta",
    ])
      await page.getByLabel(label, { exact: true }).fill("");
    await page.getByRole("button", { name: "Salvar LLM", exact: true }).click();
    await expect(
      page.getByText("Salvo com sucesso", { exact: true }),
    ).toBeVisible();
    expect(record.context.llm_settings).toEqual({});
    await page.reload();
    await open("LLM");
    await expect(page.getByLabel("Temperatura", { exact: true })).toHaveValue(
      "",
    );
    await expect(page.getByLabel("Temperatura", { exact: true })).toBeEnabled();
    fail = true;
    await page.getByLabel("Temperatura", { exact: true }).fill("0.3");
    await page.getByRole("button", { name: "Salvar LLM", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Falha controlada" }),
    ).toHaveText("Falha controlada ao validar");
    await expect(
      page.getByText("Salvo com sucesso", { exact: true }),
    ).toHaveCount(0);
    expect(record.version).toBe(4);
    expect(record.context.llm_settings).toEqual({});
  });
}
