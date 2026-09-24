"use client";

import { useEffect, useState } from "react";
import { Leaf, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NaturePhoto, NaturePhotosResponse } from "./types";

export function NatureCard() {
  const [photos, setPhotos] = useState<NaturePhoto[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/nature-photos", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Fotos indisponíveis.");
        const data: NaturePhotosResponse = await response.json();
        if (controller.signal.aborted) return;
        setPhotos(data.photos || []);
        setIndex(Math.floor(Math.random() * (data.photos?.length || 1)));
        setFailed(false);
      }).catch(() => {}).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  const photo = photos[index];
  return (
    <section className="nature-card panel" aria-label="Janela para a natureza">
      <div className="nature-heading">
        <div><span className="eyebrow"><Leaf size={14} /> UM INSTANTE LÁ FORA</span><h2>Janela para a natureza</h2></div>
        <Button variant="outline" size="sm" disabled={loading || photos.length < 2} onClick={() => {
          setFailed(false);
          setIndex(current => (current + 1 + Math.floor(Math.random() * (photos.length - 1))) % photos.length);
        }}><Shuffle size={15} /> Ver outra paisagem</Button>
      </div>
      {photo ? (
        <figure>
          <div className="nature-image">
            {!failed ? <img key={photo.id} src={photo.image} alt={photo.alt} width={1200} height={627} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <p role="status">Esta foto não carregou. Experimente outra paisagem.</p>}
          </div>
          <figcaption>Foto de <a href={photo.url} target="_blank" rel="noreferrer">{photo.photographer}</a> · <a href="https://www.pexels.com" target="_blank" rel="noreferrer">Fotos fornecidas pelo Pexels ↗</a></figcaption>
        </figure>
      ) : <div className="nature-empty" role="status">{loading ? "Abrindo uma janela para a natureza…" : <>As paisagens estão indisponíveis no momento. <button className="text-button" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></>}</div>}
    </section>
  );
}
