import { Leaf, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { libraryEntries, libraryPhotos } from "@/features/library/entries";

const exampleIds = ["mimosa-scabrella", "erythrina-falcata", "ilex-paraguariensis"] as const;

export function IdentificationExampleCards({ onNew }: { onNew: () => void }) {
  const examples = exampleIds.map(id => libraryEntries.find(entry => entry.id === id)!);
  return <section className="identification-examples" aria-label="Exemplos visuais de cards de observação">
    <div className="identification-examples-heading">
      <div><span className="eyebrow">PRÉVIA VISUAL</span><h3>Assim podem ficar suas observações</h3><p>Fotos ilustrativas da Biblioteca. Estes cards são exemplos e não são registros do seu catálogo.</p></div>
      <Button type="button" variant="outline" size="sm" onClick={onNew}><Plus size={15} /> Fazer minha observação</Button>
    </div>
    <div className="cards">
      {examples.map(entry => {
        const photo = libraryPhotos[entry.id];
        return <article className="organism-card panel" key={entry.id}>
          <div className="card-photo"><img src={photo.src} alt={entry.scientificName} loading="lazy" /><span className="photo-label">FOTO ILUSTRATIVA</span></div>
          <div className="card-body"><small>{entry.family.toUpperCase()} · EXEMPLO</small><h3><em>{entry.scientificName}</em></h3><p><Leaf size={13} /> {entry.commonName}</p><div className="card-meta"><span>Prévia visual · sem registro</span></div></div>
        </article>;
      })}
    </div>
    <p className="identification-examples-credit">Fotos: {examples.map((entry, index) => <span key={entry.id}>{index > 0 && " · "}<a href={libraryPhotos[entry.id].filePage} target="_blank" rel="noreferrer">{libraryPhotos[entry.id].author} ({libraryPhotos[entry.id].license})</a></span>)} · Wikimedia Commons</p>
  </section>;
}
