import { test, expect } from "@playwright/test";
import { Client } from "@langchain/langgraph-sdk";

// Explicit opt-in: a disposable Assistant and one unchanged-content RAW save.
test("published instruction versions and save feedback", async ({ page }) => {
  const chat = process.env.PUBLISHED_CHAT_URL;
  const runtime = process.env.PUBLISHED_RUNTIME_URL;
  test.skip(!chat || !runtime, "Requires explicit published targets");
  test.setTimeout(120000);
  const client = new Client({ apiUrl: runtime! });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  const managed = (
    await client.assistants.search({
      graphId: "agent",
      metadata: { zerai_default: true },
    })
  )[0];
  const assistant = await client.assistants.create({
    graphId: "agent",
    name: "Instruction version validation",
    metadata: { instruction_version_validation: true },
    context: {
      system_prompt: "Synthetic prompt v1",
      agent_instructions: "Synthetic instructions v1",
    },
  });
  try {
    const url = new URL(chat!);
    url.searchParams.set("assistantId", assistant.assistant_id);
    await page.goto(url.toString());
    await page
      .getByRole("button", { name: "Abrir configurações", exact: true })
      .click();
    const editor = page.locator("textarea").first();
    await expect(editor).toHaveValue("Synthetic prompt v1");
    await editor.fill("Synthetic prompt v2");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      page.getByText("Salvo com sucesso", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Versão atual: 2", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ver histórico" }).click();
    await page.getByRole("button", { name: /^v1 ·/ }).click();
    await expect(page.getByLabel("Conteúdo da versão")).toHaveText(
      "Synthetic prompt v1",
    );
    await page
      .getByRole("button", { name: "Agent Instructions", exact: true })
      .click();
    await expect(editor).toHaveValue("Synthetic instructions v1");
    await editor.fill("Synthetic instructions v2");
    await page
      .getByRole("button", { name: "Salvar override", exact: true })
      .click();
    await expect(
      page.getByText("Versão atual: 3", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Abrir configurações", exact: true })
      .click();
    await expect(editor).toHaveValue("Synthetic prompt v2");
    await page.getByRole("button", { name: "Ver histórico" }).click();
    await page.getByRole("button", { name: /^v1 ·/ }).click();
    await page.getByRole("button", { name: "Carregar v1 no editor" }).click();
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      page.getByText("Versão atual: 4", { exact: true }),
    ).toBeVisible();
    const saved = await client.assistants.get(assistant.assistant_id);
    expect(saved.context).toEqual({
      system_prompt: "Synthetic prompt v1",
      agent_instructions: "Synthetic instructions v2",
    });
    expect(
      await client.assistants.getVersions(assistant.assistant_id),
    ).toHaveLength(4);
    await page
      .getByRole("button", { name: "RAW Compiler", exact: true })
      .click();
    await page.getByRole("button", { name: "AGENTS.md", exact: true }).click();
    await expect(editor).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Salvar AGENTS.md" }),
    ).toBeEnabled();
    const original = await editor.inputValue();
    // Do not modify real RAW content, even whitespace, during validation.
    expect(original).toBe(original.trim() + "\n");
    await page.getByRole("button", { name: "Salvar AGENTS.md" }).click();
    await expect(page.getByText(/RAW AGENTS.md · versão/)).toBeVisible();
    await expect(editor).toHaveValue(original);
    await page.getByRole("button", { name: "Ver histórico" }).click();
    await page.getByRole("button", { name: /^v1 ·/ }).click();
    expect(await page.getByLabel("Conteúdo da versão").textContent()).toBe(
      original,
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Abrir configurações", exact: true })
      .click();
    await page
      .getByRole("button", { name: "RAW Compiler", exact: true })
      .click();
    await page.getByRole("button", { name: "AGENTS.md", exact: true }).click();
    await expect(editor).toHaveValue(original);
    expect((await client.assistants.get(managed.assistant_id)).context).toEqual(
      managed.context,
    );
    expect(errors).toEqual([]);
  } finally {
    await client.assistants.delete(assistant.assistant_id);
  }
});
