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
import { Modal, Field, ErrorText, api, send } from "@/components/shared";
import {
  identificationPhoto,
  photoHash,
} from "@/lib/http/identification-photo";
import type { Candidate } from "@/lib/validation/schemas";
import { uploadDirect } from "@/lib/http/upload";
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
  const [result, setResult] = useState<{
    receipt: string;
    candidates: Candidate[];
    provider: string;
  } | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);
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
    if (files) setPhotos((p) => [...p, ...Array.from(files)].slice(0, 5));
  };
  return (
    <Modal
      title="Nova observação"
      subtitle="Identifique primeiro. Depois escolha quais fotos guardar."
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      {!result ? (
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
              if (photos.some((p) => !p.size || p.size > 20 * 1024 * 1024))
                throw new Error("Cada foto deve ter até 20 MB.");
              const manual =
                (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                  "value",
                ) === "manual";
              const form = new FormData();
              form.set("data", JSON.stringify(data));
              form.set(
                "hashes",
                JSON.stringify(await Promise.all(photos.map(photoHash))),
              );
              form.set("manual", String(manual));
              if (!manual)
                for (const photo of photos)
                  form.append(
                    "photos",
                    await identificationPhoto(photo),
                    "identification.jpg",
                  );
              const preview = await api<{
                receipt: string;
                candidates: Candidate[];
                provider: string;
              }>("identification/preview", { method: "POST", body: form });
              setResult(preview);
              setSelectedPhotos([]);
              setFailed(false);
            } catch (e) {
              setError((e as Error).message);
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
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
              <p>JPEG, PNG ou WebP · até 5 fotos de 20 MB</p>
              <div className="actions">
                <label className="button button-primary">
                  <Camera size={16} /> Abrir câmera
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
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
                    accept="image/jpeg,image/png,image/webp"
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
                      onClick={() =>
                        setPhotos(photos.filter((_, n) => i !== n))
                      }
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
                <input
                  name="region"
                  placeholder="Ex.: Serra da Mantiqueira, MG"
                />
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
              <span className="muted">
                As fotos não são salvas nesta etapa.
              </span>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Save size={16} />
                )}{" "}
                {busy ? "Identificando…" : "Identificar fotos"}
              </Button>
            </div>
            {failed && (
              <Button
                type="submit"
                variant="outline"
                value="manual"
                disabled={busy}
              >
                Continuar com identificação manual
              </Button>
            )}
            <p className="tip">
              {group === "plant"
                ? "Cópias reduzidas, sem EXIF, são enviadas ao Pl@ntNet para análise. Os originais permanecem no navegador até você escolher salvar."
                : "A busca de fungos usa contexto e registros próximos; não realiza identificação visual."}
            </p>
          </fieldset>
        </form>
      ) : (
        <section aria-label="Resultado e seleção de fotos">
          <h2>
            {result.provider === "manual"
              ? "Identificação manual"
              : "Resultado da identificação"}
          </h2>
          <div className="candidate-list">
            {result.candidates.map((candidate, index) => (
              <div
                className="candidate"
                key={`${candidate.scientificName}-${index}`}
              >
                <span className="candidate-number">{index + 1}</span>
                <div>
                  <h3>
                    <em>{candidate.scientificName}</em>
                  </h3>
                  <p>{candidate.commonNames.join(", ") || candidate.family}</p>
                  <small>
                    {candidate.score === null
                      ? "Candidato contextual, sem análise visual"
                      : `Similaridade visual: ${(candidate.score * 100).toFixed(1)}%`}
                  </small>
                </div>
              </div>
            ))}
          </div>
          {!result.candidates.length && (
            <p>
              {result.provider === "manual"
                ? "Você poderá informar o nome da espécie na observação."
                : "Nenhum candidato encontrado. Você pode registrar a observação e identificar manualmente."}
            </p>
          )}
          <p className="tip">
            As sugestões não confirmam a espécie. Nenhuma observação ou foto foi
            salva ainda.
          </p>
          <h3>Quais fotos deseja guardar?</h3>
          <p>
            Marque apenas as imagens que deseja salvar no catálogo. Você também
            pode continuar sem fotos.
          </p>
          <div className="photo-previews">
            {photos.map((file, index) => (
              <label key={index} className="photo-choice">
                <img
                  src={previews[index]}
                  alt={`Foto ${index + 1}: ${file.name}`}
                />
                <span>
                  <input
                    type="checkbox"
                    aria-label={`Guardar foto ${index + 1}`}
                    checked={selectedPhotos.includes(index)}
                    disabled={busy || finished}
                    onChange={(e) =>
                      setSelectedPhotos((current) =>
                        e.target.checked
                          ? [...current, index]
                          : current.filter((i) => i !== index),
                      )
                    }
                  />{" "}
                  Guardar foto {index + 1}
                </span>
              </label>
            ))}
          </div>
          <ErrorText message={error} />
          <div className="modal-footer">
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Descartar consulta
            </Button>
            <Button
              disabled={busy || finished}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const config = await api<{ direct: boolean }>("storage");
                  const selected = photos.filter((_, index) =>
                    selectedPhotos.includes(index),
                  );
                  let options: RequestInit;
                  if (config.direct) {
                    const uploads: string[] = [];
                    for (const file of selected)
                      uploads.push(await uploadDirect(file, "photo"));
                    options = send({ receipt: result.receipt, uploads });
                  } else {
                    const form = new FormData();
                    form.set("receipt", result.receipt);
                    selected.forEach((file) => form.append("photos", file));
                    options = { method: "POST", body: form };
                  }
                  const saved = await api<{ observation: { id: string } }>(
                    "identification/save",
                    options,
                  );
                  setFinished(true);
                  onSaved(
                    saved.observation.id,
                    selected.length
                      ? `Observação salva com ${selected.length} foto(s) escolhida(s).`
                      : "Observação salva sem fotos.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? "Salvando…"
                : selectedPhotos.length
                  ? `Salvar com ${selectedPhotos.length} foto(s)`
                  : "Salvar observação sem fotos"}
            </Button>
          </div>
        </section>
      )}
    </Modal>
  );
}
