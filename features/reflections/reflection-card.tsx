"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Quote, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localReflections, type ReflectionsResponse } from "./quotes";

export function ReflectionCard() {
  const [data, setData] = useState<ReflectionsResponse>({
    quotes: localReflections,
    source: "campo",
  });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // A seleção inicial acontece no cliente para manter a hidratação estável.
    setIndex(Math.floor(Math.random() * localReflections.length));
    fetch("/api/reflections", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result: ReflectionsResponse = await response.json();
        if (!result.quotes?.length || controller.signal.aborted) return;
        setData(result);
        setIndex(Math.floor(Math.random() * result.quotes.length));
      })
      .catch(() => {
        /* As reflexões locais continuam disponíveis. */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (paused || !visible || data.quotes.length < 2) return;
    const timer = window.setTimeout(() => {
      setIndex(
        (current) =>
          (current + 1 + Math.floor(Math.random() * (data.quotes.length - 1))) %
          data.quotes.length,
      );
    }, 60_000);
    return () => window.clearTimeout(timer);
  }, [paused, visible, index, data.quotes.length, revision]);

  const quote = data.quotes[index];
  return (
    <section
      className="reflection-card panel"
      aria-label="Uma pausa para pensar"
      aria-roledescription="carrossel"
    >
      <div className="reflection-heading">
        <div>
          <Quote size={15} aria-hidden="true" />
          <h2>Uma pausa para pensar</h2>
        </div>
        <div className="reflection-controls">
          <span>{paused ? "No seu tempo" : "Uma reflexão a cada minuto"}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={paused ? "Retomar frases" : "Pausar frases"}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Próxima frase"
            disabled={data.quotes.length < 2}
            onClick={() => {
              setIndex(
                (current) =>
                  (current +
                    1 +
                    Math.floor(Math.random() * (data.quotes.length - 1))) %
                  data.quotes.length,
              );
              setRevision((r) => r + 1);
            }}
          >
            <SkipForward size={15} />
          </Button>
        </div>
      </div>
      <div
        className="reflection-content"
        aria-live={paused ? "polite" : "off"}
        aria-atomic="true"
      >
        <figure key={`${data.source}-${index}`} className="reflection-quote">
          <blockquote lang="en">“{quote.text}”</blockquote>
          <figcaption lang="en">— {quote.author}</figcaption>
        </figure>
      </div>
      <div className="reflection-source">
        {data.source === "zenquotes" ? (
          <a
            href="https://zenquotes.io/"
            target="_blank"
            rel="noreferrer"
            lang="en"
          >
            Inspirational quotes provided by ZenQuotes API ↗
          </a>
        ) : (
          <span>Reflexão original do Campo</span>
        )}
      </div>
    </section>
  );
}
