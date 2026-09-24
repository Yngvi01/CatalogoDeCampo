import { Leaf, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { libraryPhotos } from "@/features/library/entries";

const examples = [
  {
    name: "Ipomoea violacea", commonName: "Ipomeia", family: "Convolvulaceae", group: "plant",
    src: "/catalog-examples/ipomoea-violacea.webp", photoLabel: "ILUSTRAÇÃO HISTÓRICA",
    author: "Nikolaus Joseph von Jacquin", license: "Domínio público",
    filePage: "https://commons.wikimedia.org/wiki/File:Ipomoea_violacea_illustration.jpg",
  },
  {
    name: "Casearia sylvestris", commonName: "Cafezeiro-do-mato", family: "Salicaceae", group: "plant",
    src: "/catalog-examples/casearia-sylvestris.webp", photoLabel: "FOTO ILUSTRATIVA",
    author: "Tarciso Leão", license: "CC BY 2.0",
    filePage: "https://commons.wikimedia.org/wiki/File:Casearia_sylvestris,_caiubim_(8527428872).jpg",
  },
  {
    name: "Mimosa scabrella", commonName: "Bracatinga", family: "Fabaceae", group: "plant",
    src: libraryPhotos["mimosa-scabrella"].src, photoLabel: "FOTO ILUSTRATIVA",
    author: libraryPhotos["mimosa-scabrella"].author, license: libraryPhotos["mimosa-scabrella"].license,
    filePage: libraryPhotos["mimosa-scabrella"].filePage,
  },
  {
    name: "Amanita muscaria", commonName: "Cogumelo mata-moscas", family: "Amanitaceae", group: "fungus",
    src: "/catalog-examples/amanita-muscaria.webp", photoLabel: "FOTO ILUSTRATIVA",
    author: "manninka", license: "CC0",
    filePage: "https://commons.wikimedia.org/wiki/File:Amanita_muscaria_166184268.jpg",
  },
] as const;

export function CatalogExampleCards({ onNew, view }: { onNew: () => void; view: "grid" | "list" }) {
  return <section className="catalog-examples" aria-label="Exemplos visuais de cards do catálogo">
    <div className="catalog-examples-heading">
      <div><span className="eyebrow">PRÉVIA DO CATÁLOGO</span><h3>Assim podem ficar suas espécies</h3><p>Quatro cards ilustrativos. Não são espécies nem observações salvas no seu catálogo; a imagem de <em>Ipomoea violacea</em> é uma ilustração histórica.</p></div>
      <Button type="button" variant="outline" size="sm" onClick={onNew}><Plus size={15} /> Fazer minha observação</Button>
    </div>
    <div className={`cards ${view === "list" ? "list-view" : ""}`}>
      {examples.map(entry => {
        return <article className="organism-card panel" key={entry.name}>
          <div className="card-photo"><img src={entry.src} alt={`${entry.photoLabel.toLowerCase()} de ${entry.name}`} loading="lazy" /><span className="photo-label">{entry.photoLabel}</span></div>
          <div className="card-body"><small>{entry.family.toUpperCase()} · EXEMPLO</small><h3><em>{entry.name}</em></h3><p><Leaf size={13} /> {entry.commonName}</p><div className="card-meta"><span>{entry.group === "fungus" ? "FUNGO" : "PLANTA"} · Prévia sem registro</span></div></div>
        </article>;
      })}
    </div>
    <p className="catalog-examples-credit">Imagens redimensionadas de Wikimedia Commons: {examples.map((entry, index) => <span key={entry.name}>{index > 0 && " · "}<a href={entry.filePage} target="_blank" rel="noreferrer">{entry.author} ({entry.license})</a></span>)}</p>
  </section>;
}
