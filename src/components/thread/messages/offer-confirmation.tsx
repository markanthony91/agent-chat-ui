import { useStreamContext } from "@/providers/Stream";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function OfferConfirmation({
  offer,
}: {
  offer: Record<string, unknown>;
}) {
  const stream = useStreamContext();
  const [sent, setSent] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (
    offer.available !== true ||
    offer.status !== "available" ||
    typeof offer.offer_id !== "string"
  )
    return null;
  const expired =
    typeof offer.expires_at !== "string" ||
    !Number.isFinite(Date.parse(offer.expires_at)) ||
    now >= Date.parse(offer.expires_at);
  return (
    <section
      className="rounded-lg border p-3"
      aria-label="Confirmação da oferta simulada"
    >
      <p>
        Oferta simulada: total {String(offer.negotiated_amount)}. Parcelas:{" "}
        {Array.isArray(offer.installment_schedule)
          ? offer.installment_schedule.join(" / ")
          : "—"}
        .
      </p>
      <p className="text-xs">
        A confirmação será vinculada a esta oferta. Sem efeitos financeiros
        reais.
      </p>
      <Button
        disabled={stream.isLoading || sent || expired}
        onClick={() => {
          if (
            !window.confirm(
              "Confirmar esta oferta simulada com o total e as parcelas apresentados?",
            )
          )
            return;
          setSent(true);
          const message = {
            id: crypto.randomUUID(),
            type: "human" as const,
            content: `CONFIRMAR ACORDO ${offer.offer_id}`,
          };
          void stream.submit(
            { messages: [message] },
            {
              streamMode: ["values", "messages"],
              streamSubgraphs: true,
              optimisticValues: (previous) => ({
                ...previous,
                messages: [...previous.messages, message],
              }),
            },
          );
        }}
      >
        {sent
          ? "Confirmação enviada"
          : expired
            ? "Oferta expirada"
            : "Confirmar oferta simulada"}
      </Button>
    </section>
  );
}
