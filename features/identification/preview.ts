import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import {
  observationInput,
  candidateSchema,
  type Observation,
} from "@/lib/validation/schemas";
import { identifyPlantBytes } from "@/lib/providers/plantnet";
import { fungi } from "@/lib/providers/biodiversity";
import { createObservation } from "@/features/observations/service";
const localSecret = randomBytes(32).toString("hex");
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const receiptSchema = z.object({
  data: observationInput,
  hashes: z
    .array(z.string().regex(/^[a-f0-9]{64}$/))
    .min(1)
    .max(5),
  organs: z.array(z.enum(["auto", "leaf", "flower", "fruit", "bark"])).max(5).default([]),
  provider: z.enum(["plantnet", "fungi-context", "manual"]),
  candidates: z.array(candidateSchema).max(50),
  queriedAt: z.iso.datetime(),
  expires: z.number(),
});
function sign(body: string) {
  return createHmac("sha256", process.env.CAMPO_PASSWORD || localSecret)
    .update(`identification-preview:${body}`)
    .digest();
}
export function readReceipt(receipt: string) {
  if (receipt.length > 500000) throw new Error("Resultado inválido.");
  const [body, signature, extra] = receipt.split(".");
  if (!body || !signature || extra) throw new Error("Resultado inválido.");
  const received = Buffer.from(signature, "base64url"),
    expected = sign(body);
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new Error("Resultado inválido.");
  const result = receiptSchema.parse(
    JSON.parse(Buffer.from(body, "base64url").toString()),
  );
  if (result.expires < Date.now())
    throw new Error("O resultado expirou. Faça a identificação novamente.");
  return result;
}
/** Photos exist only in request memory; no Storage writes, image records or visual cache. */
export async function previewIdentification(form: FormData) {
  const data = observationInput.parse(
    JSON.parse(String(form.get("data") || "{}")),
  );
  const hashes = receiptSchema.shape.hashes.parse(
    JSON.parse(String(form.get("hashes") || "[]")),
  );
  const organs = receiptSchema.shape.organs.parse(JSON.parse(String(form.get("organs") || "[]")));
  if (organs.length && organs.length !== hashes.length)
    throw new Error("Informe uma parte da planta para cada foto.");
  const manual = form.get("manual") === "true";
  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File);
  if (
    !manual &&
    (files.length !== hashes.length ||
      files.reduce((n, f) => n + f.size, 0) > 3500000)
  )
    throw new Error("Envie entre 1 e 5 fotos reduzidas para identificar.");
  const images: Uint8Array[] = [];
  if (!manual)
    for (const file of files) {
      images.push(
        await sharp(Buffer.from(await file.arrayBuffer()), {
          limitInputPixels: 60_000_000,
        })
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer(),
      );
    }
  const observation: Observation = {
    ...data,
    id: randomUUID(),
    code: "CAMPO-000000",
    observedAt: data.observedAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    speciesId: null,
    status: "unidentified",
  };
  const result = manual
    ? { candidates: [], queriedAt: new Date().toISOString() }
    : data.group === "plant"
      ? await identifyPlantBytes(images, organs)
      : await fungi.identify(observation, []);
  const value = receiptSchema.parse({
    data,
    hashes,
    organs,
    provider: manual
      ? "manual"
      : data.group === "plant"
        ? "plantnet"
        : "fungi-context",
    candidates: result.candidates,
    queriedAt: result.queriedAt || new Date().toISOString(),
    expires: Date.now() + 60 * 60 * 1000,
  });
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    receipt: `${body}.${sign(body).toString("base64url")}`,
    candidates: value.candidates,
    provider: value.provider,
  };
}
export async function saveIdentifiedObservation(
  form: FormData,
  receipt: string,
) {
  const result = readReceipt(receipt);
  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File);
  const remaining = result.hashes.map((hash, index) => ({ hash, organ: result.organs[index] || "auto" }));
  const selectedOrgans: string[] = [];
  for (const file of files) {
    if (!file.size || file.size > 20 * 1024 * 1024)
      throw new Error("Cada foto deve ter até 20 MB.");
    const fileHash = hash(new Uint8Array(await file.arrayBuffer()));
    const index = remaining.findIndex(item => item.hash === fileHash);
    if (index < 0)
      throw new Error("Selecione apenas fotos usadas nesta identificação.");
    selectedOrgans.push(remaining[index].organ);
    remaining.splice(index, 1);
  }
  form.set("data", JSON.stringify(result.data));
  return createObservation(form, {
    candidates: result.candidates,
    provider: result.provider,
    queriedAt: result.queriedAt,
  }, selectedOrgans);
}
