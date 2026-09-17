import { test, expect } from "@playwright/test";
import { Client } from "@langchain/langgraph-sdk";

// Explicit opt-in. Save only a disposable Assistant; never activate a provider.
test("published settings persist while fallback stays off and Qwen tools work", async ({
  page,
}) => {
  const chat = process.env.PUBLISHED_CHAT_URL;
  const runtime = process.env.PUBLISHED_RUNTIME_URL;
  const model = process.env.PUBLISHED_EXPECTED_MODEL;
  test.skip(
    !chat || !runtime || !model,
    "Requires explicit published targets and model",
  );
  test.setTimeout(180000);
  const client = new Client({ apiUrl: runtime! });
  const managed = (
    await client.assistants.search({
      graphId: "agent",
      metadata: { zerai_default: true },
    })
  )[0];
  expect(managed).toBeTruthy();
  const context = {
    system_prompt:
      "Você participa de um teste sintético. Quando perguntarem a hora, use utc_now uma vez e responda brevemente em português. Não consulte clientes nem faça operações comerciais.",
    agent_instructions:
      "Use apenas a ferramenta utc_now neste teste sintético.",
    active_workflow: "Consultar a hora e responder.",
  };
  const assistant = await client.assistants.create({
    graphId: "agent",
    name: "Disposable settings rollout check",
    metadata: { settings_rollout_validation: true },
    context,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  let thread: string | null = null;
  try {
    const url = new URL(chat!);
    url.searchParams.set("assistantId", assistant.assistant_id);
    await page.goto(url.toString());
    await expect(page.getByPlaceholder("Type your message...")).toBeVisible();
    await expect(page.getByLabel("Deployment URL")).toHaveCount(0);
    const open = async (tab: string) => {
      await page
        .getByRole("button", { name: "Abrir configurações", exact: true })
        .click();
      await page.getByRole("button", { name: tab, exact: true }).click();
    };
    await open("LLM");
    await expect(page.getByLabel("Temperatura", { exact: true })).toBeEnabled();
    await expect(page.getByLabel("Conexão principal")).toHaveValue("default");
    await expect(page.getByLabel("Conexão de fallback")).toHaveValue("");
    for (const id of ["lovable", "external"])
      await expect(
        page.getByLabel("Conexão de fallback").locator(`option[value="${id}"]`),
      ).toBeDisabled();
    await expect(page.getByText(model!, { exact: true })).toBeVisible();
    await page.getByLabel("Temperatura", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Salvar LLM", exact: true }).click();
    await expect(
      page.getByText("LLM · versão 2", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Salvo com sucesso", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Perfil do agente", exact: true })
      .click();
    await expect(page.getByLabel("Nome do agente")).toBeEnabled();
    await page.getByLabel("Nome do agente").fill("Sofia");
    await page.getByLabel("Função do agente").fill("Validação sintética");
    await page.getByLabel("Tom de voz").fill("Breve e cordial");
    await page
      .getByRole("button", { name: "Salvar perfil", exact: true })
      .click();
    await expect(
      page.getByText("Perfil do agente · versão 3", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await open("LLM");
    await expect(page.getByLabel("Temperatura", { exact: true })).toHaveValue(
      "0",
    );
    await expect(page.getByLabel("Conexão de fallback")).toHaveValue("");
    const saved = await client.assistants.get(assistant.assistant_id);
    expect(saved.context).toEqual({
      ...context,
      llm_settings: { temperature: 0 },
      llm_integration: { primary: "default" },
      agent_profile: {
        name: "Sofia",
        role: "Validação sintética",
        tone: "Breve e cordial",
      },
    });
    expect(
      await client.assistants.getVersions(assistant.assistant_id),
    ).toHaveLength(3);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await page.screenshot({
        path: `test-results/published-llm-settings-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Perfil do agente", exact: true })
      .click();
    await expect(page.getByLabel("Nome do agente")).toHaveValue("Sofia");
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    const input = page.getByPlaceholder("Type your message...");
    await input.fill("Que horas são em UTC? Consulte utc_now e responda.");
    await input.press("Enter");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("threadId"))
      .toBeTruthy();
    thread = new URL(page.url()).searchParams.get("threadId");
    await expect
      .poll(
        async () => {
          const state = await client.threads.getState(thread!);
          const messages =
            (
              state.values as {
                messages?: Array<{ type?: string; tool_calls?: unknown[] }>;
              }
            ).messages || [];
          return (
            messages.some((m) => m.type === "tool") &&
            messages.at(-1)?.type === "ai" &&
            !messages.at(-1)?.tool_calls?.length
          );
        },
        { timeout: 90000 },
      )
      .toBe(true);
    const state = await client.threads.getState(thread!);
    const messages = (
      state.values as {
        messages: Array<{
          type: string;
          name?: string;
          content?: string;
          response_metadata?: { model_name?: string };
          additional_kwargs?: { llm_route?: unknown };
        }>;
      }
    ).messages;
    expect(
      messages.filter((m) => m.type === "tool").map((m) => m.name),
    ).toEqual(["utc_now"]);
    expect(messages.at(-1)?.response_metadata?.model_name).toBe(model);
    expect(messages.at(-1)?.additional_kwargs?.llm_route).toEqual({
      connection: "default",
      model,
      fallback_used: false,
    });
    expect(messages.at(-1)?.content).toContain("Sofia");
    await expect(
      page.locator(".group.mr-auto .markdown-content").last(),
    ).toBeVisible();
    const current = await client.assistants.get(managed.assistant_id);
    expect(current.context).toEqual(managed.context);
    expect(current.version).toBe(managed.version);
    expect(errors).toEqual([]);
    console.log(
      JSON.stringify({
        scenario: "published-runtime-settings",
        assistant_versions: 3,
        model,
        tool: "utc_now",
        fallback_used: false,
        page_errors: errors.length,
      }),
    );
  } finally {
    if (thread) await client.threads.delete(thread);
    await client.assistants.delete(assistant.assistant_id);
  }
});
