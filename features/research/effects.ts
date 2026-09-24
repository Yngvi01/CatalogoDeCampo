import type { EffectClaim } from "@/lib/validation/schemas";

export const effectLabels: Record<EffectClaim["kind"], string> = {
  psychedelic: "Psicodélico",
  sedative: "Sedativo",
  stimulant: "Estimulante",
  anxiolytic: "Ansiolítico",
  other: "Outro",
};

export const contextLabels: Record<EffectClaim["context"], string> = {
  isolated_compound: "Composto isolado",
  extract: "Extrato",
  whole_organism: "Planta inteira",
  traditional_use: "Uso tradicional",
  unspecified: "Contexto não informado",
};
