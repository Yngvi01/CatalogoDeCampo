import photos from "./images.json";

export type LibraryClaim = {
  kind: "Composição" | "Uso tradicional" | "Uso alimentar" | "Ecologia" | "Segurança";
  title: string;
  description: string;
  part?: string;
  source: number;
};
export type LibraryEntry = {
  id: keyof typeof photos;
  commonName: string;
  scientificName: string;
  aliases?: string[];
  family: string;
  scope: "species" | "genus";
  photoSubject?: string;
  occurrence: string;
  recognition: string;
  note?: string;
  claims: LibraryClaim[];
  sources: { title: string; url: string }[];
};

export const libraryEntries: LibraryEntry[] = [
  {
    id: "erythrina-falcata", commonName: "Corticeira-da-serra", scientificName: "Erythrina falcata", family: "Fabaceae", scope: "species",
    occurrence: "Registrada na APA Rota do Sol, na Serra Geral do Rio Grande do Sul.",
    recognition: "Árvore de flores vermelhas vistosas, reunidas em inflorescências.",
    claims: [
      { kind: "Composição", title: "Alcaloides do grupo Erythrina", description: "Estudos químicos relatam sinais de alcaloides em extratos da espécie; a composição depende da parte e do preparo analisados.", part: "Extratos vegetais", source: 1 },
      { kind: "Uso tradicional", title: "Uso popular sedativo", description: "Há registro de uso popular como sedativo e ansiolítico. Isso não estabelece eficácia clínica nem segurança para automedicação.", source: 2 },
      { kind: "Segurança", title: "Cuidado com sementes e casca", description: "A literatura alerta para concentrações importantes de alcaloides nessas partes. Não ingerir a planta com base na identificação visual.", part: "Sementes e casca", source: 2 },
    ],
    sources: [
      { title: "DAER-RS · APA Rota do Sol", url: "https://www.daer.rs.gov.br/apa-rota-do-sol" },
      { title: "Estudo fitoquímico de E. falcata e E. crista-galli", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4556073/" },
      { title: "Caracterização farmacognóstica de E. falcata", url: "https://www.scielo.br/j/rbfar/a/wFZ67JShdpWtk6hmTjsFZWs/?format=html&lang=pt" },
    ],
  },
  {
    id: "mimosa-scabrella", commonName: "Bracatinga", scientificName: "Mimosa scabrella", family: "Fabaceae", scope: "species",
    occurrence: "A Embrapa registra ocorrência natural da bracatinga no Rio Grande do Sul.",
    recognition: "Árvore da família das leguminosas, comum em formações florestais do Sul.",
    claims: [
      { kind: "Ecologia", title: "Espécie florestal do Sul", description: "A Embrapa documenta sua distribuição e seus usos ambientais e florestais. Não há propriedade medicinal estabelecida nesta ficha.", source: 0 },
      { kind: "Composição", title: "Química depende da amostra", description: "Estudos caracterizam quimicamente materiais associados à bracatinga, mas resultados de pólen ou melato não descrevem automaticamente a composição da árvore inteira.", source: 1 },
    ],
    sources: [
      { title: "Embrapa · Ocorrência natural da bracatinga", url: "https://sistemasdeproducao.cnptia.embrapa.br/FontesHTML/Bracatinga/CultivodaBracatinga/04_ocorrencia_natural.htm" },
      { title: "Embrapa · Caracterização química de variedades de bracatinga", url: "https://www.alice.cnptia.embrapa.br/alice/handle/doc/306527" },
    ],
  },
  {
    id: "ipomoea-spp", commonName: "Corda-de-viola", scientificName: "Ipomoea spp.", family: "Convolvulaceae", scope: "genus", photoSubject: "Ipomoea purpurea",
    occurrence: "Levantamento botânico da UFRGS registra várias espécies de Ipomoea no Rio Grande do Sul.",
    recognition: "Grupo de trepadeiras e outras formas de crescimento com flores em forma de funil; a aparência varia entre espécies.",
    note: "Esta ficha trata do gênero. Uma foto não identifica automaticamente a espécie nem sua composição química.",
    claims: [
      { kind: "Composição", title: "Alcaloides em algumas espécies", description: "Pesquisas encontraram alcaloides ergolínicos em determinadas Ipomoea associadas a fungos simbiontes. Não é uma propriedade de toda corda-de-viola do RS.", source: 1 },
      { kind: "Segurança", title: "Não generalizar entre espécies", description: "A composição depende da espécie e, em certos casos, da presença do fungo. Esta ficha não orienta consumo ou uso da planta.", source: 1 },
    ],
    sources: [
      { title: "UFRGS · Espécies de Ipomoea no Rio Grande do Sul", url: "https://lume.ufrgs.br/bitstream/10183/26268/1/000698575.pdf" },
      { title: "Estudo sobre Ipomoea e fungos produtores de alcaloides", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2330284/" },
    ],
  },
  {
    id: "baccharis-trimera", commonName: "Carqueja", scientificName: "Baccharis trimera", family: "Asteraceae", scope: "species",
    occurrence: "Pesquisas com populações nativas documentam a carqueja no Rio Grande do Sul.",
    recognition: "Erva subarbustiva com ramos verdes alados, característica que merece comparação com outras carquejas.",
    claims: [
      { kind: "Uso tradicional", title: "Registro em formulário oficial", description: "O Formulário de Fitoterápicos da Farmacopeia Brasileira descreve o uso de partes aéreas secas como antidispéptico; a indicação é da preparação descrita no documento, não de qualquer exemplar encontrado.", part: "Partes aéreas secas", source: 1 },
      { kind: "Segurança", title: "Restrições da fonte", description: "O formulário contraindica o uso na gestação e lactação e alerta para possível hipotensão e interação com medicamentos para pressão e diabetes.", source: 1 },
    ],
    sources: [
      { title: "BINAGRI · Populações de B. trimera no RS", url: "https://binagri.agro.gov.br/cgi-bin/koha/opac-detail.pl?biblionumber=298565" },
      { title: "Farmacopeia Brasileira · Formulário de Fitoterápicos", url: "https://www.gov.br/saude/pt-br/acesso-a-informacao/acoes-e-programas/plantas-medicinais-e-fitoterapicos-2/arquivos/publicacoes/formulario-de-fitoterapicos-da-farmacopeia-brasileira-sem-marca/@@download/file" },
      { title: "Kew · Nome aceito e sinônimos", url: "https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:183819-1" },
    ],
  },
  {
    id: "achyrocline-satureioides", commonName: "Marcela / macela", scientificName: "Achyrocline satureioides", aliases: ["Achyrocline saturejoides"], family: "Asteraceae", scope: "species",
    occurrence: "Planta medicinal símbolo do Rio Grande do Sul; a cartilha estadual registra sua ocorrência e uso.",
    recognition: "Erva de ramos finos, folhas estreitas e inflorescências pequenas amareladas.",
    note: "A grafia satureioides é usada nas fontes brasileiras consultadas; Kew registra saturejoides. Confira a fonte taxonômica ao pesquisar pelo nome.",
    claims: [
      { kind: "Uso tradicional", title: "Inflorescências em preparações tradicionais", description: "A cartilha de plantas medicinais do RS registra usos digestivo, antiespasmódico e anti-inflamatório para preparações de inflorescências. Isso não autoriza o uso de plantas colhidas sem identificação segura.", part: "Inflorescências", source: 0 },
      { kind: "Composição", title: "Flavonoides e óleo essencial", description: "A cartilha relaciona essas classes entre os constituintes descritos para a marcela; teor e perfil variam conforme a amostra.", source: 0 },
      { kind: "Segurança", title: "Alergia", description: "A fonte recomenda suspender o uso caso ocorra reação alérgica.", source: 0 },
    ],
    sources: [
      { title: "Secretaria da Saúde RS · Cartilha de plantas medicinais", url: "https://atencaobasica.saude.rs.gov.br/upload/arquivos/202312/29090448-2-edicao-cartilha-da-pm-da-pipmf-rs-2023.pdf" },
      { title: "Kew · Nome Achyrocline saturejoides", url: "https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:174407-1" },
    ],
  },
  {
    id: "ilex-paraguariensis", commonName: "Erva-mate", scientificName: "Ilex paraguariensis", family: "Aquifoliaceae", scope: "species",
    occurrence: "Espécie nativa e cultivada no Rio Grande do Sul, com ervais nativos e cultivados.",
    recognition: "Árvore ou arbusto de folhas persistentes, coriáceas e de bordas levemente serrilhadas.",
    claims: [
      { kind: "Uso alimentar", title: "Chimarrão e outras bebidas", description: "Folhas e ramos processados integram o preparo tradicional da erva-mate. Trata-se de produto processado, não de folhas reconhecidas apenas por fotografia.", part: "Folhas e ramos processados", source: 0 },
      { kind: "Composição", title: "Cafeína e outras metilxantinas", description: "A cafeína é um dos compostos de interesse da erva-mate; os teores variam por amostra e processamento.", part: "Folhas", source: 2 },
      { kind: "Uso tradicional", title: "Monografia europeia", description: "A EMA publicou monografia sobre preparações de folhas de mate. O registro de uso tradicional não equivale a uma recomendação individual de tratamento.", part: "Folhas preparadas", source: 1 },
    ],
    sources: [
      { title: "Secretaria da Agricultura RS · Diagnóstico da erva-mate", url: "https://www.agricultura.rs.gov.br/upload/arquivos/202308/24171157-livro-erva-mate-ebook.pdf" },
      { title: "EMA · Mate folium", url: "https://www.ema.europa.eu/en/medicines/herbal/mate-folium" },
      { title: "CNCFlora/JBRJ · Ilex paraguariensis", url: "https://proflora.jbrj.gov.br/html/Ilex%20paraguariensis_2012.html" },
    ],
  },
  {
    id: "monteverdia-ilicifolia", commonName: "Espinheira-santa", scientificName: "Monteverdia ilicifolia", aliases: ["Maytenus ilicifolia"], family: "Celastraceae", scope: "species",
    occurrence: "A Anvisa documenta ocorrência predominante no Sul, incluindo o Rio Grande do Sul.",
    recognition: "Arbusto ou pequena árvore de folhas com margens espinhosas; há espécies parecidas que exigem revisão botânica.",
    note: "A Anvisa usa Monteverdia ilicifolia; Kew trata Maytenus ilicifolia como nome aceito e Monteverdia ilicifolia como sinônimo. A ficha reúne as duas grafias.",
    claims: [
      { kind: "Uso tradicional", title: "Uso digestivo documentado", description: "A Anvisa avalia preparações das folhas para queixas digestivas. A informação se refere a material e preparações definidos na monografia, não à ingestão de qualquer planta identificada por foto.", part: "Folhas", source: 0 },
      { kind: "Composição", title: "Constituintes estudados", description: "Relatório da Anvisa reúne estudos fitoquímicos da espécie, incluindo triterpenos e compostos fenólicos; a composição varia com o material.", part: "Folhas", source: 0 },
      { kind: "Segurança", title: "Confusão de espécies", description: "Plantas chamadas popularmente de espinheira-santa podem pertencer a espécies diferentes. Uma sugestão visual não comprova segurança de uso.", source: 0 },
    ],
    sources: [
      { title: "Anvisa · Relatório de avaliação da espinheira-santa", url: "https://www.gov.br/anvisa/pt-br/setorregulado/regularizacao/medicamentos/fitoterapicos-dinamizados-e-especificos/registro-simplificado-de-fitoterapicos/relatorios-de-avaliacao/relatorio_monteverdia_ilicifolia.pdf" },
      { title: "Kew · Maytenus ilicifolia e sinonímia", url: "https://powo.science.kew.org/taxon/161937-1" },
    ],
  },
  {
    id: "aloysia-gratissima", commonName: "Erva-cidreira-do-campo", scientificName: "Aloysia gratissima", family: "Verbenaceae", scope: "species",
    occurrence: "Incluída em publicações da política de plantas medicinais do Rio Grande do Sul.",
    recognition: "Arbusto aromático de folhas estreitas e pequenas flores claras em inflorescências.",
    claims: [
      { kind: "Uso tradicional", title: "Registro na política estadual", description: "O memento de chás medicinais do RS documenta usos tradicionais para a espécie; a indicação depende da preparação e das precauções descritas na fonte.", source: 0 },
      { kind: "Composição", title: "Óleo essencial variável", description: "Estudos analisam os componentes do óleo essencial; o perfil depende do material e das condições de cultivo.", part: "Partes aromáticas", source: 1 },
    ],
    sources: [
      { title: "Secretaria da Saúde RS · Memento de chás medicinais", url: "https://atencaoprimaria.rs.gov.br/upload/arquivos/202312/29090916-memento-de-chas-medicinais-da-pipmf-2023.pdf" },
      { title: "BINAGRI · Análise do óleo essencial de A. gratissima", url: "https://binagri.agro.gov.br/cgi-bin/koha/opac-detail.pl?biblionumber=301135" },
    ],
  },
  {
    id: "passiflora-spp", commonName: "Maracujás-do-mato", scientificName: "Passiflora spp.", family: "Passifloraceae", scope: "genus", photoSubject: "Passiflora alata",
    occurrence: "Há espécies de Passiflora registradas no RS; estudos analisaram P. alata coletada em Canoas e Montenegro.",
    recognition: "Trepadeiras com gavinhas e flores características; detalhes de folhas, flores e frutos diferem entre espécies.",
    note: "A foto mostra P. alata como exemplo. A composição de P. alata não deve ser atribuída a toda Passiflora.",
    claims: [
      { kind: "Composição", title: "Flavonoides em P. alata", description: "Estudos com folhas de P. alata coletadas no RS relatam flavonoides. O resultado não demonstra teor igual nas demais espécies.", part: "Folhas de P. alata", source: 0 },
      { kind: "Composição", title: "β-carbolinas em espécies estudadas", description: "Pesquisas relatam alcaloides β-carbolínicos em algumas Passiflora; esta ficha não afirma sua presença em cada maracujá-do-mato do RS.", source: 1 },
    ],
    sources: [
      { title: "Estudo de P. alata coletada em Canoas, RS", url: "https://www.sciencedirect.com/science/article/abs/pii/S0378874109005972" },
      { title: "Revisão científica sobre produtos de Passiflora", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7387951/" },
    ],
  },
  {
    id: "solanum-mauritianum", commonName: "Fumo-bravo", scientificName: "Solanum mauritianum", family: "Solanaceae", scope: "species",
    occurrence: "Documentado em levantamento ambiental de rodovias do Rio Grande do Sul.",
    recognition: "Arbusto ou pequena árvore de folhas grandes e aspecto aveludado, frequente em áreas alteradas.",
    claims: [
      { kind: "Composição", title: "Metabólitos do fruto", description: "Estudo metabolômico de cascas de frutos relata sinais compatíveis com alcaloides esteroidais e outros metabólitos; os perfis diferem entre frutos verdes e maduros.", part: "Cascas de frutos", source: 1 },
      { kind: "Segurança", title: "Interesse toxicológico", description: "A presença de alcaloides torna inadequado inferir segurança ou uso a partir da aparência. Não consumir frutos ou outras partes encontrados em campo.", source: 1 },
    ],
    sources: [
      { title: "Empresa Gaúcha de Rodovias · Levantamento ambiental", url: "https://egr.rs.gov.br/upload/arquivos/202207/13165851-20150703171903peteba-volume-1.pdf" },
      { title: "Estudo metabolômico dos frutos de S. mauritianum", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13195779/" },
      { title: "Kew · Solanum mauritianum", url: "https://powo.science.kew.org/taxon/330666-2" },
    ],
  },
];
export const libraryPhotos = photos;
export function findLibraryEntry(scientificName: string): LibraryEntry | undefined {
  const name = scientificName.trim().replace(/\s+/g, " ").toLowerCase();
  return libraryEntries.find(entry => [entry.scientificName, ...(entry.aliases || [])].some(alias => alias.toLowerCase() === name))
    || libraryEntries.find(entry => entry.scope === "genus" && name.startsWith(entry.scientificName.split(" ")[0].toLowerCase() + " "));
}
