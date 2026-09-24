import { validToken, sameOrigin } from "@/lib/auth";
import { limitedForm, limitedJson } from "@/lib/validation/body";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
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
import { imageDir } from "@/lib/storage/photos";
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
import { getReflections } from "@/lib/providers/zenquotes";
import {
  createNote,
  updateNote,
  NoteConflictError,
} from "@/features/notebook/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
    if (area === "catalog") return json(catalog());
    if (area === "reflections") return json(await getReflections());
    if (area === "observations" && id) return json(observationDetail(id));
    if (area === "images" && id) {
      const photo = get<Photo>("images", id);
      if (!photo) return json({ error: "Imagem não encontrada." }, 404);
      const variant = request.nextUrl.searchParams.get("variant");
      const filename =
        variant === "original"
          ? photo.original
          : variant === "optimized"
            ? photo.optimized
            : photo.thumbnail;
      const bytes = await readFile(path.join(imageDir, filename));
      return new Response(bytes, {
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
    if (area === "export") {
      if (id === "json")
        return new Response(JSON.stringify(exportCatalog(), null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": 'attachment; filename="campo-catalogo.json"',
            "Cache-Control": "no-store",
          },
        });
      if (id === "zip")
        return new Response(new Uint8Array(backup()), {
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
        return new Response(csv(table), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="campo-${table}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      }
    }
    if (area === "species" && id && action === "evidence")
      return json(list("evidence"));
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
    if (area === "observations" && !id)
      return json(
        await createObservation(await limitedForm(request, 101 * 1024 * 1024)),
        201,
      );
    if (area === "import") {
      const form = await limitedForm(request, 257 * 1024 * 1024);
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Selecione JSON ou ZIP.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (id === "preview") return json(previewImport(bytes));
      const strategy = z
        .enum(["skip", "update", "new", "restore"])
        .parse(form.get("strategy"));
      return json(importCatalog(bytes, strategy, String(form.get("hash"))));
    }
    const input = await limitedJson(request);
    if (area === "notes" && !id) return json(createNote(input), 201);
    if (area === "observations" && id) {
      if (action === "identify")
        return json(
          await identify(
            id,
            z.object({ refresh: z.boolean().default(false) }).parse(input)
              .refresh,
          ),
        );
      if (action === "confirm") return json(confirmIdentification(id, input));
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
    if (area === "species" && id && action === "investigate")
      return json(
        await investigate(
          id,
          z.object({ refresh: z.boolean().default(false) }).parse(input)
            .refresh,
        ),
      );
    if (area === "compounds") {
      const record = compoundSchema.parse({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      });
      put("compounds", record);
      return json(record, 201);
    }
    if (area === "evidence") {
      const record = evidenceSchema.parse({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      });
      put("evidence", record);
      return json(record, 201);
    }
    if (area === "discoveries" && id && action === "incorporate")
      return json(incorporate(id, input));
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
    if (area === "notes" && id) return json(updateNote(id, input));
    if (area === "species") return json(updateSpecies(id, input));
    if (area === "observations") {
      const current = get<Observation>("observations", id);
      if (!current) throw new Error("Observação não encontrada.");
      const value = observationInput.parse({ ...current, ...input });
      if (value.group !== current.group && current.speciesId)
        throw new Error("A espécie vinculada define o grupo da observação.");
      const record = {
        ...current,
        ...value,
        observedAt: value.observedAt || current.observedAt,
      };
      put("observations", record);
      return json(record);
    }
    if (area === "discoveries") {
      const current = get<Discovery>("discoveries", id);
      if (!current) throw new Error("Descoberta não encontrada.");
      const { status } = discoverySchema.pick({ status: true }).parse(input);
      if (status === "incorporated")
        throw new Error(
          "Use Incorporar evidência para revisar e incluir na ficha.",
        );
      put("discoveries", { ...current, status });
      return json({ ok: true });
    }
    return json({ error: "Rota não encontrada." }, 404);
  } catch (e) {
    return failure(e);
  }
}
