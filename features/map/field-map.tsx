"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Catalog, Species } from "@/lib/validation/schemas";
import { MapPin } from "lucide-react";
import { statuses, dateLabel } from "@/lib/utils";
export default function FieldMap({
  observations,
  species,
  onOpen,
}: {
  observations: Catalog["observations"];
  species: Species[];
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const open = useRef(onOpen);
  open.current = onOpen;
  const located = observations.filter(
    (o) => o.latitude !== null && o.longitude !== null,
  );
  useEffect(() => {
    if (!ref.current) return;
    setError("");
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
              maxzoom: 19,
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [-47.5, -15.5],
        zoom: 3,
      });
      map.addControl(new maplibregl.NavigationControl());
      map.on("error", () =>
        setError(
          "O mapa precisa de conexão à internet. Seus registros continuam disponíveis abaixo.",
        ),
      );
      const bounds = new maplibregl.LngLatBounds();
      for (const o of located) {
        const el = document.createElement("button");
        el.className = "map-marker";
        el.setAttribute("aria-label", `Abrir ${o.code}`);
        el.textContent = o.group === "plant" ? "✿" : "●";
        el.onclick = () => open.current(o.id);
        new maplibregl.Marker({ element: el })
          .setLngLat([o.longitude!, o.latitude!])
          .addTo(map);
        bounds.extend([o.longitude!, o.latitude!]);
      }
      if (located.length)
        map.fitBounds(bounds, { padding: 70, maxZoom: 13, duration: 0 });
    } catch {
      setError("O navegador não disponibilizou WebGL para renderizar o mapa.");
    }
    return () => map?.remove();
  }, [observations]);
  return (
    <>
      <div className="map-panel panel">
        <div ref={ref} className="field-map" />
        {!located.length && (
          <div className="map-empty">
            <MapPin size={22} />
            <strong>Um território a descobrir</strong>
            <span>
              Adicione coordenadas às suas observações para vê-las aqui.
            </span>
          </div>
        )}
      </div>
      {error && <p className="tip">{error}</p>}
      <p className="muted">
        {located.length} observações no mapa ·{" "}
        {observations.length - located.length} sem coordenadas
      </p>
      <div className="field-list">
        {observations.map((o) => (
          <button key={o.id} onClick={() => onOpen(o.id)}>
            {o.photos[0] && (
              <img src={`/api/images/${o.photos[0].id}`} alt="" />
            )}
            <div>
              <strong>
                {species.find((s) => s.id === o.speciesId)?.scientificName ||
                  o.code}
              </strong>
              <span>
                {o.region || "Local não informado"} · {dateLabel(o.observedAt)}
              </span>
            </div>
            <small>{statuses[o.status]}</small>
          </button>
        ))}
      </div>
    </>
  );
}
