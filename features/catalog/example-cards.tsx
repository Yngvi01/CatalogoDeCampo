"use client";
import { useState } from "react";
import { ArrowUpRight, Leaf, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared";
import { libraryPhotos } from "@/features/library/entries";

const examples = [
  {
    name: "Ipomoea violacea", commonName: "Ipomeia", family: "Convolvulaceae", group: "plant",
    src: "/catalog-examples/ipomoea-violacea.webp", photoLabel: "ILUSTRAÇÃO HISTÓRICA",
    author: "Nikolaus Joseph von Jacquin", license: "Domínio público",
    filePage: "https://commons.wikimedia.org/wiki/File:Ipomoea_violacea_illustration.jpg",
    note: "O nome Ipomoea violacea foi aplicado a outras espécies em parte da literatura. Esta ilustração histórica não confirma a identidade nem a composição de uma planta fotografada hoje.",
    finding: "Identidade taxonômica a conferir antes de associar compostos à espécie.",
    source: "Alencar et al., Rodriguésia (2021)",
    sourceUrl: "https://www.scielo.br/j/rod/a/P3JDNQfSRMtnwpgDMH3MHBr/?lang=en",
  },
  {
    name: "Casearia sylvestris", commonName: "Cafezeiro-do-mato", family: "Salicaceae", group: "plant",
    src: "/catalog-examples/casearia-sylvestris.webp", photoLabel: "FOTO ILUSTRATIVA",
    author: "Tarciso Leão", license: "CC BY 2.0",
    filePage: "https://commons.wikimedia.org/wiki/File:Casearia_sylvestris,_caiubim_(8527428872).jpg",
    note: "Uma identificação visual sugeriria a espécie, mas a composição química de uma amostra só pode ser avaliada por análise.",
    finding: "Casearin X foi isolada de extrato de folhas de Casearia sylvestris em estudo publicado.",
    source: "Santos et al., Chemistry & Biodiversity (2010)",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/20087991/",
  },
  {
    name: "Mimosa scabrella", commonName: "Bracatinga", family: "Fabaceae", group: "plant",
    src: libraryPhotos["mimosa-scabrella"].src, photoLabel: "FOTO ILUSTRATIVA",
    author: libraryPhotos["mimosa-scabrella"].author, license: libraryPhotos["mimosa-scabrella"].license,
    filePage: libraryPhotos["mimosa-scabrella"].filePage,
    note: "Uma foto pode ajudar a reconhecer a bracatinga. O teor de compostos não pode ser inferido pela aparência da árvore.",
    finding: "Um estudo relatou N,N-dimetiltriptamina em extrato alcoólico da casca analisada.",
    source: "Moraes et al., Química Nova (1990)",
    sourceUrl: "https://quimicanova.sbq.org.br/Content/pdf/Vol13No4_308_v13_n4_(21).pdf",
  },
  {
    name: "Amanita muscaria", commonName: "Cogumelo mata-moscas", family: "Amanitaceae", group: "fungus",
    src: "/catalog-examples/amanita-muscaria.webp", photoLabel: "FOTO ILUSTRATIVA",
    author: "manninka", license: "CC0",
    filePage: "https://commons.wikimedia.org/wiki/File:Amanita_muscaria_166184268.jpg",
    note: "Fungo tóxico. A identificação por foto e estudos com substâncias isoladas não demonstram segurança de consumo.",
    finding: "Muscimol e ácido ibotênico foram identificados em exemplares analisados em estudo publicado.",
    source: "Poliwoda et al., Electrophoresis (2014)",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/24981810/",
  },
] as const;

export function CatalogExampleCards({ onNew, view }: { onNew: () => void; view: "grid" | "list" }) {
  const [selected, setSelected] = useState<(typeof examples)[number] | null>(null);
  const [detailTab, setDetailTab] = useState<"observation" | "species">("observation");
  const open = (entry: (typeof examples)[number]) => { setDetailTab("observation"); setSelected(entry); };
  return <section className="catalog-examples" aria-label="Exemplos visuais de cards do catálogo">
    <div className="catalog-examples-heading">
      <div><span className="eyebrow">PRÉVIA DO CATÁLOGO</span><h3>Assim podem ficar suas espécies</h3><p>Quatro cards ilustrativos. Não são espécies nem observações salvas no seu catálogo; a imagem de <em>Ipomoea violacea</em> é uma ilustração histórica.</p></div>
      <Button type="button" variant="outline" size="sm" onClick={onNew}><Plus size={15} /> Fazer minha observação</Button>
    </div>
    <div className={`cards ${view === "list" ? "list-view" : ""}`}>
      {examples.map(entry => {
        return <button type="button" className="organism-card panel" key={entry.name} onClick={() => open(entry)} aria-label={`Abrir identificação de exemplo: ${entry.name}`}>
          <div className="card-photo"><img src={entry.src} alt={`${entry.photoLabel.toLowerCase()} de ${entry.name}`} loading="lazy" /><span className="photo-label">{entry.photoLabel}</span></div>
          <div className="card-body"><small>{entry.family.toUpperCase()} · EXEMPLO</small><h3><em>{entry.name}</em></h3><p><Leaf size={13} /> {entry.commonName}</p><div className="card-meta"><span>{entry.group === "fungus" ? "FUNGO" : "PLANTA"} · Abrir identificação</span><ArrowUpRight size={15} /></div></div>
        </button>;
      })}
    </div>
    <p className="catalog-examples-credit">Imagens redimensionadas de Wikimedia Commons: {examples.map((entry, index) => <span key={entry.name}>{index > 0 && " · "}<a href={entry.filePage} target="_blank" rel="noreferrer">{entry.author} ({entry.license})</a></span>)}</p>
    {selected && <Modal title={selected.name} subtitle={`${selected.group === "fungus" ? "Fungo" : "Planta"} · ${selected.family} · identificação de demonstração`} onClose={() => setSelected(null)} wide>
      <p className="catalog-example-disclaimer">Esta é uma simulação de uma identificação concluída. A foto pertence à fonte citada; nenhum encontro, foto ou composto foi salvo no seu catálogo.</p>
      <div className="tabs catalog-example-tabs" role="group" aria-label="Detalhes da identificação de exemplo">
        <button type="button" className={detailTab === "observation" ? "active" : ""} aria-pressed={detailTab === "observation"} onClick={() => setDetailTab("observation")}>Identificação</button>
        <button type="button" className={detailTab === "species" ? "active" : ""} aria-pressed={detailTab === "species"} onClick={() => setDetailTab("species")}>Ficha da espécie</button>
      </div>
      {detailTab === "observation" ? <div className="observation-layout catalog-example-detail">
        <div><div className="detail-photo"><img src={selected.src} alt={`${selected.photoLabel.toLowerCase()} de ${selected.name}`} /></div><a className="text-button" href={selected.filePage} target="_blank" rel="noreferrer">Abrir imagem e licença <ArrowUpRight size={13} /></a></div>
        <div className="observation-info"><span className="pill">IDENTIFICAÇÃO DE EXEMPLO</span><h3><em>{selected.name}</em></h3><p>{selected.commonName}</p><dl><div><dt>Grupo</dt><dd>{selected.group === "fungus" ? "Fungo" : "Planta"}</dd></div><div><dt>Família</dt><dd>{selected.family}</dd></div><div><dt>Local e data</dt><dd>Não informados: imagem ilustrativa</dd></div><div><dt>Identificação</dt><dd>Prévia de confirmação manual</dd></div></dl><p className="notes">{selected.note}</p><Button type="button" variant="outline" size="sm" onClick={() => setDetailTab("species")}>Ver ficha da espécie <ArrowUpRight size={14} /></Button></div>
      </div> : <><div className="species-actions"><div><span className="pill">FICHA DA ESPÉCIE · EXEMPLO</span><p>{selected.commonName}</p></div></div><div className="species-text panel"><dl><div><dt>Nome científico</dt><dd><em>{selected.name}</em></dd></div><div><dt>Grupo / família</dt><dd>{selected.group === "fungus" ? "Fungo" : "Planta"} · {selected.family}</dd></div></dl><h4>Notas da identificação</h4><p className="notes">{selected.note}</p></div><div className="section-heading"><h2>Propriedades, compostos e evidências</h2></div><article className="evidence-card panel"><div className="actions"><span className="badge">PUBLICAÇÃO CIENTÍFICA</span></div><p>{selected.finding}</p><a className="text-button" href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.source} <ArrowUpRight size={13} /></a></article><p className="tip">O estudo não confirma a composição da imagem nem recomenda consumo.</p></>}
    </Modal>}
  </section>;
}
