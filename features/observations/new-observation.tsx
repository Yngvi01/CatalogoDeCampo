"use client";
import { useState, useEffect, useRef } from "react";
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
import { FieldLinks } from "@/features/projects/field-links";
import type { SamplingSite } from "@/lib/validation/field";
import type { Project, Campaign } from "@/lib/validation/schemas";
import type { Candidate } from "@/lib/validation/schemas";
import { uploadDirect } from "@/lib/http/upload";
import { PhotoGuide, photoOrgans } from "@/features/identification/photo-guide";
import { CandidateComparison } from "@/features/identification/candidate-comparison";
import { deleteDraft, putDraft, type OfflineDraft } from "@/lib/offline/drafts";
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
function localDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function NewObservation({
  onClose,
  onSaved,
  draft,
  onDraftSaved,
  projects = [], campaigns = [], samplingSites = [], projectId, campaignId,
}: {
  samplingSites?: SamplingSite[];
  projects?: Project[]; campaigns?: Campaign[]; projectId?: string; campaignId?: string;
  onClose: () => void;
  onSaved: (id: string, message?: string) => void | Promise<void>;
  draft?: OfflineDraft | null;
  onDraftSaved?: () => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [organs, setOrgans] = useState<string[]>(draft?.photos.map(photo => photo.organ) || []);
  const [result, setResult] = useState<{
    receipt: string;
    candidates: Candidate[];
    provider: string;
  } | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [group, setGroup] = useState<"plant" | "fungus">(draft?.data.group || "plant"),
    [photos, setPhotos] = useState<File[]>(draft?.photos.map(photo => new File([photo.blob], photo.name, { type: photo.type, lastModified: photo.lastModified })) || []),
    [previews, setPreviews] = useState<string[]>([]),
    [lat, setLat] = useState(draft?.data.latitude === null || draft?.data.latitude === undefined ? "" : String(draft.data.latitude)),
    [lon, setLon] = useState(draft?.data.longitude === null || draft?.data.longitude === undefined ? "" : String(draft.data.longitude)),
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
  const collectData = (form: HTMLFormElement): OfflineDraft["data"] => {
    const fields = new FormData(form);
    if (Boolean(lat) !== Boolean(lon)) throw new Error("Informe latitude e longitude juntas.");
    const observedAt = fields.get("observedAt")
      ? new Date(String(fields.get("observedAt"))).toISOString()
      : draft?.data.observedAt || new Date().toISOString();
    return {
      group, observedAt,
      samplingSiteId: String(fields.get("samplingSiteId") || "") || null,
      customValues: JSON.parse(String(fields.get("customValues") || "{}")),
      projectId: String(fields.get("projectId") || "") || null,
      campaignId: String(fields.get("campaignId") || "") || null,
      latitude: lat ? Number(lat) : null,
      longitude: lon ? Number(lon) : null,
      region: String(fields.get("region") || ""),
      habitat: String(fields.get("habitat") || ""),
      substrate: String(fields.get("substrate") || ""),
      vegetation: String(fields.get("vegetation") || ""),
      light: String(fields.get("light") || ""),
      notes: String(fields.get("notes") || ""),
      altitude: fields.get("altitude") ? Number(fields.get("altitude")) : null,
      morphology: Object.fromEntries(fungalFields.map(label => [label, String(fields.get(`m-${label}`) || "")]).filter(([, value]) => value)),
    };
  };
  const saveDraft = async () => {
    if (!formRef.current) return;
    setBusy(true); setError("");
    try {
      if (!photos.length || photos.length > 5 || photos.some(photo => !photo.size || photo.size > 20 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)))
        throw new Error("Escolha de 1 a 5 fotos JPEG, PNG ou WebP, com até 20 MB cada.");
      const now = new Date().toISOString();
      await putDraft({
        id: draft?.id || globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: draft?.createdAt || now, updatedAt: now,
        data: collectData(formRef.current),
        photos: photos.map((photo, index) => ({ blob: photo, name: photo.name, type: photo.type, lastModified: photo.lastModified, organ: group === "plant" ? organs[index] || "auto" : "auto" })),
      });
      await onDraftSaved?.();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
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
        <form ref={formRef}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!photos.length) {
              setError("Adicione pelo menos uma foto.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              const data = collectData(e.currentTarget);
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
              form.set("organs", JSON.stringify(photos.map((_, i) => group === "plant" ? organs[i] || "auto" : "auto")));
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
            {group === "plant" && <PhotoGuide />}
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
                  <div className="guided-photo" key={`${p.name}-${i}`}>
                    <img src={previews[i]} alt={p.name} />
                    <button
                      type="button"
                      aria-label={`Remover ${p.name}`}
                      onClick={() => {
                        setPhotos(photos.filter((_, n) => i !== n));
                        setOrgans(photos.map((_, n) => organs[n] || "auto").filter((_, n) => i !== n));
                      }}
                    >
                      <X size={14} />
                    </button>
                    {group === "plant" && <label>Foto {i + 1}: parte da planta<select aria-label={`Parte da planta na foto ${i + 1}`} value={organs[i] || "auto"} onChange={e => setOrgans(photos.map((_, n) => n === i ? e.target.value : organs[n] || "auto"))}>{photoOrgans.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
                  </div>
                ))}
              </div>
            )}
            <p className="tip">
              {group === "plant"
                ? "Dica de campo: fotografe a planta inteira, folhas, caule, flores, frutos e sementes."
                : "Dica de campo: fotografe píleo, parte inferior, estipe, base, substrato e mudanças de cor."}
            </p>
            <FieldLinks samplingSites={samplingSites} samplingSiteId={draft?.data.samplingSiteId} customValues={draft?.data.customValues} projects={projects} campaigns={campaigns} projectId={draft ? draft.data.projectId : projectId} campaignId={draft ? draft.data.campaignId : campaignId} />
            <div className="form-grid">
              <Field label="Local / região">
                <input
                  name="region"
                  placeholder="Ex.: Serra da Mantiqueira, MG"
                  defaultValue={draft?.data.region || ""}
                />
              </Field>
              <Field
                label="Data e hora"
                hint="Deixe vazio para registrar o momento atual."
              >
                <input name="observedAt" type="datetime-local" defaultValue={draft ? localDateTime(draft.data.observedAt) : ""} />
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
                      defaultValue={String(draft?.data[name as keyof OfflineDraft["data"]] ?? "")}
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
                      <input name={`m-${label}`} defaultValue={draft?.data.morphology[label] || ""} />
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
                defaultValue={draft?.data.notes || ""}
              />
            </Field>
            <ErrorText message={error} />
            <div className="modal-footer">
              <Button type="button" variant="outline" disabled={busy} onClick={() => void saveDraft()}>
                Guardar rascunho neste aparelho
              </Button>
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
          <CandidateComparison candidates={result.candidates} />
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
                  let draftNotice = "";
                  if (draft) {
                    try { await deleteDraft(draft.id); }
                    catch { draftNotice = " O rascunho local não pôde ser removido; descarte-o manualmente para evitar duplicação."; }
                  }
                  await onSaved(
                    saved.observation.id,
                    selected.length
                      ? `Observação salva com ${selected.length} foto(s) escolhida(s).${draftNotice}`
                      : `Observação salva sem fotos.${draftNotice}`,
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
