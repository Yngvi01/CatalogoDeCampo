import type { Catalog, Compound, EffectClaim, Evidence, Species } from "@/lib/validation/schemas";

const date = "2026-09-24T00:00:00.000Z";
const species = (id: string, scientificName: string, group: Species["group"], family: string, notes = ""): Species => ({
  id: `example-${id}`, scientificName, acceptedName: "", commonNames: [], synonyms: [], group,
  genus: scientificName.split(" ")[0], family, taxonomy: {}, description: "", diagnostics: "",
  distribution: "", habitat: "", toxicity: "", traditionalUses: "", notes, createdAt: date,
});
const compound = (id: string, name: string, chemicalClass: string, effectClaims: EffectClaim[] = []): Compound => ({
  id: `example-${id}`, name, synonyms: [], chemicalClass, formula: "", description: "", mechanisms: "",
  targets: "", effects: "", effectClaims, toxicology: "", createdAt: date,
});
const effect = (id: string, kind: EffectClaim["kind"], type: EffectClaim["type"], claim: string, source: string, url: string): EffectClaim => ({
  id: `example-${id}`, kind, context: "isolated_compound", type, claim, source, url, createdAt: date,
});
const occurrence = (id: string, speciesId: string, compoundId: string, claim: string, part: string, source: string, url: string, notes = ""): Evidence => ({
  id: `example-${id}`, speciesId: `example-${speciesId}`, compoundId: `example-${compoundId}`,
  property: "composição química", claim, type: "publication", origin: "publication", source, url,
  part, concentration: "", unit: "", range: "", method: "", sampleOrigin: "", notes, createdAt: date,
});

/** Read-only literature examples. They are never written to the user's catalog or backup. */
export const curatedExamples: Pick<Catalog, "species" | "compounds" | "evidence"> = {
  species: [
    species("ipomoea-violacea", "Ipomoea violacea", "plant", "Convolvulaceae",
      "Nome historicamente aplicado por engano a I. tricolor. A fonte taxonômica não atribui propriedades alucinógenas à verdadeira I. violacea; não extrapolar dados de I. tricolor."),
    species("casearia-sylvestris", "Casearia sylvestris", "plant", "Salicaceae",
      "Cafezeiro-do-mato segundo a Embrapa; o nome popular pode variar por região."),
    species("mimosa-scabrella", "Mimosa scabrella", "plant", "Fabaceae",
      "O artigo de 1990 relata alcaloides na casca analisada, e outro estudo isolou galactomanana das sementes. Isso não determina o teor de uma árvore observada em campo."),
    species("amanita-muscaria", "Amanita muscaria", "fungus", "Amanitaceae",
      "Fungo tóxico. Estudos com muscimol isolado não demonstram segurança nem efeito equivalente ao consumir o cogumelo."),
  ],
  compounds: [
    compound("casearin-x", "casearin X", "Diterpeno clerodano", [effect("casearin-x-cytotoxicity", "other", "in_vitro",
      "Casearin X isolada apresentou citotoxicidade em linhagens celulares humanas em laboratório; não é evidência de tratamento clínico.",
      "Santos et al., Chemistry & Biodiversity (2010)", "https://pubmed.ncbi.nlm.nih.gov/20087991/")]),
    compound("galactomannan", "galactomanana", "Polissacarídeo"),
    compound("dmt", "N,N-dimetiltriptamina (DMT)", "Triptamina", [effect("dmt-psychedelic", "psychedelic", "human",
      "Um estudo controlado observou efeitos psicodélicos com DMT isolada administrada por via intravenosa em participantes humanos; não estudou a casca de bracatinga nem seu consumo.",
      "Estudo clínico com DMT isolada (2023)", "https://pubmed.ncbi.nlm.nih.gov/37221177/")]),
    compound("muscimol", "muscimol", "Isoxazol", [effect("muscimol-sedation", "sedative", "animal",
      "Muscimol administrado diretamente a uma região cerebral produziu sedação em ratos; isso não descreve o efeito da ingestão de Amanita muscaria.",
      "Nelson et al., Nature Neuroscience (2002)", "https://pubmed.ncbi.nlm.nih.gov/12195434/")]),
  ],
  evidence: [
    occurrence("casearin-x-leaves", "casearia-sylvestris", "casearin-x",
      "Casearin X foi isolada de extrato etanólico das folhas de Casearia sylvestris.", "Folhas",
      "Santos et al., Chemistry & Biodiversity (2010)", "https://pubmed.ncbi.nlm.nih.gov/20087991/"),
    occurrence("galactomannan-seeds", "mimosa-scabrella", "galactomannan",
      "O estudo isolou galactomanana das sementes de Mimosa scabrella; não relatou efeito neuroativo.", "Sementes",
      "Ganter et al., International Journal of Biological Macromolecules (1997)", "https://pubmed.ncbi.nlm.nih.gov/9283028/"),
    occurrence("dmt-bark", "mimosa-scabrella", "dmt",
      "Moraes e colaboradores identificaram N,N-dimetiltriptamina em extrato alcoólico da casca de Mimosa scabrella.", "Casca",
      "Moraes et al., Química Nova (1990)", "https://quimicanova.sbq.org.br/Content/pdf/Vol13No4_308_v13_n4_(21).pdf",
      "Relato fitoquímico de material estudado; não quantifica uma amostra encontrada em campo."),
    occurrence("muscimol-fruiting-body", "amanita-muscaria", "muscimol",
      "O estudo identificou muscimol e ácido ibotênico em exemplares de Amanita muscaria analisados.", "Corpo de frutificação",
      "Poliwoda et al., Electrophoresis (2014)", "https://pubmed.ncbi.nlm.nih.gov/24981810/"),
  ],
};

export const ipomoeaTaxonomySource = {
  title: "Alencar et al., Rodriguésia (2021) · identidade de Ipomoea violacea",
  url: "https://www.scielo.br/j/rod/a/P3JDNQfSRMtnwpgDMH3MHBr/?lang=en",
};
