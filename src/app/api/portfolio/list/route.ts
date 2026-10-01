import { json } from "@/lib/portfolio-response";
import {
  assistantFor,
  portfolios,
  sessionValid,
} from "@/lib/portfolio-playground";

export async function GET() {
  if (!(await sessionValid())) return json({ error: "unauthorized" }, 401);
  try {
    const list = await portfolios();
    return json({
      portfolios: list.map((item) => ({
        scope_id: item.scope_id,
        tenant_name: item.tenant_name,
        portfolio_name: item.portfolio_name,
        assistant_name: item.assistant_name,
        assistant_id:
          item.runtime_assistant_id ||
          (item.scope_id === 1
            ? process.env.PLAYGROUND_LEGACY_ASSISTANT_ID || null
            : null),
        chat_ready: (() => {
          try {
            assistantFor(item);
            return true;
          } catch {
            return false;
          }
        })(),
      })),
    });
  } catch {
    return json({ error: "portfolio_catalog_unavailable" }, 503);
  }
}
