import { Leaf, Flower2, TreeDeciduous, Focus } from "lucide-react";
export const photoOrgans = [
  ["auto", "Automático / planta inteira"], ["leaf", "Folha"],
  ["flower", "Flor"], ["fruit", "Fruto"], ["bark", "Casca / tronco"],
] as const;
export function PhotoGuide() {
  return <section className="photo-guide" aria-label="Como fotografar para identificar">
    <h3>Mais detalhes, uma comparação melhor</h3>
    <p>Use fotos da mesma planta. Confira o foco e evite outras plantas na frente do detalhe.</p>
    <div className="photo-guide-grid">
      <div><TreeDeciduous size={24} /><strong>Planta inteira</strong><span>Mostre o porte e como ela cresce no ambiente.</span></div>
      <div><Leaf size={24} /><strong>Folha</strong><span>Aproxime para mostrar forma, borda e nervuras.</span></div>
      <div><Flower2 size={24} /><strong>Flor ou fruto</strong><span>Se houver, registre de perto em outra foto.</span></div>
      <div><Focus size={24} /><strong>Casca / tronco</strong><span>Mostre a superfície com boa luz e nitidez.</span></div>
    </div>
    <a href="https://docs.plantnet.org/en/cookbook/making-a-good-observation/" target="_blank" rel="noreferrer">Orientações de fotografia do Pl@ntNet ↗</a>
  </section>;
}
