import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { findLibraryEntry, libraryEntries, libraryPhotos } from "../features/library/entries";

test("biblioteca gaúcha tem dez fichas com fotos, créditos e fontes rastreáveis", () => {
  assert.equal(libraryEntries.length, 10);
  assert.equal(new Set(libraryEntries.map(entry => entry.id)).size, 10);
  for (const entry of libraryEntries) {
    assert.ok(entry.occurrence && entry.recognition && entry.sources.length);
    assert.ok(entry.claims.length);
    assert.equal(entry.scope === "genus", entry.scientificName.endsWith("spp."));
    for (const claim of entry.claims) {
      assert.ok(entry.sources[claim.source]?.url.startsWith("https://"), `${entry.id}: fonte ausente para ${claim.title}`);
    }
    const photo = libraryPhotos[entry.id];
    assert.ok(existsSync(join(process.cwd(), "public", photo.src)), `${entry.id}: foto ausente`);
    assert.ok(photo.author && photo.license && photo.filePage && photo.licenseUrl);
    if (entry.scope === "genus") assert.ok(entry.photoSubject, `${entry.id}: espécie da foto não informada`);
  }
});

test("links de identificação reconhecem sinônimos e limitam fichas de gênero", () => {
  assert.equal(findLibraryEntry("Maytenus ilicifolia")?.id, "monteverdia-ilicifolia");
  assert.equal(findLibraryEntry("Achyrocline saturejoides")?.id, "achyrocline-satureioides");
  assert.equal(findLibraryEntry("Passiflora edulis")?.id, "passiflora-spp");
  assert.equal(findLibraryEntry("Ipomoea purpurea")?.id, "ipomoea-spp");
  assert.equal(findLibraryEntry("Solanum americanum"), undefined);
});
