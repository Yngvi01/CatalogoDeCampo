"use client";
import { useState } from "react";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import { Modal } from "@/components/shared";
import { normalize } from "@/lib/utils";
import { findLibraryEntry, libraryEntries, libraryPhotos, type LibraryEntry } from "./entries";

const categories = ["Todas", "Composição", "Uso tradicional", "Uso alimentar", "Ecologia", "Segurança"] as const;

export function LibraryEntryModal({ entry, onClose }: { entry: LibraryEntry; onClose: () => void }) {
  const photo = libraryPhotos[entry.id];
  return <Modal title={entry.commonName} subtitle={`${entry.scientificName} · ${entry.family}`} onClose={onClose} wide>
    <article className="library-detail">
      <figure className="library-detail-photo"><img src={photo.src} alt={`${entry.commonName}${entry.photoSubject ? ` — exemplo ilustrado: ${entry.photoSubject}` : ""}`} />
        <figcaption>Foto: <a href={photo.filePage} target="_blank" rel="noreferrer">{photo.author || "Autor não informado"} · Wikimedia Commons</a> · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a>{entry.photoSubject && <> · Exemplar da foto: <em>{entry.photoSubject}</em></>}</figcaption>
      </figure>
      <div className="library-detail-body">
        <span className="pill">{entry.scope === "genus" ? "VISÃO GERAL DO GÊNERO" : "ESPÉCIE DOCUMENTADA NO RS"}</span>
        <p className="library-lead">{entry.occurrence}</p>
        <h3>Como reconhecer</h3><p>{entry.recognition}</p>
        {entry.aliases?.length && <p><strong>Outro nome científico usado:</strong> <em>{entry.aliases.join(" · ")}</em></p>}
        {entry.note && <p className="library-note">{entry.note}</p>}
        <h3>O que as fontes registram</h3>
        <div className="library-claims">{entry.claims.map((claim, index) => <section className="library-claim" key={index}>
          <span className="badge">{claim.kind}</span><h4>{claim.title}</h4><p>{claim.description}</p>
          {claim.part && <small>Parte estudada ou usada: {claim.part}</small>}
          <a href={entry.sources[claim.source].url} target="_blank" rel="noreferrer">Fonte: {entry.sources[claim.source].title} <ArrowUpRight size={12} /></a>
        </section>)}</div>
        <h3>Fontes da ficha</h3><ol className="library-sources">{entry.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></li>)}</ol>
        <p className="library-note">Conteúdo para estudo. Fotos e sugestões automáticas não confirmam uma espécie nem a segurança de consumir ou preparar uma planta. Propriedades de extratos e produtos estudados não valem automaticamente para exemplares encontrados em campo.</p>
      </div>
    </article>
  </Modal>;
}

export function LibraryLink({ scientificName }: { scientificName: string }) {
  const [open, setOpen] = useState(false);
  const entry = findLibraryEntry(scientificName);
  if (!entry) return null;
  return <><button className="text-button library-link" type="button" onClick={() => setOpen(true)}><BookOpen size={14} /> {entry.scope === "genus" ? "Ver gênero na biblioteca" : "Ver na biblioteca"} <ArrowUpRight size={13} /></button>
    {open && <LibraryEntryModal entry={entry} onClose={() => setOpen(false)} />}</>;
}

export function LibraryPanel({ query }: { query: string }) {
  const [selected, setSelected] = useState<LibraryEntry | null>(null);
  const [category, setCategory] = useState<(typeof categories)[number]>("Todas");
  const [localQuery, setLocalQuery] = useState("");
  const search = normalize([query, localQuery].filter(Boolean).join(" "));
  const entries = libraryEntries.filter(entry =>
    (category === "Todas" || entry.claims.some(claim => claim.kind === category)) &&
    (!search || normalize([entry.commonName, entry.scientificName, entry.family, ...(entry.aliases || []), entry.occurrence, ...entry.claims.map(claim => `${claim.title} ${claim.description}`)].join(" ")).includes(search)));
  return <section className="library-panel" aria-label="Biblioteca de plantas do Rio Grande do Sul">
    <div className="library-intro panel"><BookOpen size={28} /><div><h2>Plantas do Rio Grande do Sul</h2><p>Espécies e gêneros documentados no estado, com composição, usos e fontes para consultar. A biblioteca é independente do seu catálogo pessoal.</p></div><span className="pill">{libraryEntries.length} FICHAS</span></div>
    <div className="library-toolbar"><label><Search size={17} /><input aria-label="Buscar na biblioteca" value={localQuery} onChange={event => setLocalQuery(event.target.value)} placeholder="Nome, família ou propriedade…" /></label><div className="library-filters" aria-label="Filtrar propriedades">{categories.map(item => <button key={item} type="button" className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    <p className="library-count">{entries.length} {entries.length === 1 ? "ficha encontrada" : "fichas encontradas"}</p>
    {entries.length ? <div className="library-grid">{entries.map(entry => {
      const photo = libraryPhotos[entry.id];
      return <button className="library-card panel" type="button" key={entry.id} onClick={() => setSelected(entry)} aria-label={`Abrir ficha de ${entry.commonName}`}>
        <img src={photo.src} alt="" loading="lazy" /><span className="library-card-copy"><small>{entry.scope === "genus" ? "GÊNERO · VISÃO GERAL" : entry.family.toUpperCase()}</small><strong>{entry.commonName}</strong><em>{entry.scientificName}</em><span>{entry.claims.slice(0, 2).map(claim => claim.kind).join(" · ")}</span></span><ArrowUpRight className="library-card-arrow" size={16} /></button>;
    })}</div> : <div className="panel library-empty">Nenhuma ficha corresponde à busca. Experimente outro nome ou filtro.</div>}
    {selected && <LibraryEntryModal entry={selected} onClose={() => setSelected(null)} />}
  </section>;
}
