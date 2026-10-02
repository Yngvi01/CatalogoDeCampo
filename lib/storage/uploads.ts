import { scopeId } from "../workspace/context";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  cleanupTemporaryObjects,
  readObject,
  removeObject,
  storage,
  scopedKey,
} from "./objects";

const payloadSchema = z.object({
  scope: z.string().nullable().optional(),
  key: z.string().regex(/^uploads\/[a-f0-9-]+\.bin$/),
  name: z.string().max(250),
  type: z.string().max(100),
  size: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024),
  purpose: z.enum(["photo", "import"]),
  expires: z.number(),
});
function signature(value: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Supabase não configurado.");
  return createHmac("sha256", secret).update(`campo-upload:${value}`).digest();
}
export function verifyTicket(ticket: string, purpose: "photo" | "import") {
  if (ticket.length > 2500) throw new Error("Upload inválido.");
  const [body, mac, extra] = ticket.split(".");
  if (!body || !mac || extra) throw new Error("Upload inválido.");
  const received = Buffer.from(mac, "base64url"),
    expected = signature(body);
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new Error("Upload inválido.");
  const payload = payloadSchema.parse(
    JSON.parse(Buffer.from(body, "base64url").toString()),
  );
  if ((payload.scope ?? null) !== scopeId()) throw new Error("Upload pertence a outra conta ou organização.");
  if (payload.purpose !== purpose || payload.expires < Date.now())
    throw new Error("Upload expirado. Selecione o arquivo novamente.");
  return payload;
}
export async function createUpload(input: unknown) {
  await cleanupTemporaryObjects("uploads");
  const value = payloadSchema.omit({ key: true, expires: true, scope: true }).parse(input);
  if (value.purpose === "photo" && value.size > 20 * 1024 * 1024)
    throw new Error("Cada foto deve ter até 20 MB.");
  const payload = {
    ...value,
    scope: scopeId(),
    key: `uploads/${randomUUID()}.bin`,
    expires: Date.now() + 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const { data, error } = await storage().createSignedUploadUrl(scopedKey(payload.key), {
    upsert: false,
  });
  if (error) throw new Error("Não foi possível iniciar o upload.");
  return {
    url: data.signedUrl,
    ticket: `${body}.${signature(body).toString("base64url")}`,
  };
}
export async function readUpload(ticket: string, purpose: "photo" | "import") {
  const payload = verifyTicket(ticket, purpose);
  const { data, error } = await storage().info(scopedKey(payload.key));
  if (error || Number(data.size) !== payload.size)
    throw new Error("Upload incompleto ou tamanho inválido.");
  const bytes = await readObject(payload.key);
  if (bytes.length !== payload.size)
    throw new Error("Tamanho do upload inválido.");
  return { bytes, payload };
}
export async function discardUpload(
  ticket: string,
  purpose: "photo" | "import",
) {
  await removeObject(verifyTicket(ticket, purpose).key);
}
