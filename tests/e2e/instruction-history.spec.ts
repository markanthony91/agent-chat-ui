import { test, expect } from "@playwright/test";
import { Client } from "@langchain/langgraph-sdk";
import { saveAssistantContext } from "../../src/lib/assistant-config";

const id = "2c03ca0a-4481-4e9d-943f-9a1382e644be";

test("a save without a confirmed history version is rejected", async () => {
  const record = { version: 2, context: { system_prompt: "new" } };
  const client = {
    assistants: {
      get: async () => record,
      update: async () => record,
      getVersions: async () => [],
    },
  } as unknown as Client;
  await expect(
    saveAssistantContext(client, id, { system_prompt: "new" }),
  ).rejects.toThrow("versão salva");
});

for (const raw of [false, true]) {
  test(`${raw ? "RAW" : "Agent"} AGENTS history, restore as new version, reload and save error`, async ({
    page,
  }) => {
    let record = {
      assistant_id: id,
      graph_id: "agent",
      metadata: { zerai_default: true },
      version: 1,
      created_at: "2026-09-16T12:00:00Z",
      context: {
        system_prompt: "Keep this prompt",
        agent_instructions: "Original instructions",
      },
    };
    const versions = [structuredClone(record)];
    const rawVersions = [
      {
        version: 1,
        created_at: record.created_at,
        content: "Original instructions",
        source: "default",
      },
    ];
    let fail = false;
    await page.route("https://runtime.invalid/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const body = req.postDataJSON();
      if (path === "/assistants/search")
        return route.fulfill({
          json: [{ ...record, graph_id: body.graph_id }],
        });
      if (path.endsWith("/versions"))
        return route.fulfill({ json: versions.slice().reverse() });
      if (path === `/assistants/${id}`) {
        if (req.method() === "PATCH") {
          if (fail)
            return route.fulfill({
              status: 400,
              json: { detail: "Controlled save error" },
            });
          record = {
            ...record,
            version: record.version + 1,
            context: body.context,
          };
          versions.push(structuredClone(record));
        }
        return route.fulfill({ json: record });
      }
      if (path.endsWith("/runs/stream")) {
        const input = body.input;
        let result: unknown;
        if (input.operation === "get_agents") result = rawVersions.at(-1);
        if (input.operation === "get_agents_versions")
          result = { versions: rawVersions.slice().reverse() };
        if (input.operation === "save_agents" && !fail) {
          rawVersions.push({
            ...rawVersions[0],
            version: rawVersions.length + 1,
            content: input.agents_content,
            source: "runtime_override",
          });
          result = { ...rawVersions.at(-1), saved: true };
        }
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: values\ndata: ${JSON.stringify({ result, error: fail ? "Controlled save error" : "" })}\n\nevent: end\ndata: {}\n\n`,
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
    const open = async () => {
      await page
        .getByRole("button", { name: "Abrir configurações", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: raw ? "RAW Compiler" : "Agent Instructions",
          exact: true,
        })
        .click();
      if (raw)
        await page
          .getByRole("button", { name: "AGENTS.md", exact: true })
          .click();
      await expect(page.locator("textarea").first()).toBeEnabled();
    };
    await open();
    const editor = page.locator("textarea").first();
    await expect(editor).toHaveValue("Original instructions");
    if (!raw) {
      const loadedAgents = `# Instructions\n\n${Array.from(
        { length: 80 },
        (_, index) => `linha ${index + 1}`,
      ).join("\n")}\nInstructions finais`;
      await page.getByLabel("Arquivo Markdown do AGENTS.md").setInputFiles({
        name: "AGENTS.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(loadedAgents),
      });
      await expect(editor).toHaveValue(loadedAgents);
      const agentsSearch = page.getByRole("textbox", {
        name: "Buscar no AGENTS.md",
        exact: true,
      });
      await agentsSearch.fill("Instructions");
      await expect(
        page.getByTestId("agent-instructions-highlight-layer").locator("mark"),
      ).toHaveCount(2);
      await agentsSearch.press("Enter");
      const firstMatchScrollTop = await editor.evaluate(
        (element) => element.scrollTop,
      );
      await page.keyboard.press("Enter");
      await expect(agentsSearch).toBeFocused();
      await expect
        .poll(() => editor.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(firstMatchScrollTop);
      await expect(editor).toHaveValue(loadedAgents);
      await expect(
        page.getByText("Alterações não salvas", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("arquivo local carregado (ainda não salvo)", {
          exact: false,
        }),
      ).toBeVisible();
      expect(versions).toHaveLength(1);
    }
    await editor.fill("Changed instructions");
    const save = page.getByRole("button", {
      name: raw ? "Salvar AGENTS.md" : "Salvar override",
      exact: true,
    });
    await save.click();
    await expect(
      page.getByText("Salvo com sucesso", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Versão atual: 2", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await open();
    await expect(editor).toHaveValue("Changed instructions");
    await page.getByRole("button", { name: "Ver histórico" }).click();
    await page.getByRole("button", { name: /^v1 ·/ }).click();
    await expect(page.getByLabel("Conteúdo da versão")).toHaveText(
      "Original instructions",
    );
    await page.getByRole("button", { name: "Carregar v1 no editor" }).click();
    expect(
      raw ? rawVersions.at(-1)?.content : record.context.agent_instructions,
    ).toBe("Changed instructions");
    await save.click();
    await expect(
      page.getByText("Versão atual: 3", { exact: true }),
    ).toBeVisible();
    expect(record.context.system_prompt).toBe("Keep this prompt");
    expect(raw ? rawVersions.length : versions.length).toBe(3);
    await page.reload();
    await open();
    await expect(editor).toHaveValue("Original instructions");
    fail = true;
    await editor.fill("This must not save");
    await save.click();
    await expect(page.getByText(/Controlled save error/).first()).toBeVisible();
    await expect(
      page.getByText("Salvo com sucesso", { exact: true }),
    ).toHaveCount(0);
    expect(raw ? rawVersions.length : versions.length).toBe(3);
  });
}

test("Workflow Save confirms success and preserves instructions", async ({
  page,
}) => {
  let record = {
    assistant_id: id,
    graph_id: "agent",
    metadata: { zerai_default: true },
    version: 1,
    context: {
      system_prompt: "Keep prompt",
      workflows: { sample: "Original workflow" },
      active_workflow_id: "sample",
      active_workflow: "Original workflow",
    },
  };
  const versions = [structuredClone(record)];
  await page.route("https://runtime.invalid/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === "/assistants/search") return route.fulfill({ json: [record] });
    if (path.endsWith("/versions"))
      return route.fulfill({ json: versions.slice().reverse() });
    if (path === `/assistants/${id}`) {
      if (req.method() === "PATCH") {
        record = {
          ...record,
          version: record.version + 1,
          context: req.postDataJSON().context,
        };
        versions.push(structuredClone(record));
      }
      return route.fulfill({ json: record });
    }
    return route.fulfill({ json: [] });
  });
  const url = new URL(process.env.HEADER_CHAT_URL || "http://127.0.0.1:3046/");
  url.searchParams.set("apiUrl", "https://runtime.invalid");
  url.searchParams.set("assistantId", "agent");
  await page.goto(url.toString());
  await page
    .getByRole("button", { name: "Abrir configurações", exact: true })
    .click();
  await page.getByRole("button", { name: "Workflows", exact: true }).click();
  await expect(page.locator("textarea").first()).toHaveValue(
    "Original workflow",
  );
  await expect(page.getByText("V1", { exact: true })).toBeVisible();
  const workflowToolbar = page
    .getByPlaceholder("Nome do novo workflow")
    .locator("..");
  await expect(
    workflowToolbar.getByRole("button", { name: "Novo", exact: true }),
  ).toBeVisible();
  await expect(
    workflowToolbar.getByRole("button", {
      name: "Carregar .md",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Carregar .md", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByText(/Versão atual:/)).toHaveCount(0);
  await page.getByLabel("Buscar no workflow").fill("workflow");
  await expect(page.getByText("1 resultado", { exact: true })).toBeVisible();
  await expect(
    page.getByTestId("workflow-highlight-layer").locator("mark"),
  ).toHaveCount(1);
  await page.getByLabel("Buscar no workflow").press("Enter");
  await expect(page.getByText("1 de 1", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Buscar no workflow")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("textarea").first()).toHaveValue(
    "Original workflow",
  );
  await expect
    .poll(() =>
      page
        .locator("textarea")
        .first()
        .evaluate((editor) => {
          const input = editor as HTMLTextAreaElement;
          return input.value.slice(input.selectionStart, input.selectionEnd);
        }),
    )
    .toBe("workflow");
  await page.getByLabel("Ver workflow em tela cheia").click();
  await expect(page.getByLabel("Sair da tela cheia")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Ver workflow em tela cheia")).toBeVisible();
  await page.locator("textarea").first().fill("New workflow");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Salvo com sucesso", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Versão atual:/)).toHaveCount(0);
  expect(record.context.system_prompt).toBe("Keep prompt");
  expect(record.context.active_workflow).toBe("New workflow");
  await page.getByRole("button", { name: "Ver histórico" }).click();
  await page.getByRole("button", { name: /^v1 ·/ }).click();
  await expect(page.getByLabel("Conteúdo da versão")).toHaveText(
    "Original workflow",
  );
  await page.getByRole("button", { name: "Carregar v1 no editor" }).click();
  await expect(page.locator("textarea").first()).toHaveValue(
    "Original workflow",
  );
  expect(record.context.active_workflow).toBe("New workflow");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText(/Versão atual:/)).toHaveCount(0);
  expect(record.context.system_prompt).toBe("Keep prompt");
  expect(record.context.active_workflow).toBe("Original workflow");
  const distantWorkflow = `# Fluxo\n\nVersão: 6\n\nworkflow\n${Array.from(
    { length: 80 },
    (_, index) => `linha ${index + 1}`,
  ).join("\n")}\nworkflow`;
  await page.getByLabel("Arquivo Markdown do workflow").setInputFiles({
    name: "flow_consolidado_v6_logico.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(distantWorkflow),
  });
  await expect(
    page.getByText("flow_consolidado_v6_logico.md", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("V6", { exact: true })).toBeVisible();
  expect(
    (record.context.workflows as Record<string, string>)[
      "flow_consolidado_v6_logico.md"
    ],
  ).toBe(distantWorkflow);
  expect(record.context.active_workflow).toBe("Original workflow");
  await page.getByLabel("Buscar no workflow").fill("workflow");
  await expect(
    page.getByTestId("workflow-highlight-layer").locator("mark"),
  ).toHaveCount(2);
  await page.getByLabel("Buscar no workflow").press("Enter");
  await expect(page.getByText("1 de 2", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Buscar no workflow")).toBeFocused();
  const firstMatchScrollTop = await page
    .locator("textarea")
    .first()
    .evaluate((editor) => editor.scrollTop);
  await page.keyboard.press("Enter");
  await expect(page.getByText("2 de 2", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("textarea")
        .first()
        .evaluate((editor) => editor.scrollTop),
    )
    .toBeGreaterThan(firstMatchScrollTop);
  await expect(page.locator("textarea").first()).toHaveValue(distantWorkflow);
  expect(versions).toHaveLength(4);
});
