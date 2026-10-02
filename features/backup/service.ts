import { validateCustomValues } from "@/lib/validation/field";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { cloud, query, transaction } from "@/lib/db";
import {
  snapshot,
  tableNames,
  sqlTable,
  put,
  nextCode,
  type TableName,
} from "@/lib/db/repository";
import { exportSchema, type ExportData } from "@/lib/validation/schemas";
import {
  readObject,
  writeObject,
  objectExists,
  removeObject,
} from "@/lib/storage/objects";
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
export async function exportCatalog(data?: ExportData) {
  return {
    format: "campo-catalogo" as const,
    version: 4 as const,
    exportedAt: new Date().toISOString(),
    data: data ?? await snapshot(),
  };
}
export async function backup(data?: ExportData): Promise<Uint8Array> {
  return transaction(async () => {
    const catalog = await exportCatalog(data);
    const files: Record<string, Uint8Array> = {
      "export.json": strToU8(JSON.stringify(catalog, null, 2)),
    };
    if (!cloud && !data)
      files["database.sqlite"] = (
        await import("@/lib/db/local")
      ).sqlite.serialize();
    for (const p of catalog.data.images)
      for (const name of [p.original, p.optimized, p.thumbnail]) {
        const file = `images/${name}`;
        if (!(await objectExists(file)))
          throw new Error(
            `Foto ausente: ${name}. Corrija antes de criar backup completo.`,
          );
        files[`images/${name}`] = await readObject(file);
      }
    const checksums = Object.fromEntries(
      Object.entries(files).map(([n, b]) => [n, sha(b)]),
    );
    files["manifest.json"] = strToU8(
      JSON.stringify(
        {
          format: "campo-catalogo",
          version: 4,
          samplingSites: catalog.data.samplingSites.length,
          projects: catalog.data.projects.length,
          campaigns: catalog.data.campaigns.length,
          appVersion: "0.2.0",
          exportedAt: catalog.exportedAt,
          species: catalog.data.species.length,
          observations: catalog.data.observations.length,
          images: catalog.data.images.length,
          notes: catalog.data.notes.length,
          bookmarks: catalog.data.bookmarks.length,
          checksums,
        },
        null,
        2,
      ),
    );
    return zipSync(files, { level: 1 });
  });
}
const manifestSchema = z.object({
  format: z.literal("campo-catalogo"),
  version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  appVersion: z.string(),
  exportedAt: z.iso.datetime(),
  species: z.number().int().nonnegative(),
  observations: z.number().int().nonnegative(),
  images: z.number().int().nonnegative(),
  samplingSites: z.number().int().nonnegative().optional(),
  projects: z.number().int().nonnegative().optional(),
  campaigns: z.number().int().nonnegative().optional(),
  notes: z.number().int().nonnegative().optional(),
  bookmarks: z.number().int().nonnegative().optional(),
  checksums: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
});
export function validateRelations(data: ExportData) {
  for (const name of tableNames) {
    const ids = data[name].map((r) => r.id);
    if (new Set(ids).size !== ids.length)
      throw new Error(`IDs duplicados em ${name}.`);
  }
  const species = new Set(data.species.map((s) => s.id)),
    obs = new Set(data.observations.map((o) => o.id)),
    compounds = new Set(data.compounds.map((c) => c.id)),
    photos = new Set(data.images.map((p) => p.id));
  if (
    new Set(data.observations.map((o) => o.code)).size !==
    data.observations.length
  )
    throw new Error("Códigos CAMPO duplicados.");
  const projects = new Set(data.projects.map(p => p.id));
  const campaigns = new Map(data.campaigns.map(c => [c.id, c]));
  for (const c of data.campaigns)
    if (!projects.has(c.projectId)) throw new Error("Projeto da campanha inexistente.");
  const sites = new Map(data.samplingSites.map(s => [s.id, s]));
  for (const site of data.samplingSites) if (!projects.has(site.projectId)) throw new Error("Projeto do ponto ou parcela inexistente.");
  for (const o of data.observations) {
    if (o.samplingSiteId && (!o.projectId || sites.get(o.samplingSiteId)?.projectId !== o.projectId)) throw new Error("Ponto ou parcela inexistente ou de outro projeto.");
    validateCustomValues(data.projects.find(p => p.id === o.projectId)?.fieldDefinitions || [], o.customValues || {}, false);
    if (o.projectId && !projects.has(o.projectId)) throw new Error("Projeto da observação inexistente.");
    if (o.campaignId && (!o.projectId || campaigns.get(o.campaignId)?.projectId !== o.projectId))
      throw new Error("Campanha inexistente ou de outro projeto.");
    if (o.speciesId && !species.has(o.speciesId))
      throw new Error("Espécie de observação inexistente.");
    if ((o.latitude === null) !== (o.longitude === null))
      throw new Error("Coordenadas incompletas.");
  }
  for (const r of [...data.images, ...data.identifications, ...data.history])
    if (!obs.has(r.observationId))
      throw new Error("Referência a observação inexistente.");
  for (const r of [...data.evidence, ...data.discoveries, ...data.research])
    if (!species.has(r.speciesId))
      throw new Error("Referência a espécie inexistente.");
  for (const r of data.evidence)
    if (r.compoundId && !compounds.has(r.compoundId))
      throw new Error("Referência a composto inexistente.");
  for (const r of data.identifications)
    for (const id of r.imageIds) {
      if (
        !photos.has(id) ||
        data.images.find((p) => p.id === id)?.observationId !== r.observationId
      )
        throw new Error(
          "Foto de identificação inexistente ou de outra observação.",
        );
    }
  for (const r of data.history)
    for (const id of [r.speciesId, r.previousSpeciesId])
      if (id && !species.has(id))
        throw new Error("Espécie do histórico inexistente.");
}
export function parseImport(bytes: Uint8Array) {
  if (bytes.byteLength > 256 * 1024 * 1024)
    throw new Error("Limite de importação: 256 MB.");
  let files: Record<string, Uint8Array> = {};
  let parsed: unknown;
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip) {
    let size = 0,
      count = 0;
    files = unzipSync(bytes, {
      filter(entry) {
        size += entry.originalSize;
        count++;
        if (size > 1024 * 1024 * 1024 || count > 20000)
          throw new Error(
            "ZIP excede limite de expansão (1 GB / 20 mil arquivos).",
          );
        if (
          !/^(manifest\.json|export\.json|database\.sqlite|images\/[a-f0-9-]+(?:-opt|-thumb)?\.(jpg|png|webp|tiff|heif))$/.test(
            entry.name,
          )
        )
          throw new Error("ZIP contém caminho não permitido.");
        return true;
      },
    });
    if (!files["manifest.json"] || !files["export.json"])
      throw new Error("Backup incompleto.");
    const manifest = manifestSchema.parse(
      JSON.parse(strFromU8(files["manifest.json"])),
    );
    for (const [n, b] of Object.entries(files))
      if (n !== "manifest.json" && manifest.checksums[n] !== sha(b))
        throw new Error(`Checksum inválido: ${n}`);
    for (const n of Object.keys(manifest.checksums))
      if (!files[n]) throw new Error("Arquivo do manifesto ausente.");
    if (manifest.version === 1 && !files["database.sqlite"])
      throw new Error("Backup incompleto.");
    if (
      files["database.sqlite"] &&
      strFromU8(files["database.sqlite"].slice(0, 15)) !== "SQLite format 3"
    )
      throw new Error("Banco SQLite inválido.");
    parsed = JSON.parse(strFromU8(files["export.json"]));
    const imported = exportSchema.parse(parsed);
    if (manifest.version !== imported.version)
      throw new Error("Versões do manifesto e do catálogo divergem.");
    const data = imported.data;
    if (
      manifest.species !== data.species.length ||
      manifest.observations !== data.observations.length ||
      manifest.images !== data.images.length ||
      (manifest.version >= 2 && manifest.notes !== data.notes.length) ||
      (manifest.version >= 3 && (manifest.projects !== data.projects.length || manifest.campaigns !== data.campaigns.length)) ||
      (manifest.version === 4 && manifest.samplingSites !== data.samplingSites.length) ||
      (manifest.bookmarks !== undefined && manifest.bookmarks !== data.bookmarks.length)
    )
      throw new Error("Contagens do manifesto divergem.");
  } else parsed = JSON.parse(strFromU8(bytes));
  const payload = exportSchema.parse(parsed);
  validateRelations(payload.data);
  if (isZip)
    for (const p of payload.data.images) {
      for (const n of [p.original, p.optimized, p.thumbnail])
        if (!files[`images/${n}`])
          throw new Error("Imagem declarada não encontrada no ZIP.");
      if (sha(files[`images/${p.original}`]) !== p.hash)
        throw new Error("Hash da foto original inválido.");
    }
  return { payload, files, isZip, hash: sha(bytes) };
}
export async function previewImport(bytes: Uint8Array) {
  const parsed = parseImport(bytes),
    current = await snapshot();
  const existing = Object.fromEntries(
    tableNames.map((n) => [
      n,
      parsed.payload.data[n].filter((r) =>
        current[n].some((c) => c.id === r.id),
      ).length,
    ]),
  );
  const codeConflicts = parsed.payload.data.observations.filter((o) =>
    current.observations.some((c) => c.code === o.code && c.id !== o.id),
  ).length;
  return {
    hash: parsed.hash,
    isZip: parsed.isZip,
    counts: Object.fromEntries(
      tableNames.map((n) => [n, parsed.payload.data[n].length]),
    ),
    existing,
    codeConflicts,
    missingImages: parsed.isZip
      ? 0
      : (
          await Promise.all(
            parsed.payload.data.images.map(async (p) =>
              (
                await Promise.all(
                  [p.original, p.optimized, p.thumbnail].map((n) =>
                    objectExists(`images/${n}`),
                  ),
                )
              ).some((exists) => !exists),
            ),
          )
        ).filter(Boolean).length,
  };
}
export async function importCatalog(
  bytes: Uint8Array,
  strategy: "skip" | "update" | "new" | "restore",
  expectedHash: string,
) {
  return transaction(async () => {
    const parsed = parseImport(bytes);
    if (parsed.hash !== expectedHash)
      throw new Error("O arquivo mudou. Valide novamente antes de importar.");
    if (strategy === "restore" && !parsed.isZip)
      throw new Error("Restauração completa requer ZIP.");
    let data = structuredClone(parsed.payload.data);
    const current = await snapshot();
    const written: string[] = [];
    let recovery: string | null = null;
    // A restauração usa o export versionado validado, reconstruindo o banco com as migrations atuais.
    if (strategy === "restore" || strategy === "update") {
      recovery = `before-${Date.now()}-${randomUUID()}.zip`;
      await writeObject(
        `backups/${recovery}`,
        await backup(),
        "application/zip",
      );
    }
    const maps: Record<string, string> = {};
    if (strategy === "new") {
      for (const n of tableNames)
        for (const r of data[n])
          if (n !== "settings") maps[r.id] = randomUUID();
    } else if (strategy !== "restore") {
      for (const o of data.observations) {
        const existing = current.observations.find((c) => c.code === o.code);
        if (existing && existing.id !== o.id)
          throw new Error(
            `Conflito no código ${o.code}. Use importar como novo ou restauração completa.`,
          );
      }
    }
    try {
      await transaction(async () => {
        if (strategy === "restore")
          for (const n of [...tableNames].reverse())
            await query(`DELETE FROM ${sqlTable(n)}`);
        for (const name of tableNames) {
          for (const raw of data[name]) {
            if (strategy === "new" && name === "settings") continue;
            const r = structuredClone(raw) as unknown as Record<
              string,
              unknown
            > & { id: string };
            if (strategy === "new") {
              r.id = maps[r.id];
              for (const key of [
                "projectId",
                "campaignId",
                "samplingSiteId",
                "observationId",
                "speciesId",
                "previousSpeciesId",
                "compoundId",
              ])
                if (typeof r[key] === "string") r[key] = maps[r[key] as string];
              if (Array.isArray(r.imageIds))
                r.imageIds = r.imageIds.map((id) => maps[id as string]);
              if (name === "observations") r.code = await nextCode();
            }
            if (strategy === "skip" && current[name].some((c) => c.id === r.id))
              continue;
            if (name === "images") {
              for (const key of ["original", "optimized", "thumbnail"]) {
                const originalName = r[key] as string;
                const bytes = parsed.files[`images/${originalName}`];
                if (bytes) {
                  let nameOnDisk = originalName;
                  const existing = `images/${nameOnDisk}`;
                  if (
                    strategy === "new" ||
                    ((await objectExists(existing)) &&
                      sha(await readObject(existing)) !== sha(bytes))
                  )
                    nameOnDisk = `${randomUUID()}${key === "optimized" ? "-opt" : key === "thumbnail" ? "-thumb" : ""}${path.extname(originalName)}`;
                  const dest = `images/${nameOnDisk}`;
                  if (!(await objectExists(dest))) {
                    await writeObject(dest, bytes);
                    written.push(dest);
                  }
                  r[key] = nameOnDisk;
                }
              }
            }
            await put(name as TableName, r);
          }
        }
        validateRelations(await snapshot());
      });
    } catch (e) {
      for (const file of written) await removeObject(file).catch(() => {});
      throw e;
    }
    return {
      ok: true,
      recovery: recovery ? path.basename(recovery) : null,
      missingImages: !parsed.isZip
        ? (
            await Promise.all(
              data.images.map(
                async (p) => !(await objectExists(`images/${p.original}`)),
              ),
            )
          ).filter(Boolean).length
        : 0,
    };
  });
}

export async function csv(table: "species" | "observations" | "compounds", data?: ExportData) {
  const source = data ?? await snapshot();
  const rows = table === "observations" ? source.observations.map(o => ({
    ...o, projectId: o.projectId ?? null, campaignId: o.campaignId ?? null, samplingSiteId: o.samplingSiteId ?? null,
    scientificName: source.species.find(s => s.id === o.speciesId)?.scientificName || "",
    projectName: source.projects.find(p => p.id === o.projectId)?.name || "",
    samplingSiteName: source.samplingSites.find(s => s.id === o.samplingSiteId)?.name || "",
    campaignName: source.campaigns.find(c => c.id === o.campaignId)?.name || "",
  })) : source[table];
  const keys = rows[0]
    ? [...new Set(rows.flatMap(row => Object.keys(row)))]
    : table === "species"
      ? ["id", "scientificName", "commonNames"]
      : table === "observations"
        ? ["id", "code", "observedAt", "region", "status", "projectId", "campaignId", "scientificName", "projectName", "campaignName"]
        : ["id", "name", "chemicalClass"];
  const cell = (v: unknown) => {
    let s = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      keys.map(cell).join(","),
      ...rows.map((r) =>
        keys
          .map((k) => cell((r as unknown as Record<string, unknown>)[k]))
          .join(","),
      ),
    ].join("\r\n")
  );
}
