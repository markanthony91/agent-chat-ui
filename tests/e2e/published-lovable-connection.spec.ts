import { test, expect } from "@playwright/test";
import { Client } from "@langchain/langgraph-sdk";

// Read-only settings check. Never select or save a fallback on the real Assistant.
test("published Lovable connection is available while fallback remains off", async ({
  page,
}) => {
  const chat = process.env.PUBLISHED_CHAT_URL;
  const runtime = process.env.PUBLISHED_RUNTIME_URL;
  const model = process.env.PUBLISHED_LOVABLE_MODEL;
  test.skip(
    !chat || !runtime || !model,
    "Requires explicit published targets/model",
  );
  const client = new Client({ apiUrl: runtime! });
  const before = (
    await client.assistants.search({
      graphId: "agent",
      metadata: { zerai_default: true },
    })
  )[0];
  expect(before).toBeTruthy();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto(chat!);
  await page
    .getByRole("button", { name: "Abrir configurações", exact: true })
    .click();
  const metadata = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.request().postDataJSON()?.input?.operation === "get_llm_config",
  );
  await page.getByRole("button", { name: "LLM", exact: true }).click();
  const body = await (await metadata).text();
  expect(body).toContain(model!);
  expect(body).not.toContain('"api_key"');
  await expect(page.getByLabel("Temperatura", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Conexão principal")).toHaveValue("default");
  await expect(page.getByLabel("Conexão de fallback")).toHaveValue("");
  const option = page
    .getByLabel("Conexão de fallback")
    .locator('option[value="lovable"]');
  await expect(option).toBeEnabled();
  await expect(option).not.toContainText("pendente");
  await expect(
    page.getByRole("button", { name: "Salvar LLM", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const after = await client.assistants.get(before.assistant_id);
  expect(after.context).toEqual(before.context);
  expect(after.version).toBe(before.version);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      lovable_available: true,
      model,
      fallback_enabled: false,
      assistant_unchanged: true,
      page_errors: errors.length,
    }),
  );
});
