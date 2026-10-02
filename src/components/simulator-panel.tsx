"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { runOkfAdmin } from "@/lib/okf-admin";

type SimulatorFixture = {
  customer_id?: string;
  full_name?: string;
  cpf?: string;
  phone?: string;
  birth_date?: string;
  identity_validated?: boolean;
  institution?: string;
  product?: string;
  debt?: {
    debt_id?: string;
    contract_id?: string;
    original_amount?: number;
    current_amount?: number;
    due_date?: string;
    status?: string;
  };
  eligibility?: {
    can_negotiate?: boolean;
    max_installments?: number;
    max_discount_percentage?: number;
  };
};

export function SimulatorPanel({
  scopeId,
}: {
  scopeId?: number;
} = {}): React.ReactNode {
  const [fixture, setFixture] = useState<SimulatorFixture>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = scopeId
        ? await fetch(`/api/portfolio/simulator?scope_id=${scopeId}`, {
            cache: "no-store",
          }).then(async (response) => {
            if (!response.ok)
              throw new Error("Falha ao carregar o simulador da carteira.");
            return response.json();
          })
        : await runOkfAdmin({ operation: "get_simulator_fixture" });
      const data = scopeId ? result.fixture : result;
      setFixture(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao carregar fixture do simulador.",
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (scopeId) {
        const response = await fetch(
          `/api/portfolio/simulator?scope_id=${scopeId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fixture }),
          },
        );
        if (!response.ok)
          throw new Error("Falha ao salvar o simulador da carteira.");
        const saved = await response.json();
        setFixture(saved.fixture);
      } else {
        await runOkfAdmin({ operation: "save_simulator_fixture", fixture });
      }
      setMessage("Fixture do simulador salva com sucesso.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao salvar fixture do simulador.",
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const updateField = (path: string, value: unknown) => {
    const keys = path.split(".");
    setFixture((current) => {
      const updated = { ...current };
      let obj: Record<string, unknown> = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]!;
        if (!(key in obj)) obj[key] = {};
        obj = obj[key] as Record<string, unknown>;
      }
      obj[keys[keys.length - 1]!] = value;
      return updated;
    });
  };

  const inputField = (
    label: string,
    path: string,
    type: string = "text",
    placeholder?: string,
  ) => {
    const keys = path.split(".");
    let value: unknown = fixture;
    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        value = undefined;
        break;
      }
    }
    const stringValue =
      value === undefined || value === null ? "" : String(value);
    const locked = Boolean(
      scopeId && ["institution", "product"].includes(path),
    );
    const id = `simulator-${path.replaceAll(".", "-")}`;
    return (
      <div
        key={path}
        className="flex flex-col gap-1.5"
      >
        <label
          htmlFor={id}
          className="text-sm font-medium text-neutral-900 dark:text-white"
        >
          {label}
        </label>
        <input
          id={id}
          type={type}
          value={stringValue}
          onChange={(e) =>
            updateField(
              path,
              type === "number"
                ? e.target.value
                  ? parseFloat(e.target.value)
                  : undefined
                : e.target.value || undefined,
            )
          }
          placeholder={placeholder}
          disabled={loading || saving}
          readOnly={locked}
          className="rounded-lg border bg-white px-3 py-2 text-sm outline-none read-only:bg-neutral-100 read-only:text-neutral-500 focus:border-neutral-950 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:read-only:bg-neutral-800 dark:focus:border-white"
        />
      </div>
    );
  };

  const checkboxField = (label: string, path: string) => {
    const keys = path.split(".");
    let value: unknown = fixture;
    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        value = undefined;
        break;
      }
    }
    const checked = value === true;
    const id = `simulator-${path.replaceAll(".", "-")}`;
    return (
      <div
        key={path}
        className="flex items-center gap-3"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => updateField(path, e.target.checked)}
          disabled={loading || saving}
          className="h-4 w-4 rounded border accent-neutral-950 dark:accent-white"
        />
        <label
          htmlFor={id}
          className="text-sm font-medium text-neutral-900 dark:text-white"
        >
          {label}
        </label>
      </div>
    );
  };

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Simulator Fixture</h3>
          <p className="mt-1 text-sm text-neutral-500">
            {scopeId
              ? "Configure dados sintéticos. As alterações se aplicam somente a novas conversas."
              : "Configure dados de teste para simulação de negociação de dívida."}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading || saving}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Recarregar
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* Customer Section */}
        <section>
          <div className="mb-3 text-xs font-semibold tracking-wide text-neutral-400 uppercase">
            Customer
          </div>
          <div className="rounded-xl border p-4 dark:border-neutral-800">
            <div className="grid gap-4 sm:grid-cols-2">
              {inputField("Customer ID", "customer_id", "text", "ex: cust_123")}
              {inputField(
                "Full Name",
                "full_name",
                "text",
                "ex: João da Silva",
              )}
              {inputField("CPF", "cpf", "text", "ex: 12345678901")}
              {inputField(
                "Telefone dummy",
                "phone",
                "tel",
                "ex: +5511999999999",
              )}
              {inputField("Birth Date", "birth_date", "date")}
            </div>
            {scopeId && (
              <p className="mt-4 text-sm text-neutral-500">
                A identidade é validada pelas tools em cada conversa. Salvar
                esta fixture não autentica o cliente.
              </p>
            )}
            {!scopeId && (
              <div className="mt-4 flex flex-col gap-3">
                {checkboxField("Identity Validated", "identity_validated")}
              </div>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {inputField(
                "Institution",
                "institution",
                "text",
                "ex: Banco XYZ",
              )}
              {inputField("Product", "product", "text", "ex: Credit Card")}
            </div>
          </div>
        </section>

        {/* Debt Section */}
        <section>
          <div className="mb-3 text-xs font-semibold tracking-wide text-neutral-400 uppercase">
            Debt
          </div>
          <div className="rounded-xl border p-4 dark:border-neutral-800">
            <div className="grid gap-4 sm:grid-cols-2">
              {inputField("Debt ID", "debt.debt_id", "text", "ex: debt_123")}
              {inputField(
                "Contract ID",
                "debt.contract_id",
                "text",
                "ex: contract_456",
              )}
              {inputField(
                "Original Amount",
                "debt.original_amount",
                "number",
                "ex: 10000.00",
              )}
              {inputField(
                "Current Amount",
                "debt.current_amount",
                "number",
                "ex: 8500.00",
              )}
              {inputField("Due Date", "debt.due_date", "date")}
              {inputField("Status", "debt.status", "text", "ex: Active")}
            </div>
          </div>
        </section>

        {/* Eligibility Section */}
        <section>
          <div className="mb-3 text-xs font-semibold tracking-wide text-neutral-400 uppercase">
            Eligibility
          </div>
          <div className="rounded-xl border p-4 dark:border-neutral-800">
            <div className="flex flex-col gap-4">
              {checkboxField("Can Negotiate", "eligibility.can_negotiate")}
              {inputField(
                "Max Installments",
                "eligibility.max_installments",
                "number",
                "ex: 12",
              )}
              {inputField(
                "Max Discount Percentage",
                "eligibility.max_discount_percentage",
                "number",
                "ex: 25",
              )}
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => void load()}
            disabled={loading || saving}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
          >
            Descartar alterações
          </button>
          <button
            onClick={() => void save()}
            disabled={loading || saving}
            className="flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
