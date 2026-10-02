import { clientScope } from "../http/scope";
export type OfflineDraft = {
  scope?: string | null;
  id: string;
  createdAt: string;
  updatedAt: string;
  data: {
    samplingSiteId?: string | null;
    customValues?: import("@/lib/validation/field").CustomValues;
    projectId?: string | null;
    campaignId?: string | null;
    group: "plant" | "fungus";
    observedAt: string;
    region: string;
    habitat: string;
    substrate: string;
    vegetation: string;
    light: string;
    altitude: number | null;
    latitude: number | null;
    longitude: number | null;
    notes: string;
    morphology: Record<string, string>;
  };
  photos: { blob: Blob; name: string; type: string; lastModified: number; organ: string }[];
};

const DB_NAME = "campo-offline-v1";
const STORE = "drafts";

function openDrafts(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("Armazenamento local indisponível neste navegador.")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Não foi possível abrir os rascunhos."));
    request.onblocked = () => reject(new Error("Feche outras abas do Campo e tente novamente."));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDrafts();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    let value: T;
    request.onsuccess = () => { value = request.result; };
    transaction.oncomplete = () => { db.close(); resolve(value); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error("Não foi possível guardar o rascunho.")); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error("O armazenamento local foi interrompido.")); };
  });
}

export const listDrafts = async () => (await run<OfflineDraft[]>("readonly", store => store.getAll()))
  .filter(draft => (draft.scope ?? null) === clientScope())
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
export const putDraft = (draft: OfflineDraft) => run<IDBValidKey>("readwrite", store => store.put({ ...draft, scope: draft.scope ?? clientScope() }));
export const deleteDraft = (id: string) => run<undefined>("readwrite", store => store.delete(id));
