import { test, expect } from "@playwright/test";

for (const width of [1440, 1024, 390]) {
  for (const started of [false, true]) {
    test(`settings replaces GitHub at ${width}px, started=${started}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route("https://runtime.invalid/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        const json =
          path === "/assistants/search"
            ? [
                {
                  assistant_id: "test-agent",
                  graph_id: "agent",
                  context: { system_prompt: "Test prompt" },
                },
              ]
            : path.endsWith("/state")
              ? { values: { messages: [] }, next: [] }
              : [];
        await route.fulfill({ json });
      });
      const url = new URL(
        process.env.HEADER_CHAT_URL || "http://127.0.0.1:3045/",
      );
      url.searchParams.set("apiUrl", "https://runtime.invalid");
      url.searchParams.set("assistantId", "agent");
      if (started) url.searchParams.set("threadId", "test-thread");
      await page.goto(url.toString());
      await expect(page).toHaveTitle("Agente Zerai");
      await expect(page.getByText("Agente Zerai", { exact: true })).toBeVisible();
      await expect(page.getByText("Agent Chat", { exact: true })).toHaveCount(0);
      const gear = page.getByRole("button", {
        name: "Abrir configurações",
        exact: true,
      });
      await expect(gear).toHaveCount(1);
      await expect(gear).toBeVisible();
      await expect(
        page.locator('a[href="https://github.com/langchain-ai/agent-chat-ui"]'),
      ).toHaveCount(0);
      const box = await gear.boundingBox();
      expect(box!.x).toBeGreaterThan(width - 140);
      expect(box!.y).toBeLessThan(60);
      await gear.focus();
      await gear.press("Enter");
      await expect(
        page.getByRole("heading", { name: "Configurações do agente" }),
      ).toBeVisible();
      await expect(page.locator("textarea").first()).toHaveValue("Test prompt");
      await page.getByRole("button", { name: "Fechar", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Configurações do agente" }),
      ).toHaveCount(0);
      await expect(gear).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await page.screenshot({
        path: `test-results/header-${width}-${started}.png`,
        fullPage: true,
      });
    });
  }
}
