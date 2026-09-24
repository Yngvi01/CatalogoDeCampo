import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

test(
  "Supabase real: persistência, concorrência, rollback, upload privado e backup portátil",
  { skip: process.env.CAMPO_SUPABASE_TEST !== "1" },
  async () => {
    assert.equal(process.env.CAMPO_STORAGE, "supabase");
    const db = await import("../lib/db");
    const repo = await import("../lib/db/repository");
    const notes = await import("../features/notebook/service");
    const observations = await import("../features/observations/service");
    const photos = await import("../lib/storage/photos");
    const objects = await import("../lib/storage/objects");
    const uploads = await import("../lib/storage/uploads");
    const backups = await import("../features/backup/service");
    const ids: string[] = [];
    let observationId: string | undefined;
    let ticket: string | undefined;
    try {
      const note = await notes.createNote({
        title: `Teste temporário ${randomUUID()}`,
        content: "Persistência real.",
      });
      ids.push(note.id);
      assert.equal(
        (await repo.get<{ content: string }>("notes", note.id))?.content,
        "Persistência real.",
      );
      const edits = await Promise.allSettled([
        notes.updateNote(note.id, {
          content: "Janela A",
          expectedUpdatedAt: note.updatedAt,
        }),
        notes.updateNote(note.id, {
          content: "Janela B",
          expectedUpdatedAt: note.updatedAt,
        }),
      ]);
      assert.equal(edits.filter((e) => e.status === "fulfilled").length, 1);
      assert.equal(
        edits.filter(
          (e) =>
            e.status === "rejected" &&
            e.reason instanceof notes.NoteConflictError,
        ).length,
        1,
      );
      let rolledBack = "";
      await assert.rejects(
        db.transaction(async () => {
          const row = await notes.createNote({
            title: "Rollback de teste",
            content: "Não deve persistir",
          });
          rolledBack = row.id;
          ids.push(row.id);
          throw new Error("rollback deliberado");
        }),
        /rollback deliberado/,
      );
      assert.equal(await repo.get("notes", rolledBack), undefined);

      const bytes = await sharp({
        create: { width: 80, height: 60, channels: 3, background: "#728453" },
      })
        .jpeg()
        .toBuffer();
      const upload = await uploads.createUpload({
        name: "integration.jpg",
        type: "image/jpeg",
        size: bytes.length,
        purpose: "photo",
      });
      ticket = upload.ticket;
      const form = new FormData();
      form.append(
        "",
        new File([new Uint8Array(bytes)], "integration.jpg", {
          type: "image/jpeg",
        }),
      );
      const response = await fetch(upload.url, {
        method: "PUT",
        body: form,
        headers: { "x-upsert": "false" },
      });
      assert.equal(response.ok, true);
      const received = await uploads.readUpload(ticket, "photo");
      assert.deepEqual(received.bytes, bytes);
      assert.throws(() => uploads.verifyTicket(ticket!, "import"));
      assert.throws(() => uploads.verifyTicket(ticket! + "tampered", "photo"));
      const observationForm = new FormData();
      observationForm.set(
        "data",
        JSON.stringify({ group: "plant", notes: "Teste temporário Supabase" }),
      );
      observationForm.append(
        "photos",
        new File([new Uint8Array(bytes)], "integration.jpg", {
          type: "image/jpeg",
        }),
      );
      const created = await observations.createObservation(observationForm);
      observationId = created.observation.id;
      const detail = await observations.observationDetail(observationId);
      assert.equal(detail.photos.length, 1);
      const photo = detail.photos[0];
      assert.deepEqual(
        await objects.readObject(`images/${photo.original}`),
        bytes,
      );
      const privateResponse = await fetch(
        `${process.env.SUPABASE_URL}/storage/v1/object/public/${objects.bucket}/images/${photo.original}`,
      );
      assert.equal(privateResponse.ok, false);
      const signed = await objects.signedDownload(`images/${photo.original}`);
      assert.equal((await fetch(signed)).ok, true);
      const backup = await backups.backup();
      const parsed = backups.parseImport(backup);
      assert.ok(
        parsed.payload.data.observations.some((o) => o.id === observationId),
      );
      assert.equal(parsed.files["database.sqlite"], undefined);
      assert.ok(parsed.files[`images/${photo.original}`]);
    } finally {
      if (ticket) await uploads.discardUpload(ticket, "photo").catch(() => {});
      if (observationId) {
        const detail = await observations.observationDetail(observationId);
        await Promise.all(detail.photos.map(photos.removePhoto));
        await db.transaction(async () => {
          await db.query("DELETE FROM images WHERE observation_id=$1", [
            observationId,
          ]);
          await db.query("DELETE FROM observations WHERE id=$1", [
            observationId,
          ]);
        });
      }
      for (const id of ids)
        await db.query("DELETE FROM notes WHERE id=$1", [id]);
      await db.closeDatabase();
    }
  },
);
