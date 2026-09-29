// Display the runtime's amounts verbatim; this component never calculates an offer.
export function PaymentSummary({ text }: { text: string }) {
  const blocks = text
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .trim()
    .split(/\r?\n\s*\r?\n/);

  return (
    <section
      aria-label="Resumo da sua negociação"
      className="payment-summary space-y-5 leading-7 [overflow-wrap:anywhere]"
    >
      {blocks.map((block, blockIndex) => (
        <div key={blockIndex}>
          {block.split(/\r?\n/).map((line, lineIndex) => (
            <div key={lineIndex}>
              {line === "Resumo da sua negociação" ||
              line === "Parcelamento" ||
              line.startsWith("Total da negociação:") ? (
                <strong>{line}</strong>
              ) : (
                line
              )}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
