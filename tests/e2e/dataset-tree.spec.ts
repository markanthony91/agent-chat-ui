import { test, expect } from "@playwright/test";

for (const width of [1440, 1024, 390]) {
  test(`Dataset filters and navigates nested folders at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const files = ["index.md", "log.md", "GLOBAL/identificação.md",
      "INSTITUTIONS/index.md", "INSTITUTIONS/fastpay/index.md",
      "INSTITUTIONS/fastpay/cards/regras.md", "INSTITUTIONS/usedigi/index.md",
      "institutions/index.md"];
    const reads: string[] = [];
    const operations: string[] = [];
    let fail = false;
    const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const documents = files.map((path) => ({
      path, title: path.includes("regras") ? "Condições de atendimento" : path.split("/").at(-1),
      type: path.includes("regras") ? "POLICY" : "INDEX",
      snippet: path.includes("regras") ? "Indenização prevista na política." : "",
      line: path.includes("regras") ? 12 : null,
    }));
    await page.route("https://runtime.invalid/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const body = request.postDataJSON();
      if (path.endsWith("/runs/stream")) {
        const input = body.input;
        if (input.query === "lenta") await new Promise((resolve) => setTimeout(resolve, 900));
        operations.push(input.operation);
        if (input.operation === "read") reads.push(input.path);
        const result = input.operation === "catalog"
          ? { documents: documents.filter((doc) => normalize(doc.path + doc.title + doc.snippet).includes(normalize(input.query || ""))), bundle_id: "snapshot-a", bundle_name: "Synthetic", bundle_version: "0.2" }
          : input.operation === "read" ? { content: "# Conteúdo sintético do arquivo selecionado" } : [];
        return route.fulfill({ contentType: "text/event-stream",
          body: `event: values\ndata: ${JSON.stringify({ result, error: fail || input.query === "falha" ? "Falha controlada de leitura" : "" })}\n\n` });
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
    await page.getByRole("button", { name: "Dataset", exact: true }).click();
    const tree = page.getByRole("navigation", { name: "Arquivos do Dataset" });
    const folder = (path: string) => tree.getByRole("button", { name: `Pasta ${path}`, exact: true });
    const file = (path: string) => tree.getByRole("button", { name: `Arquivo ${path}`, exact: true });
    const input = page.getByRole("searchbox", { name: "Filtrar arquivos e pastas" });
    await expect(file("index.md")).toBeVisible(); // root documents are not a fake folder
    await expect(folder("INSTITUTIONS/fastpay")).toHaveCount(0);
    await folder("INSTITUTIONS").focus();
    await folder("INSTITUTIONS").press("Enter");
    await expect(folder("INSTITUTIONS/fastpay")).toBeVisible();
    await expect(folder("INSTITUTIONS/usedigi")).toBeVisible();
    await expect(file("INSTITUTIONS/index.md")).toBeVisible();
    await expect(file("INSTITUTIONS/fastpay/index.md")).toHaveCount(0);
    await folder("INSTITUTIONS/fastpay").click();
    await folder("INSTITUTIONS/fastpay/cards").click();
    await file("INSTITUTIONS/fastpay/cards/regras.md").click();
    await expect(page.locator("pre")).toContainText("Conteúdo sintético");
    await expect(file("INSTITUTIONS/fastpay/cards/regras.md")).toHaveAttribute("aria-current", "true");
    expect(reads).toEqual(["INSTITUTIONS/fastpay/cards/regras.md"]);
    await input.fill("FASTPAY");
    await expect(page.getByRole("status")).toHaveText("2 de 8");
    await expect(folder("INSTITUTIONS/usedigi")).toHaveCount(0);
    await expect(file("INSTITUTIONS/fastpay/cards/regras.md")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("2 de 8");
    await folder("INSTITUTIONS/fastpay/cards").click();
    await expect(file("INSTITUTIONS/fastpay/cards/regras.md")).toHaveCount(0);
    await input.fill("identificacao");
    await expect(page.getByRole("status")).toHaveText("1 de 8");
    await expect(file("GLOBAL/identificação.md")).toBeVisible();
    await expect(folder("INSTITUTIONS")).toHaveCount(0);
    await input.fill("sem-correspondencia");
    await expect(tree).toContainText("Nenhum arquivo ou pasta corresponde ao filtro.");
    await page.getByRole("button", { name: "Limpar busca" }).click();
    await expect(folder("INSTITUTIONS/fastpay/cards")).toBeVisible();
    await expect(folder("institutions")).toBeVisible(); // no case-sensitive identity changes
    await expect(page.getByRole("status")).toHaveText("8 de 8");
    await input.fill("INDENIZACAO"); // Only in the body, not in its path/title.
    await expect(page.getByRole("status")).toHaveText("1 de 8");
    await expect(file("INSTITUTIONS/fastpay/cards/regras.md")).toContainText("Condições de atendimento");
    await expect(file("INSTITUTIONS/fastpay/cards/regras.md")).toContainText("L12: Indenização");
    await page.getByRole("button", { name: "POLICY (1)", exact: true }).click();
    await expect(file("INSTITUTIONS/fastpay/cards/regras.md")).toBeVisible();
    await page.getByRole("button", { name: "INDEX (0)", exact: true }).click();
    await expect(tree).toContainText("Nenhum arquivo ou pasta");
    await page.getByRole("button", { name: "Todos (1)", exact: true }).click();
    const slow = page.waitForRequest((req) => req.url().endsWith("/runs/stream") && req.postDataJSON()?.input?.query === "lenta");
    await input.fill("lenta");
    await slow;
    await input.fill("indenizacao");
    await expect(page.getByRole("status")).toHaveText("1 de 8");
    await page.waitForTimeout(1000); // Delayed old response must not replace current results.
    await expect(page.getByRole("status")).toHaveText("1 de 8");
    await input.fill("falha");
    await expect(page.getByRole("alert").filter({ hasText: "Falha na busca" })).toBeVisible();
    await page.getByRole("button", { name: "Limpar busca" }).click();
    await input.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `test-results/dataset-tree-${width}.png` });
    fail = true;
    await file("log.md").click();
    await expect(page.getByText("Falha controlada de leitura", { exact: true })).toBeVisible();
    expect(operations.every(op => ["catalog", "list_drafts", "list_versions", "read"].includes(op))).toBe(true);
  });
}
