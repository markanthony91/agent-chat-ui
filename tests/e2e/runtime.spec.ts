import { test, expect, Page } from "@playwright/test";

const target = "/?apiUrl=http%3A%2F%2F127.0.0.1%3A3041&assistantId=agent";

test("numeric post-stream warning persists without retracting or duplicating text", async ({
  page,
}) => {
  await page.goto(target + "&hideToolCalls=true");
  await send(page, "BAD_AMOUNT");
  const text = page.getByText("Proposta inventada de R$ 999,99.", {
    exact: true,
  });
  await expect(text).toBeVisible();
  await expect(page.getByTestId("response-audit")).toContainText(
    "Resposta requer revisão",
  );
  await expect(page.getByTestId("response-audit")).toContainText(
    "Fidelidade semântica não avaliada",
  );
  await expect(text).toHaveCount(1);
  await finished(page);
  await page.reload();
  await expect(text).toHaveCount(1);
  await expect(page.getByTestId("response-audit")).toContainText(
    "Resposta requer revisão",
  );
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByTestId("response-audit")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: `test-results/post-stream-audit-${width}.png`,
      fullPage: true,
    });
  }
});

async function send(page: Page, text: string) {
  const input = page.getByPlaceholder("Type your message...");
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press("Enter");
}

async function finished(page: Page) {
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCount(0);
}

test("happy: identity, debt, policy tool, balanced offer, explicit confirmation", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(target + "&hideToolCalls=true");
  await send(page, "VERIFY");
  await expect(
    page.getByText("Identity verified.", { exact: true }),
  ).toBeVisible();
  await finished(page);
  await send(page, "DEBT");
  await expect(
    page.getByText("Debt total 5873.42", { exact: true }),
  ).toBeVisible();
  await finished(page);
  await send(page, "OFFER");
  await expect(
    page.getByRole("button", { name: "Confirmar oferta simulada" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Confirmar oferta simulada" }).click();
  await expect(
    page.getByText("Agreement confirmed.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/happy-agreement.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByText("Agreement confirmed.", { exact: true }),
  ).toBeVisible();
});

test("negative: another conversation cannot read verified debt", async ({
  page,
}) => {
  await page.goto(target);
  await send(page, "DEBT");
  await expect(
    page.getByText("Identity verification required. Debt withheld.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Debt total 5873.42", { exact: true }),
  ).toHaveCount(0);
});

test("neutral: navigate OKF then refuse out of scope", async ({ page }) => {
  await page.goto(target);
  await send(page, "POLICY");
  await expect(
    page.getByText("Synthetic policy consulted.", { exact: false }).last(),
  ).toBeVisible();
  await finished(page);
  await send(page, "UNKNOWN");
  await expect(
    page.getByText("This subject is outside the synthetic documents.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("real incremental protocol delivery, cancellation and consecutive calls", async ({
  page,
}) => {
  await page.goto(target);
  const start = performance.now();
  await send(page, "LONG");
  await expect(
    page.getByText("STREAM_START", { exact: false }).last(),
  ).toBeVisible();
  const firstText = Math.round(performance.now() - start);
  await page.screenshot({
    path: "test-results/first-text-stream.png",
    fullPage: true,
  });
  await expect(page.getByText("STREAM_END", { exact: false })).toHaveCount(0);
  await expect(
    page.getByText("STREAM_END", { exact: false }).last(),
  ).toBeVisible();
  const total = Math.round(performance.now() - start);
  console.log(
    JSON.stringify({
      scenario: "long-protocol-fixture",
      first_visible_ms: firstText,
      total_ms: total,
    }),
  );
  expect(total - firstText).toBeGreaterThan(1000);
  await finished(page);
  await send(page, "CANCEL");
  await expect(
    page.getByText("CANCEL_START", { exact: false }).last(),
  ).toBeVisible();
  const before = await (
    await page.request.get("http://127.0.0.1:3042/probe")
  ).json();
  const cancellation = page.waitForResponse(
    (response) =>
      response.url().includes("/cancel") && response.status() === 202,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await cancellation;
  await expect
    .poll(
      async () =>
        (await (await page.request.get("http://127.0.0.1:3042/probe")).json())
          .cancellations,
    )
    .toBeGreaterThan(before.cancellations);
  await finished(page);
  await send(page, "UNKNOWN");
  await expect(
    page.getByText("This subject is outside the synthetic documents.", {
      exact: true,
    }),
  ).toBeVisible();
});

for (const [width, height] of [
  [1440, 900],
  [1024, 768],
  [390, 844],
]) {
  test(`layout ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(target);
    await expect(page.getByPlaceholder("Type your message...")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow).toBe(false);
    await page.screenshot({
      path: `test-results/layout-${width}.png`,
      fullPage: true,
    });
  });
}

test("interrupted provider response is reported, never silently completed", async ({
  page,
}) => {
  await page.goto(target);
  await send(page, "ERROR");
  await expect(
    page.getByText("provider_response_incomplete", { exact: false }).last(),
  ).toBeVisible();
  await finished(page);
});

test("admin panels use the same local backend and preserve decimal strings", async ({
  page,
}) => {
  const unexpected: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/runs/") &&
      !request.url().startsWith("http://127.0.0.1:3041/")
    )
      unexpected.push(request.url());
  });
  await page.goto(target);
  await page.getByRole("button", { name: "Abrir configurações" }).click();
  await page.getByRole("button", { name: "Simulator", exact: true }).click();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue(
    "João da Silva",
  );
  await expect(page.getByLabel("Current Amount", { exact: true })).toHaveValue(
    "5873.42",
  );
  await expect(page.getByLabel("Identity Validated")).toHaveCount(0);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Fixture salva.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Knowledge", exact: true }).click();
  await page
    .getByRole("button", { name: "INSTITUTIONS 1", exact: true })
    .click();
  await expect(
    page.getByText("policy.md", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "fastpay/policy.md", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic policy", { exact: false }).first(),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});
