import {
  deleteObservation,
  cleanupDeletedPhotos,
} from "@/features/observations/delete";
import {
  previewIdentification,
  saveIdentifiedObservation,
  readReceipt,
} from "@/features/identification/preview";
import { validToken, sameOrigin } from "@/lib/auth";
import { limitedForm, limitedJson } from "@/lib/validation/body";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cloud, transaction } from "@/lib/db";
import {
  cleanupTemporaryObjects,
  readObject,
  signedDownload,
  writeObject,
} from "@/lib/storage/objects";
import { createUpload, readUpload, discardUpload } from "@/lib/storage/uploads";
import path from "node:path";
import { z, ZodError } from "zod";
import { catalog, get, list, put } from "@/lib/db/repository";
import {
  compoundSchema,
  evidenceSchema,
  discoverySchema,
  observationInput,
  type Photo,
  type Observation,
  type Discovery,
} from "@/lib/validation/schemas";
import {
  createObservation,
  observationDetail,
  confirmIdentification,
  updateSpecies,
} from "@/features/observations/service";
import { identify, compare } from "@/features/identification/service";
import { investigate, incorporate } from "@/features/research/service";
import {
  backup,
  exportCatalog,
  csv,
  previewImport,
  importCatalog,
} from "@/features/backup/service";
import { getNaturePhotos } from "@/lib/providers/pexels";
import { getReflections } from "@/lib/providers/zenquotes";
import { searchPubChem } from "@/lib/providers/pubchem";
import { searchLotus } from "@/lib/providers/lotus";
import {
  createNote,
  updateNote,
  NoteConflictError,
} from "@/features/notebook/service";
type Context = { params: Promise<{ path: string[] }> };
const json = (v: unknown, status = 200) =>
  NextResponse.json(v, { status, headers: { "Cache-Control": "no-store" } });
function authorize(request: NextRequest) {
  if (!validToken(request.cookies.get("campo-session")?.value))
    throw new Error("Sessão expirada. Entre novamente.");
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    throw new Error("Origem não autorizada.");
}
function failure(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^(08|28|42|57|ECONN|ETIMEDOUT|ENOTFOUND)/.test(error.code)
  )
    return json(
      {
        error:
          "Banco indisponível. Verifique conexão, credenciais e migrations no servidor.",
      },
      503,
    );
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    ["23503", "23505", "23514"].includes(String(error.code))
  )
    return json(
      { error: "Registro duplicado ou relação inválida. Revise os dados." },
      409,
    );
  if (error instanceof NoteConflictError)
    return json({ error: error.message }, 409);
  if (error instanceof Error && error.message.startsWith("Sessão"))
    return json({ error: error.message }, 401);
  if (error instanceof Error && error.message === "Origem não autorizada.")
    return json({ error: error.message }, 403);
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      400,
    );
  const message =
    error instanceof Error
      ? error.message
      : "Não foi possível concluir a operação.";
  if (/ENOENT|EACCES/.test(message))
    return json(
      {
        error:
          "Arquivo não encontrado ou sem permissão de acesso. Verifique o diretório de dados.",
      },
      404,
    );
  if (/SQLITE|FOREIGN KEY|UNIQUE constraint/.test(message))
    return json(
      { error: "Relação inexistente ou registro duplicado. Revise os dados." },
      409,
    );
  return json(
    { error: message.replace(/api-key=[^&\s]+/g, "api-key=***") },
    400,
  );
}
export async function GET(request: NextRequest, ctx: Context) {
  try {
    authorize(request);
    const [area, id, action] = (await ctx.params).path;
    if (area === "storage")
      return json({
        direct: cloud,
        importMaxBytes: cloud ? 50 * 1024 * 1024 : 256 * 1024 * 1024,
      });
    if (area === "catalog") {
      await cleanupDeletedPhotos();
      return json(await catalog());
    }
    if (area === "nature-photos") return json(await getNaturePhotos());
    if (area === "reflections") return json(await getReflections());
    if (area === "pubchem" && id === "search")
      return json(await searchPubChem(request.nextUrl.searchParams.get("q") || ""));
    if (area === "lotus" && id === "search") {
      const mode = z.enum(["plant", "compound"]).parse(request.nextUrl.searchParams.get("mode"));
      return json(await searchLotus(mode, request.nextUrl.searchParams.get("q") || ""));
    }
    if (area === "observations" && id) return json(await observationDetail(id));
    if (area === "images" && id) {
      const photo = await get<Photo>("images", id);
      if (!photo) return json({ error: "Imagem não encontrada." }, 404);
      const variant = request.nextUrl.searchParams.get("variant");
      const filename =
        variant === "original"
          ? photo.original
          : variant === "optimized"
            ? photo.optimized
            : photo.thumbnail;
      if (cloud)
        return NextResponse.redirect(
          await signedDownload(`images/${filename}`),
        );
      const bytes = await readObject(`images/${filename}`);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type":
            variant === "original"
              ? {
                  jpg: "image/jpeg",
                  png: "image/png",
                  webp: "image/webp",
                  tiff: "image/tiff",
                  heif: "image/heif",
                }[path.extname(filename).slice(1)] || "application/octet-stream"
              : "image/jpeg",
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (area === "export" && cloud) {
      await cleanupTemporaryObjects("exports");
      const format = z.enum(["json", "zip", "csv"]).parse(id);
      const table =
        format === "csv"
          ? z
              .enum(["species", "observations", "compounds"])
              .parse(request.nextUrl.searchParams.get("table"))
          : "species";
      const bytes =
        format === "zip"
          ? await backup()
          : Buffer.from(
              format === "json"
                ? JSON.stringify(await exportCatalog(), null, 2)
                : await csv(table),
            );
      const key = `exports/${randomUUID()}.${format}`;
      await writeObject(key, bytes);
      return NextResponse.redirect(
        await signedDownload(key, `campo-catalogo.${format}`),
      );
    }
    if (area === "export") {
      if (id === "json")
        return new Response(JSON.stringify(await exportCatalog(), null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": 'attachment; filename="campo-catalogo.json"',
            "Cache-Control": "no-store",
          },
        });
      if (id === "zip")
        return new Response(new Uint8Array(await backup()), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="campo-backup.zip"',
            "Cache-Control": "no-store",
          },
        });
      if (id === "csv") {
        const table = z
          .enum(["species", "observations", "compounds"])
          .parse(request.nextUrl.searchParams.get("table"));
        return new Response(await csv(table), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="campo-${table}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      }
    }
    if (area === "species" && id && action === "evidence")
      return json(await list("evidence"));
    return json({ error: "Rota não encontrada." }, 404);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest, ctx: Context) {
  try {
    authorize(request);
    const [area, id, action] = (await ctx.params).path;
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 270 * 1024 * 1024)
      return json({ error: "Arquivo muito grande." }, 413);
    if (area === "identification" && id === "preview")
      return json(
        await previewIdentification(await limitedForm(request, 3800000)),
      );
    if (area === "identification" && id === "save") {
      if (!cloud) {
        const form = await limitedForm(request, 101 * 1024 * 1024);
        return json(
          await saveIdentifiedObservation(
            form,
            String(form.get("receipt") || ""),
          ),
          201,
        );
      }
      const input = z
        .object({
          receipt: z.string().max(500000),
          uploads: z.array(z.string()).max(5),
        })
        .parse(await limitedJson(request));
      readReceipt(input.receipt);
      const form = new FormData();
      try {
        for (const ticket of input.uploads) {
          const { bytes, payload } = await readUpload(ticket, "photo");
          form.append(
            "photos",
            new File([new Uint8Array(bytes)], payload.name, {
              type: payload.type,
            }),
          );
        }
        return json(await saveIdentifiedObservation(form, input.receipt), 201);
      } finally {
        await Promise.all(
          input.uploads.map((t) => discardUpload(t, "photo").catch(() => {})),
        );
      }
    }
    if (area === "uploads" && cloud)
      return json(await createUpload(await limitedJson(request)));
    if (area === "observations" && !id && cloud) {
      const value = z
        .object({
          data: z.unknown(),
          uploads: z.array(z.string()).min(1).max(12),
        })
        .parse(await limitedJson(request));
      const form = new FormData();
      form.set("data", JSON.stringify(value.data));
      let total = 0;
      for (const ticket of value.uploads) {
        const { bytes, payload } = await readUpload(ticket, "photo");
        total += bytes.length;
        if (total > 100 * 1024 * 1024)
          throw new Error("O envio não pode superar 100 MB.");
        form.append(
          "photos",
          new File([new Uint8Array(bytes)], payload.name, {
            type: payload.type,
          }),
        );
      }
      const result = await createObservation(form);
      await Promise.all(
        value.uploads.map((t) => discardUpload(t, "photo").catch(() => {})),
      );
      return json(result, 201);
    }
    if (area === "observations" && !id)
      return json(
        await createObservation(await limitedForm(request, 101 * 1024 * 1024)),
        201,
      );
    if (area === "import" && cloud) {
      const value = z
        .object({
          ticket: z.string(),
          strategy: z.enum(["skip", "update", "new", "restore"]).optional(),
          hash: z.string().optional(),
        })
        .parse(await limitedJson(request));
      const { bytes } = await readUpload(value.ticket, "import");
      if (id === "preview") return json(await previewImport(bytes));
      if (id !== "commit" || !value.strategy || !value.hash)
        throw new Error("Valide o arquivo antes de importar.");
      const result = await importCatalog(bytes, value.strategy, value.hash);
      await discardUpload(value.ticket, "import").catch(() => {});
      return json(result);
    }
    if (area === "import") {
      const form = await limitedForm(request, 257 * 1024 * 1024);
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Selecione JSON ou ZIP.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (id === "preview") return json(await previewImport(bytes));
      const strategy = z
        .enum(["skip", "update", "new", "restore"])
        .parse(form.get("strategy"));
      return json(
        await importCatalog(bytes, strategy, String(form.get("hash"))),
      );
    }
    const input = await limitedJson(request);
    if (area === "notes" && !id) return json(await createNote(input), 201);
    if (area === "observations" && id) {
      if (action === "identify")
        return json(
          await identify(
            id,
            z.object({ refresh: z.boolean().default(false) }).parse(input)
              .refresh,
          ),
        );
      if (action === "confirm")
        return json(await confirmIdentification(id, input));
      if (action === "compare") {
        const value = z
          .object({
            name: z.string().min(2).max(250),
            refresh: z.boolean().default(false),
          })
          .parse(input);
        return json(await compare(id, value.name, value.refresh));
      }
    }
    if (area === "species" && id && action === "investigate") {
      const value = z.object({
        refresh: z.boolean().default(false),
        compoundName: z.string().max(120).default(""),
      }).parse(input);
      return json(await investigate(id, value.refresh, value.compoundName));
    }
    if (area === "compounds") {
      const record = compoundSchema.parse({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      });
      await put("compounds", record);
      return json(record, 201);
    }
    if (area === "evidence") {
      const record = evidenceSchema.parse({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      });
      await put("evidence", record);
      return json(record, 201);
    }
    if (area === "discoveries" && id && action === "incorporate")
      return json(await incorporate(id, input));
    return json({ error: "Rota não encontrada." }, 404);
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: NextRequest, ctx: Context) {
  try {
    authorize(request);
    const [area, id] = (await ctx.params).path;
    const input = await limitedJson(request);
    return await transaction(async () => {
      if (area === "notes" && id) return json(await updateNote(id, input));
      if (area === "species") return json(await updateSpecies(id, input));
      if (area === "observations") {
        const current = await get<Observation>("observations", id);
        if (!current) throw new Error("Observação não encontrada.");
        const value = observationInput.parse({ ...current, ...input });
        if (value.group !== current.group && current.speciesId)
          throw new Error("A espécie vinculada define o grupo da observação.");
        const record = {
          ...current,
          ...value,
          observedAt: value.observedAt || current.observedAt,
        };
        await put("observations", record);
        return json(record);
      }
      if (area === "discoveries") {
        const current = await get<Discovery>("discoveries", id);
        if (!current) throw new Error("Descoberta não encontrada.");
        const { status } = discoverySchema.pick({ status: true }).parse(input);
        if (status === "incorporated")
          throw new Error(
            "Use Incorporar evidência para revisar e incluir na ficha.",
          );
        await put("discoveries", { ...current, status });
        return json({ ok: true });
      }
      return json({ error: "Rota não encontrada." }, 404);
    });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(request: NextRequest, ctx: Context) {
  try {
    authorize(request);
    const [area, id, action] = (await ctx.params).path;
    if (area !== "observations" || !id || action)
      return json({ error: "Rota não encontrada." }, 404);
    z.object({ confirm: z.literal(true) }).parse(await limitedJson(request));
    return json(await deleteObservation(id));
  } catch (error) {
    return failure(error);
  }
}
