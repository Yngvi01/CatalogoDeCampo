"use client";
import { useState } from "react";
import {
  Field,
  ErrorText,
  api,
  send,
  evidenceLabels,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import type { Compound, Discovery } from "@/lib/validation/schemas";
export function EvidenceForm({
  speciesId,
  compounds,
  onSaved,
  discovery,
}: {
  speciesId: string;
  compounds: Compound[];
  onSaved: () => Promise<void>;
  discovery?: Discovery;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="panel inset"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const value: Record<string, unknown> = { speciesId };
        for (const k of [
          "property",
          "claim",
          "type",
          "origin",
          "source",
          "url",
          "part",
          "concentration",
          "unit",
          "range",
          "method",
          "sampleOrigin",
          "notes",
        ])
          value[k] = String(f.get(k) || "");
        value.compoundId = f.get("compoundId") || null;
        setBusy(true);
        setError("");
        try {
          await api(
            discovery ? `discoveries/${discovery.id}/incorporate` : "evidence",
            send(value),
          );
          form.reset();
          await onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>
        {discovery ? "Revisar e incorporar evidência" : "Adicionar evidência"}
      </h3>
      <p className="tip">
        Uma publicação descreve uma amostra específica. Ela não demonstra a
        composição do seu exemplar.
      </p>
      <Field label="Afirmação / informação">
        <textarea
          name="claim"
          required
          placeholder="Descreva apenas o que a fonte sustenta…"
        />
      </Field>
      <div className="form-grid">
        <Field label="Propriedade / tag">
          <input
            name="property"
            placeholder="Ex.: sedativa, tóxica, medicinal"
            list="property-tags"
          />
          <datalist id="property-tags">
            {[
              "psicoativa",
              "psicodélica",
              "sedativa",
              "ansiolítica",
              "estimulante",
              "analgésica",
              "tóxica",
              "medicinal",
            ].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Tipo de evidência">
          <select name="type" defaultValue={discovery ? "publication" : "personal"}>
            {Object.entries(evidenceLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Origem">
          <select
            name="origin"
            defaultValue={discovery ? "publication" : "personal"}
            disabled={!!discovery}
          >
            <option value="personal">Meus dados</option>
            <option value="automatic">Dados automáticos</option>
            <option value="publication">Publicação científica</option>
            <option value="hypothesis">Hipótese</option>
            <option value="confirmed">Dado confirmado</option>
          </select>
        </Field>
        <Field label="Composto associado">
          <select name="compoundId">
            <option value="">Sem composto</option>
            {compounds.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fonte / referência">
          <input
            name="source"
            defaultValue={discovery?.title || ""}
            readOnly={!!discovery}
          />
        </Field>
        <Field label="URL da fonte">
          <input
            name="url"
            type="url"
            defaultValue={discovery?.url || ""}
            readOnly={!!discovery}
          />
        </Field>
      </div>
      <details className="form-details">
        <summary>
          Amostra e método analítico <span>opcional</span>
        </summary>
        <div className="form-grid">
          {[
            ["part", "Parte analisada"],
            ["concentration", "Concentração"],
            ["unit", "Unidade"],
            ["range", "Intervalo"],
            ["method", "Método analítico"],
            ["sampleOrigin", "Origem da amostra"],
          ].map(([k, l]) => (
            <Field label={l} key={k}>
              <input name={k} />
            </Field>
          ))}
        </div>
      </details>
      <Field label="Observações">
        <textarea name="notes" />
      </Field>
      <ErrorText message={error} />
      <Button size="sm" disabled={busy}>
        {busy
          ? "Salvando…"
          : discovery
            ? "Incorporar à ficha"
            : "Salvar evidência"}
      </Button>
    </form>
  );
}
