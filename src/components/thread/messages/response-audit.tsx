/** Numeric post-stream diagnostics, never a claim of pre-display protection. */
export function ResponseAudit({ audit }: { audit: unknown }) {
  if (!audit || typeof audit !== "object") return null;
  const report = audit as Record<string, unknown>;
  if (report.mode !== "post_stream") return null;
  const review = report.status === "review_required";
  const issues = Array.isArray(report.issues) ? report.issues : [];
  return (
    <aside
      role={review ? "alert" : "status"}
      data-testid="response-audit"
      className={`rounded-md border p-3 text-sm ${review ? "border-amber-500 text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}
    >
      <p className="font-medium">
        {review
          ? "Resposta requer revisão"
          : report.status === "no_numeric_mismatch_detected"
            ? "Nenhuma divergência numérica detectada"
            : "Conferência numérica não aplicável"}
      </p>
      {issues.includes("amount_without_matching_authorized_result") && (
        <p>
          Há valores sem correspondência nos resultados autorizados das tools.
        </p>
      )}
      {issues.includes("percentage_requires_source_review") && (
        <p>Confira o percentual nas fontes: não há simulação correspondente.</p>
      )}
      <p>
        Avaliação posterior ao streaming. Fidelidade semântica não avaliada; não
        é aprovação da resposta nem proteção do texto já exibido.
      </p>
    </aside>
  );
}
