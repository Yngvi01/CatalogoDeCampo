import sharp from "sharp";
import { createHash, randomUUID } from "node:crypto";
import { writeFile, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../db";
import type { Photo } from "../validation/schemas";
export const imageDir = path.join(dataDir, "images");
export const maxPhotoBytes = 20 * 1024 * 1024;
export async function savePhoto(
  file: File,
  observationId: string,
): Promise<Photo> {
  if (file.size > maxPhotoBytes || file.size === 0)
    throw new Error("Cada foto deve ter entre 1 byte e 20 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const engine = sharp(bytes, {
    limitInputPixels: 60_000_000,
    failOn: "error",
  });
  const info = await engine.metadata();
  const formats: Record<string, string> = {
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    tiff: "tiff",
    heif: "heif",
  };
  const ext = formats[info.format || ""];
  if (!ext || !info.width || !info.height)
    throw new Error(
      "Formato inválido. Use JPEG, PNG, WebP, TIFF ou HEIF compatível.",
    );
  const id = randomUUID();
  const hash = createHash("sha256").update(bytes).digest("hex");
  const original = `${id}.${ext}`,
    optimized = `${id}-opt.jpg`,
    thumbnail = `${id}-thumb.jpg`;
  const opt = await engine
    .clone()
    .rotate()
    .resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  const thumb = await engine
    .clone()
    .rotate()
    .resize({
      width: 520,
      height: 520,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 78 })
    .toBuffer();
  try {
    await Promise.all([
      writeFile(path.join(imageDir, original), bytes),
      writeFile(path.join(imageDir, optimized), opt),
      writeFile(path.join(imageDir, thumbnail), thumb),
    ]);
  } catch (e) {
    await Promise.all(
      [original, optimized, thumbnail].map((n) =>
        unlink(path.join(imageDir, n)).catch(() => {}),
      ),
    );
    throw e;
  }
  return {
    id,
    observationId,
    hash,
    original,
    optimized,
    thumbnail,
    mime: file.type || `image/${info.format}`,
    width: info.width,
    height: info.height,
    organ: "auto",
    createdAt: new Date().toISOString(),
  };
}
export async function removePhoto(photo: Photo) {
  await Promise.all(
    [photo.original, photo.optimized, photo.thumbnail].map((n) =>
      unlink(path.join(imageDir, n)).catch(() => {}),
    ),
  );
}
export async function photoBytes(photo: Photo) {
  const bytes = await readFile(path.join(imageDir, photo.optimized));
  return sharp(bytes, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}
