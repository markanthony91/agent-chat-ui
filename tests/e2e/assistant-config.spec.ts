import { test, expect } from "@playwright/test";
import { Client } from "@langchain/langgraph-sdk";
import {
  resolveAssistant,
  saveAssistantContext,
} from "../../src/lib/assistant-config";

const id = "2c03ca0a-4481-4e9d-943f-9a1382e644be";
const managed = {
  version: 1,
  created_at: "2026-09-16T12:00:00Z",
  assistant_id: id,
  graph_id: "agent",
  metadata: { zerai_default: true },
  context: {
    system_prompt: "Saved prompt",
    agent_instructions: "Keep rules",
    active_workflow: "Keep workflow",
  },
};

test("resolver supports graph default, explicit UUID, missing and ambiguous configurations", async () => {
  let matches = [managed];
  let lookups = 0;
  const client = {
    assistants: {
      search: async () => {
        lookups++;
        return matches;
      },
      get: async (ref: string) => {
        expect(ref).toBe(id);
        return managed;
      },
    },
  } as unknown as Client;
  expect((await resolveAssistant(client, "agent")).assistant_id).toBe(id);
  expect((await resolveAssistant(client, id)).assistant_id).toBe(id);
  expect(lookups).toBe(1);
  matches = [managed, managed];
  await expect(resolveAssistant(client, "agent")).rejects.toThrow("Mais de um");
  matches = [];
  await expect(resolveAssistant(client, "agent")).rejects.toThrow(
    "não encontrado",
  );
});

test("saving reads fresh context, preserves other settings, confirms read-back", async () => {
  let context = { ...managed.context };
  let version = 1;
  const client = {
    assistants: {
      get: async () => ({ ...managed, context, version }),
      getVersions: async () => [{ ...managed, context, version }],
      update: async (_id: string, data: { context: typeof context }) => {
        context = data.context;
        version++;
        return { ...managed, context, version };
      },
    },
  } as unknown as Client;
  const saved = await saveAssistantContext(client, id, {
    system_prompt: "New prompt",
  });
  expect(saved.context).toEqual({
    ...managed.context,
    system_prompt: "New prompt",
  });
});

test("system assistant cannot be edited and unconfirmed saves are errors", async () => {
  let system = true;
  let writes = 0;
  const client = {
    assistants: {
      get: async () => ({
        ...managed,
        metadata: system ? { created_by: "system" } : {},
      }),
      update: async () => {
        writes++;
      },
    },
  } as unknown as Client;
  await expect(
    saveAssistantContext(client, id, { system_prompt: "New" }),
  ).rejects.toThrow("persistente");
  expect(writes).toBe(0);
  system = false;
  await expect(
    saveAssistantContext(client, id, { system_prompt: "New" }),
  ).rejects.toThrow("confirmar");
});

test("system fallback can be read when no managed default exists", async () => {
  const client = {
    assistants: {
      search: async (query: { metadata?: unknown }) =>
        query.metadata
          ? []
          : [{ ...managed, metadata: { created_by: "system" } }],
    },
  } as unknown as Client;
  expect((await resolveAssistant(client, "agent")).assistant_id).toBe(id);
});

for (const reference of ["agent", id]) {
  test(`prompt persists across reload; chat uses the edited assistant: ${reference}`, async ({
    page,
  }) => {
    let record = structuredClone(managed);
    let failSave = false;
    const versions = [structuredClone(record)];
    const runIds: string[] = [];
    await page.route("https://runtime.invalid/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const body = req.postDataJSON();
      if (path === "/assistants/search")
        return route.fulfill({ json: [record] });
      if (path === `/assistants/${id}/versions`)
        return route.fulfill({
          json: versions
            .slice()
            .reverse()
            .slice(body.offset, body.offset + body.limit),
        });
      if (path === `/assistants/${id}`) {
        if (req.method() === "PATCH") {
          if (failSave)
            return route.fulfill({
              status: 500,
              json: { detail: "Controlled save error" },
            });
          record = {
            ...record,
            context: body.context,
            version: record.version + 1,
          };
          versions.push(structuredClone(record));
        }
        return route.fulfill({ json: record });
      }
      if (path.endsWith("/runs/stream")) {
        runIds.push(body.assistant_id);
        return route.fulfill({
          contentType: "text/event-stream",
          body: "event: end\ndata: {}\n\n",
        });
      }
      return route.fulfill({
        json:
          path === "/threads" ? { thread_id: "synthetic-prompt-thread" } : [],
      });
    });
    const url = new URL(
      process.env.HEADER_CHAT_URL || "http://127.0.0.1:3045/",
    );
    url.searchParams.set("apiUrl", "https://runtime.invalid");
    url.searchParams.set("assistantId", reference);
    await page.goto(url.toString());
    const open = async () => {
      await page
        .getByRole("button", { name: "Abrir configurações", exact: true })
        .click();
      await expect(page.locator("textarea").first()).toHaveValue(
        record.context.system_prompt,
      );
    };
    await open();
    await page.locator("textarea").first().fill("Synthetic edited prompt");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Sincronizado", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Salvo com sucesso", { exact: true }),
    ).toBeVisible();
    expect(versions).toHaveLength(2);
    await page.getByRole("button", { name: "Ver histórico" }).click();
    await page.getByRole("button", { name: /^v1 ·/ }).click();
    await expect(page.getByLabel("Conteúdo da versão")).toHaveText(
      "Saved prompt",
    );
    await page.getByRole("button", { name: "Carregar v1 no editor" }).click();
    await expect(page.locator("textarea").first()).toHaveValue("Saved prompt");
    expect(record.context.system_prompt).toBe("Synthetic edited prompt");
    expect(record.context.agent_instructions).toBe("Keep rules");
    expect(record.context.active_workflow).toBe("Keep workflow");
    await page.reload();
    await open();
    await expect(page.locator("textarea").first()).toHaveValue(
      "Synthetic edited prompt",
    );
    failSave = true;
    await page.locator("textarea").first().fill("Must not appear saved");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      page.getByText("Alterações não salvas", { exact: true }),
    ).toBeVisible();
    expect(record.context.system_prompt).toBe("Synthetic edited prompt");
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.getByPlaceholder("Type your message...").fill("Synthetic hello");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => runIds).toEqual([id]);
  });
}
