import { getApiKey } from "@/lib/api-key";

// Admin, ingestion and tools operate on the same runtime selected for chat.
export function getRuntimeConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    apiKey: getApiKey() || undefined,
  };
}
