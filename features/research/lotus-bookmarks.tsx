"use client";
import { useState } from "react";
import { ArrowUpRight, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, ErrorText, Modal, api } from "@/components/shared";
import type { LotusBookmark } from "@/lib/validation/schemas";
import type { LotusHit, LotusTaxon } from "@/lib/providers/lotus";
import { LotusReviewForm } from "./lotus-review-form";

export function LotusBookmarks({ bookmarks, refresh, onReviewed }: { bookmarks: LotusBookmark[]; refresh: () => Promise<void>; onReviewed: () => void }) {
  const [review, setReview] = useState<LotusBookmark | null>(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState("");
  const sorted = [...bookmarks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const taxon = (item: LotusBookmark): LotusTaxon => ({ name: item.scientificName, rank: "species", references: item.references });
  const hit = (item: LotusBookmark): LotusHit => ({
    lotusId: item.lotusId, name: item.compoundName, formula: item.formula, inchiKey: item.inchiKey,
    chemicalClass: item.chemicalClass, url: `https://lotus.naturalproducts.net/compound/lotus_id/${item.lotusId}`, taxa: [taxon(item)],
  });
  return <section className="lotus-bookmarks" aria-label="Relações para revisar">
    <p className="lotus-caveat">Estas são relações candidatas guardadas para leitura posterior. Elas não aparecem como evidência do catálogo até você conferir a publicação e salvar a revisão.</p>
    <ErrorText message={error} />
    {sorted.length ? <div className="lotus-bookmark-list">{sorted.map(item => <article className="panel lotus-bookmark" key={item.id}>
      <span className="eyebrow">LOTUS · {item.lotusId}</span><h3>{item.compoundName} <span>→ <em>{item.scientificName}</em></span></h3>
      <p>{item.formula || "Fórmula não informada"} · {item.references.length} {item.references.length === 1 ? "referência" : "referências"}</p>
      <div className="lotus-references">{item.references.filter(reference => reference.url).slice(0, 3).map(reference => <a key={reference.url} href={reference.url!} target="_blank" rel="noreferrer">{reference.label} <ArrowUpRight size={11} /></a>)}</div>
      <div className="lotus-bookmark-actions"><Button type="button" size="sm" onClick={() => setReview(item)}>Revisar relação</Button><Button type="button" size="sm" variant="outline" disabled={removing === item.id} onClick={async () => {
        if (!window.confirm("Remover esta relação da lista de revisão?")) return;
        setRemoving(item.id); setError("");
        try { await api(`lotus/bookmarks/${item.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) }); await refresh(); }
        catch (cause) { setError((cause as Error).message); }
        finally { setRemoving(""); }
      }}>{removing === item.id ? "Removendo…" : "Remover da lista"}</Button></div>
    </article>)}</div> : <Empty icon={<Bookmark size={30} />} title="Nenhuma relação aguardando revisão." text="Na exploração do LOTUS, use “Guardar para revisar” numa relação com espécie para encontrá-la aqui depois." />}
    {review && <Modal title="Revisar relação do LOTUS" subtitle="A incorporação depende da publicação" onClose={() => setReview(null)} wide>
      <LotusReviewForm hit={hit(review)} taxon={taxon(review)} onSaved={async () => { await refresh(); setReview(null); onReviewed(); }} />
    </Modal>}
  </section>;
}
