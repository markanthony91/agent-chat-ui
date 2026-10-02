import { NextRequest } from "next/server";
import { json } from "@/lib/portfolio-response";
import {
  allowedOrigin,
  portfolioSimulator,
  savePortfolioSimulator,
  sessionValid,
} from "@/lib/portfolio-playground";

function scope(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("scope_id") || "";
  if (!/^[1-9]\d*$/.test(value)) throw new Error("invalid_portfolio_scope");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("invalid_portfolio_scope");
  return parsed;
}

export async function GET(request: NextRequest) {
  if (!(await sessionValid())) return json({ error: "unauthorized" }, 401);
  try {
    return json(await portfolioSimulator(scope(request)));
  } catch {
    return json({ error: "portfolio_simulator_unavailable" }, 503);
  }
}

export async function PUT(request: NextRequest) {
  if (!(await sessionValid())) return json({ error: "unauthorized" }, 401);
  if (!allowedOrigin(request.headers.get("origin"), request.nextUrl.origin))
    return json({ error: "origin_denied" }, 403);
  if (Number(request.headers.get("content-length") || 0) > 65_536)
    return json({ error: "body_too_large" }, 413);
  try {
    const input = await request.json();
    if (
      !input ||
      typeof input.fixture !== "object" ||
      !input.fixture ||
      Array.isArray(input.fixture)
    )
      return json({ error: "invalid_fixture" }, 400);
    return json(await savePortfolioSimulator(scope(request), input.fixture));
  } catch {
    return json({ error: "portfolio_simulator_save_failed" }, 503);
  }
}
