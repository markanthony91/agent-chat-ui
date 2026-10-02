import { test, expect } from "@playwright/test";

test("keeps the thread and blocks resubmission while the runtime restarts", async ({
  page,
}) => {
  const assistantId = "2c03ca0a-4481-4e9d-943f-9a1382e644be";
  let healthy = true;
  let runs = 0;
  let historyCalls = 0;
  const state = {
    values: {
      messages: [{ id: "saved", type: "ai", content: "Contexto preservado" }],
    },
    next: [],
    tasks: [],
    metadata: { step: 1 },
    checkpoint: {
      thread_id: "restart-test",
      checkpoint_id: "checkpoint-1",
      checkpoint_ns: "",
    },
    parent_checkpoint: null,
    created_at: "2026-09-28T00:00:00Z",
  };

  await page.route("https://runtime.invalid/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/info")
      return route.fulfill({ status: healthy ? 200 : 503, json: {} });
    if (path === `/assistants/${assistantId}`)
      return route.fulfill({
        json: {
          assistant_id: assistantId,
          graph_id: "agent",
          context: {},
          metadata: { created_by: "operator" },
        },
      });
    if (path.endsWith("/history")) {
      historyCalls++;
      return route.fulfill({ json: [state] });
    }
    if (path.endsWith("/state")) return route.fulfill({ json: state });
    if (path.endsWith("/runs/stream")) {
      runs++;
      healthy = false;
      return route.abort("connectionreset");
    }
    return route.fulfill({ json: [] });
  });

  const url = new URL("http://localhost:3048/");
  url.searchParams.set("apiUrl", "https://runtime.invalid");
  url.searchParams.set("assistantId", assistantId);
  url.searchParams.set("threadId", "restart-test");
  await page.goto(url.toString());
  await expect(page.getByText("Contexto preservado")).toBeVisible();

  const input = page.getByPlaceholder("Type your message...");
  await input.fill("Enviar e-mail");
  await input.press("Enter");
  await expect(page.getByRole("status")).toContainText("Reconectando");
  await expect(page.getByPlaceholder("Aguardando reconexão…")).toBeDisabled();
  expect(runs).toBe(1);

  healthy = true;
  await expect(page.getByPlaceholder("Type your message...")).toBeVisible();
  await expect(page.getByText("Contexto preservado")).toBeVisible();
  await expect.poll(() => page.url()).toContain("threadId=restart-test");
  expect(runs).toBe(1);
  expect(historyCalls).toBe(0);
});
