import { cloud, query, transaction } from "@/lib/db";
import { get, list } from "@/lib/db/repository";
import type { Photo } from "@/lib/validation/schemas";
import { removeObject } from "@/lib/storage/objects";
type Job = { files: string[] };
const provider = "photo-deletion";
const filenames = (p: Photo) => [p.original, p.optimized, p.thumbnail];

/** Cleanup is durable and retriable; never remove files still referenced by another record. */
export async function cleanupDeletedPhotos() {
  return transaction(async () => {
    const jobs = await query<{ id: string; data: Job | string }>(
      "SELECT id,data FROM cache WHERE provider=$1 ORDER BY created_at LIMIT 3",
      [provider],
    );
    if (!jobs.length) return 0;
    const referenced = new Set(
      (await list<Photo>("images")).flatMap(filenames),
    );
    let pending = 0;
    for (const row of jobs) {
      const job: Job =
        typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      const remaining: string[] = [];
      for (const file of job.files) {
        if (referenced.has(file)) continue;
        try {
          await removeObject(`images/${file}`);
        } catch {
          remaining.push(file);
        }
      }
      pending += remaining.length;
      if (remaining.length)
        await query("UPDATE cache SET data=$1 WHERE id=$2", [
          cloud ? { files: remaining } : JSON.stringify({ files: remaining }),
          row.id,
        ]);
      else await query("DELETE FROM cache WHERE id=$1", [row.id]);
    }
    const [left] = await query<{ n: number | string }>("SELECT count(*) AS n FROM cache WHERE provider=$1", [provider]);
    return Number(left.n) ? pending || -1 : 0;
  });
}
export async function deleteObservation(id: string) {
  await transaction(async () => {
    if (!(await get("observations", id))) return;
    const photos = (await list<Photo>("images")).filter(
      (p) => p.observationId === id,
    );
    const job: Job = { files: [...new Set(photos.flatMap(filenames))] };
    if (job.files.length)
      await query(
        "INSERT INTO cache (id,provider,query,data,created_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        [
          `photo-deletion:${id}`,
          provider,
          id,
          cloud ? job : JSON.stringify(job),
          new Date().toISOString(),
          0,
        ],
      );
    for (const table of ["identifications", "history", "images"])
      await query(`DELETE FROM ${table} WHERE observation_id=$1`, [id]);
    await query("DELETE FROM observations WHERE id=$1", [id]);
  });
  // The record is already deleted. A Storage outage must not report the deletion as failed.
  const pendingFiles = await cleanupDeletedPhotos().catch(() => -1);
  return { ok: true, pendingFiles };
}
