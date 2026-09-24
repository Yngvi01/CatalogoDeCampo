"use client";
import { useState } from "react";
import type { Candidate } from "@/lib/validation/schemas";
export function CandidateComparison({ candidates }: { candidates: Candidate[] }) {
  const [selected, setSelected] = useState<number[]>(() => candidates.slice(0, 3).map((_, i) => i));
  if (!candidates.length) return null;
  return <section className="candidate-comparison" aria-label="Comparar espécies sugeridas">
    <h3>Compare antes de decidir</h3>
    <p>A pontuação é do modelo, não uma probabilidade de acerto nem confirmação da espécie. Escolha até três sugestões para comparar.</p>
    <div className="comparison-options">{candidates.map((c, i) => <label key={`${c.scientificName}-${i}`}><input type="checkbox" checked={selected.includes(i)} disabled={!selected.includes(i) && selected.length >= 3} onChange={e => setSelected(current => e.target.checked ? [...current, i] : current.filter(n => n !== i))} />{c.scientificName}</label>)}</div>
    <div className="comparison-grid">{candidates.map((c, i) => selected.includes(i) && <article className="panel comparison-species" key={`${c.scientificName}-${i}`}>
      <span className="badge">Sugestão {i + 1}</span><h4><em>{c.scientificName}</em></h4>
      <dl><dt>Nomes populares</dt><dd>{c.commonNames.join(", ") || "Não informados"}</dd><dt>Família · gênero</dt><dd>{c.family || "Não informado"} · {c.genus || "Não informado"}</dd><dt>Pontuação do modelo</dt><dd>{c.score === null ? "Busca contextual, sem análise visual" : `${(c.score * 100).toFixed(1)}%`}</dd></dl>
      {c.referenceImages.length ? c.referenceImages.slice(0, 2).map((img, n) => <figure key={n}><a href={img.url} target="_blank" rel="noreferrer"><img src={img.url} alt={`Referência ${n + 1} de ${c.scientificName}`} loading="lazy" /></a><figcaption>{img.author || "Autor não informado"} · {img.license || "Licença não informada"}</figcaption></figure>) : <p className="muted">O provedor não enviou fotos de referência.</p>}
    </article>)}</div>
    <details className="form-details"><summary>O que observar na comparação?</summary><p>{candidates.some(c => c.score !== null) ? "Compare a forma e a borda das folhas, suas nervuras, as flores ou frutos presentes e a superfície do caule. Fotos semelhantes ajudam na revisão, mas não comprovam a espécie." : "Estes candidatos vieram de contexto e registros, sem reconhecimento visual. Confira o ambiente, o substrato e a morfologia registrada antes de considerar uma identificação."}</p><p>Não há descrição diagnóstica específica fornecida para estes candidatos. Se os detalhes não coincidirem, mantenha a identificação em aberto.</p></details>
  </section>;
}
