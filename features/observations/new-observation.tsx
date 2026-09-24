"use client";
import { useState, useEffect } from "react";
import {
  Camera,
  ImagePlus,
  LocateFixed,
  Leaf,
  TreeDeciduous,
  X,
  Save,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, Field, ErrorText, api } from "@/components/shared";
const fungalFields = [
  "Píleo",
  "Cor",
  "Superfície",
  "Lamelas",
  "Poros",
  "Dentes",
  "Estipe",
  "Anel",
  "Volva",
  "Base",
  "Esporada",
  "Cheiro",
  "Textura",
  "Mudança de cor",
  "Plantas associadas",
];
export function NewObservation({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string, message?: string) => void;
}) {
  const [group, setGroup] = useState<"plant" | "fungus">("plant"),
    [photos, setPhotos] = useState<File[]>([]),
    [previews, setPreviews] = useState<string[]>([]),
    [lat, setLat] = useState(""),
    [lon, setLon] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [locating, setLocating] = useState(false);
  useEffect(() => {
    const urls = photos.map((p) => URL.createObjectURL(p));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [photos]);
  const add = (files: FileList | null) => {
    if (files) setPhotos((p) => [...p, ...Array.from(files)].slice(0, 12));
  };
  return (
    <Modal
      title="Nova observação"
      subtitle="Um encontro merece um registro. Só as fotos são obrigatórias."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!photos.length) {
            setError("Adicione pelo menos uma foto.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            const fields = new FormData(e.currentTarget);
            const data: Record<string, unknown> = {
              group,
              latitude: lat ? Number(lat) : null,
              longitude: lon ? Number(lon) : null,
            };
            for (const key of [
              "region",
              "habitat",
              "substrate",
              "vegetation",
              "light",
              "notes",
            ])
              data[key] = fields.get(key) || "";
            data.altitude = fields.get("altitude")
              ? Number(fields.get("altitude"))
              : null;
            if (fields.get("observedAt"))
              data.observedAt = new Date(
                String(fields.get("observedAt")),
              ).toISOString();
            data.morphology = Object.fromEntries(
              fungalFields
                .map((k) => [k, String(fields.get(`m-${k}`) || "")])
                .filter(([, v]) => v),
            );
            const form = new FormData();
            form.set("data", JSON.stringify(data));
            photos.forEach((p) => form.append("photos", p));
            const result = await api<{
              observation: { id: string };
              duplicates: string[];
            }>("observations", { method: "POST", body: form });
            onSaved(
              result.observation.id,
              result.duplicates.length
                ? "Observação salva. Há fotos iguais neste registro ou no catálogo."
                : undefined,
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="segmented">
          <button
            type="button"
            className={group === "plant" ? "active" : ""}
            onClick={() => setGroup("plant")}
          >
            <Leaf size={16} /> Planta
          </button>
          <button
            type="button"
            className={group === "fungus" ? "active" : ""}
            onClick={() => setGroup("fungus")}
          >
            <TreeDeciduous size={16} /> Fungo
          </button>
        </div>
        <div className="upload-area">
          <ImagePlus size={30} />
          <h3>O primeiro passo é observar.</h3>
          <p>JPEG, PNG, WebP, TIFF ou HEIF · até 12 fotos de 20 MB</p>
          <div className="actions">
            <label className="button button-primary">
              <Camera size={16} /> Abrir câmera
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => add(e.target.files)}
              />
            </label>
            <label className="button button-outline">
              Selecionar fotos
              <input
                className="sr-only"
                aria-label="Selecionar fotos"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => add(e.target.files)}
              />
            </label>
          </div>
        </div>
        {!!photos.length && (
          <div className="photo-previews">
            {photos.map((p, i) => (
              <div key={`${p.name}-${i}`}>
                <img src={previews[i]} alt={p.name} />
                <button
                  type="button"
                  aria-label={`Remover ${p.name}`}
                  onClick={() => setPhotos(photos.filter((_, n) => i !== n))}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="tip">
          {group === "plant"
            ? "Dica de campo: fotografe a planta inteira, folhas, caule, flores, frutos e sementes."
            : "Dica de campo: fotografe píleo, parte inferior, estipe, base, substrato e mudanças de cor."}
        </p>
        <div className="form-grid">
          <Field label="Local / região">
            <input name="region" placeholder="Ex.: Serra da Mantiqueira, MG" />
          </Field>
          <Field
            label="Data e hora"
            hint="Deixe vazio para registrar o momento atual."
          >
            <input name="observedAt" type="datetime-local" />
          </Field>
        </div>
        <details className="form-details">
          <summary>
            Localização e ambiente <span>opcional</span>
          </summary>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={locating}
            onClick={() => {
              setLocating(true);
              if (!navigator.geolocation) {
                setError("Localização não disponível neste navegador.");
                setLocating(false);
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  setLat(String(p.coords.latitude));
                  setLon(String(p.coords.longitude));
                  setLocating(false);
                },
                () => {
                  setError(
                    "Não foi possível obter a localização. Use HTTPS e permita o acesso, ou informe as coordenadas.",
                  );
                  setLocating(false);
                },
                { timeout: 12000 },
              );
            }}
          >
            <LocateFixed size={15} />
            {locating ? "Localizando…" : "Usar minha localização"}
          </Button>
          <div className="form-grid">
            <Field label="Latitude">
              <input
                type="number"
                min="-90"
                max="90"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                min="-180"
                max="180"
                step="any"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
              />
            </Field>
            {[
              ["habitat", "Habitat", "Mata ciliar, campo aberto…"],
              ["substrate", "Substrato", "Solo, madeira, rocha…"],
              ["vegetation", "Vegetação", "Floresta ombrófila…"],
              ["light", "Luminosidade", "Sombra, sol direto…"],
              ["altitude", "Altitude (m)", ""],
            ].map(([name, label, placeholder]) => (
              <Field key={name} label={label}>
                <input
                  name={name}
                  placeholder={placeholder}
                  type={name === "altitude" ? "number" : "text"}
                  step="any"
                />
              </Field>
            ))}
          </div>
        </details>
        {group === "fungus" && (
          <details className="form-details">
            <summary>
              Morfologia do fungo <span>opcional</span>
            </summary>
            <div className="form-grid">
              {fungalFields.map((label) => (
                <Field label={label} key={label}>
                  <input name={`m-${label}`} />
                </Field>
              ))}
            </div>
          </details>
        )}
        <Field label="Notas de campo">
          <textarea
            name="notes"
            rows={3}
            placeholder="O que chamou sua atenção?"
          />
        </Field>
        <ErrorText message={error} />
        <div className="modal-footer">
          <span className="muted">Identifique agora ou volte mais tarde.</span>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Save size={16} />
            )}{" "}
            {busy ? "Salvando…" : "Salvar observação"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
