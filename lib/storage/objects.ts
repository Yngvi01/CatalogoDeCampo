import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { cloud, dataDir } from "../db/config";
let client: SupabaseClient | undefined;
export const bucket = process.env.SUPABASE_STORAGE_BUCKET || "campo-private";
export function storage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Configure o Supabase Storage no servidor.");
  return (client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })).storage.from(bucket);
}
function validateKey(key: string) {
  if (!/^(images|backups|uploads|exports)\/[a-zA-Z0-9._-]+$/.test(key))
    throw new Error("Caminho de arquivo inválido.");
  return key;
}
export async function readObject(key: string): Promise<Buffer> {
  validateKey(key);
  if (!cloud) return readFile(path.join(dataDir, key));
  const { data, error } = await storage().download(key);
  if (error)
    throw new Error("Não foi possível ler o arquivo no Supabase Storage.");
  return Buffer.from(await data.arrayBuffer());
}
export async function objectExists(key: string): Promise<boolean> {
  validateKey(key);
  if (!cloud) {
    try {
      await readFile(path.join(dataDir, key));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  const { error } = await storage().info(key);
  if (error && String((error as { statusCode?: string }).statusCode) === "404") return false;
  if (error)
    throw new Error(
      "Não foi possível verificar o arquivo no Supabase Storage.",
    );
  return true;
}
export async function writeObject(
  key: string,
  bytes: Uint8Array,
  contentType = "application/octet-stream",
) {
  validateKey(key);
  if (!cloud) {
    await mkdir(path.dirname(path.join(dataDir, key)), { recursive: true });
    await writeFile(path.join(dataDir, key), bytes, { flag: "wx" });
    return;
  }
  if (bytes.byteLength > 50 * 1024 * 1024)
    throw new Error(
      "O arquivo excede o limite de 50 MB do armazenamento na nuvem. Exporte o JSON ou use o backup local para catálogos maiores.",
    );
  const { error } = await storage().upload(key, bytes, {
    contentType,
    upsert: false,
  });
  if (error)
    throw new Error("Não foi possível salvar o arquivo no Supabase Storage.");
}
export async function removeObject(key: string) {
  validateKey(key);
  if (!cloud) {
    try {
      await unlink(path.join(dataDir, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return;
  }
  const { error } = await storage().remove([key]);
  if (error)
    throw new Error("Não foi possível remover o arquivo no Supabase Storage.");
}
export async function signedDownload(key: string, filename?: string) {
  validateKey(key);
  const { data, error } = await storage().createSignedUrl(
    key,
    300,
    filename ? { download: filename } : {},
  );
  if (error) throw new Error("Não foi possível gerar o link de download.");
  return data.signedUrl;
}

/** Abandoned uploads and export copies expire; permanent images/backups stay intact. */
export async function cleanupTemporaryObjects(prefix: "uploads" | "exports") {
  if (!cloud) return;
  const { data, error } = await storage().list(prefix, {
    limit: 100,
    sortBy: { column: "created_at", order: "asc" },
  });
  if (error) return;
  const expired = data
    .filter(
      (item) =>
        item.created_at &&
        Date.parse(item.created_at) < Date.now() - 24 * 60 * 60 * 1000,
    )
    .map((item) => `${prefix}/${item.name}`);
  if (expired.length) await storage().remove(expired);
}
