import {
  ArrowRight,
  BookOpen,
  Camera,
  FlaskConical,
  Leaf,
  NotebookPen,
} from "lucide-react";

type HomePanelProps = {
  counts: {
    observations: number;
    species: number;
    notes: number;
    discoveries: number;
  };
  onNavigate: (area: "identify" | "catalog" | "research" | "notebook") => void;
};

const destinations = [
  {
    id: "identify",
    title: "Identificação",
    description: "Fotografe um organismo e compare possibilidades com calma.",
    detail: "CÂMERA · FOTOS · REVISÃO",
    icon: Camera,
    className: "home-card-identify",
  },
  {
    id: "catalog",
    title: "Catálogo",
    description: "Explore plantas, fungos, observações e fichas do seu acervo.",
    detail: "PLANTAS · FUNGOS · REGISTROS",
    icon: Leaf,
    className: "home-card-catalog",
  },
  {
    id: "research",
    title: "Laboratório",
    description: "Investigue compostos, atividades biológicas e publicações.",
    detail: "COMPOSTOS · EVIDÊNCIAS · ESTUDOS",
    icon: FlaskConical,
    className: "home-card-research",
  },
  {
    id: "notebook",
    title: "Caderno de campo",
    description: "Guarde observações, ideias e anotações para consultar depois.",
    detail: "PÁGINAS · ETIQUETAS · LEITURAS",
    icon: NotebookPen,
    className: "home-card-notebook",
  },
] as const;

export function HomePanel({ counts, onNavigate }: HomePanelProps) {
  return (
    <section className="home-panel" aria-label="Áreas do Campo Catálogo">
      <div className="home-welcome panel">
        <div>
          <span className="eyebrow">OBSERVE · REGISTRE · DESCUBRA</span>
          <h2>Um espaço para conhecer o que vive ao seu redor.</h2>
          <p>Escolha por onde continuar sua exploração de campo.</p>
        </div>
        <div className="home-welcome-mark" aria-hidden="true"><Leaf size={30} /></div>
      </div>

      <div className="home-destinations">
        {destinations.map((destination) => {
          const Icon = destination.icon;
          return (
            <button
              key={destination.id}
              type="button"
              className={`home-card panel ${destination.className}`}
              onClick={() => onNavigate(destination.id)}
              aria-label={`Abrir ${destination.title}`}
            >
              <span className="home-card-icon"><Icon size={25} strokeWidth={1.7} /></span>
              <span className="home-card-detail">{destination.detail}</span>
              <strong>{destination.title}</strong>
              <span className="home-card-description">{destination.description}</span>
              <span className="home-card-link">Explorar <ArrowRight size={15} /></span>
            </button>
          );
        })}
      </div>

      <div className="home-summary panel" aria-label="Resumo do seu espaço">
        <div><span>Encontros registrados</span><strong>{counts.observations}</strong></div>
        <div><span>Espécies catalogadas</span><strong>{counts.species}</strong></div>
        <div><span>Páginas no caderno</span><strong>{counts.notes}</strong></div>
        <div><span>Descobertas científicas</span><strong>{counts.discoveries}</strong></div>
        <BookOpen className="home-summary-mark" size={19} aria-hidden="true" />
      </div>
    </section>
  );
}
