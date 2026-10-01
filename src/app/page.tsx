import { LegacyChatPage } from "@/components/legacy-chat-page";
import { PortfolioPlayground } from "@/components/portfolio-playground";
import { configured, sessionValid } from "@/lib/portfolio-playground";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!configured()) return <LegacyChatPage />;
  return <PortfolioPlayground signedIn={await sessionValid()} />;
}
