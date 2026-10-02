import type { Project, Campaign, Observation } from "@/lib/validation/schemas";
import type { SamplingSite } from "@/lib/validation/field";
export type FieldContext = { scope?: string | null; projects: Project[]; campaigns: Campaign[]; samplingSites: SamplingSite[] };
export type QueuedCapture = {
  scope?: string | null; id: string; createdAt: string; updatedAt: string; status: "local" | "pending" | "synced" | "error";
  error?: string; code?: string; scientificName?: string; data: Partial<Observation>;
  photos: { blob: Blob; name: string; type: string }[];
};
type FieldStore = {
  list: () => Promise<QueuedCapture[]>; sync: (retryErrors?: boolean) => Promise<void>;
  prepare: () => Promise<FieldContext>; getContext: () => Promise<FieldContext | null>;
  clearSynced: () => Promise<void>;
};
declare global { interface Window { CampoField?: FieldStore } }
let loading: Promise<FieldStore> | undefined;
export function fieldStore(): Promise<FieldStore> {
  if (window.CampoField) return Promise.resolve(window.CampoField);
  return loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script"); script.src = "/field-store.js";
    script.onload = () => window.CampoField ? resolve(window.CampoField) : reject(new Error("Fila de campo indisponível."));
    script.onerror = () => { loading = undefined; script.remove(); reject(new Error("Não foi possível abrir a fila de campo.")); };
    document.head.append(script);
  });
}
