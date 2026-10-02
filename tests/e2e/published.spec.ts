import { test, expect } from "@playwright/test";

// Explicit opt-in only: two synthetic, read-only turns against a published lab.
const chat = process.env.PUBLISHED_CHAT_URL;
const runtime = process.env.PUBLISHED_RUNTIME_URL;
const model = process.env.PUBLISHED_EXPECTED_MODEL;

test("published root opens directly, uses pinned model/tools and preserves history", async ({
  page,
}) => {
  test.skip(
    !chat || !runtime || !model,
    "Published validation requires explicit target and model",
  );
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto(chat!);
  const input = page.getByPlaceholder("Type your message...");
  await expect(input).toBeVisible();
  await expect(page.getByLabel("Deployment URL")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("apiUrl")).toBe(false);
  expect(
    await page.evaluate(() => localStorage.getItem("lg:chat:apiKey")),
  ).toBeNull();

  const started = performance.now();
  await input.fill(
    "Que horas são em UTC? Use a ferramenta de data/hora atual.",
  );
  await input.press("Enter");
  const reply = page.locator(".group.mr-auto .markdown-content");
  await expect(reply.first()).toBeVisible({ timeout: 60000 });
  const firstVisible = Math.round(performance.now() - started);
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCount(0, { timeout: 60000 });
  const total = Math.round(performance.now() - started);
  const thread = new URL(page.url()).searchParams.get("threadId");
  expect(thread).toBeTruthy();
  const stateUrl = `${runtime}/threads/${thread}/state`;
  const state = await (await page.request.get(stateUrl)).json();
  const messages = state.values.messages;
  const finals = messages.filter(
    (message: { type: string; tool_calls?: unknown[] }) =>
      message.type === "ai" && !message.tool_calls?.length,
  );
  expect(finals.at(-1).response_metadata.model_name).toBe(model);
  expect(
    messages.some(
      (message: { type: string; name?: string }) =>
        message.type === "tool" && message.name === "utc_now",
    ),
  ).toBe(true);
  expect(finals.at(-1).additional_kwargs.response_audit.mode).toBe(
    "post_stream",
  );
  await expect(page.getByTestId("response-audit").last()).toBeVisible();
  await page.reload();
  await expect(reply.last()).toBeVisible();
  const restored = await (await page.request.get(stateUrl)).json();
  expect(restored.values.messages).toEqual(messages);

  await input.fill(
    "Consulte o índice da base OKF e informe somente os domínios principais disponíveis. Não leia dados de clientes.",
  );
  await input.press("Enter");
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCount(0, { timeout: 60000 });
  const after = await (await page.request.get(stateUrl)).json();
  const newMessages = after.values.messages.slice(messages.length);
  expect(
    newMessages.some(
      (message: { type: string; name?: string }) =>
        message.type === "tool" && message.name === "okf_index",
    ),
  ).toBe(true);
  expect(newMessages.at(-1).response_metadata.model_name).toBe(model);
  expect(errors).toEqual([]);
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: `test-results/published-${width}.png`,
      fullPage: true,
    });
  }
  console.log(
    JSON.stringify({
      scenario: "published-utc-and-index",
      thread,
      model,
      first_visible_ms: firstVisible,
      total_first_turn_ms: total,
      page_errors: errors.length,
    }),
  );
});
