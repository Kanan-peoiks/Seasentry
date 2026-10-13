"use client";

import { useState } from "react";
import type { Incident, SpillSource } from "@/lib/types";
import { useIncidentStore, type ManualIncidentInput } from "@/lib/incident-store";
import { useLanguage } from "@/lib/useLanguage";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";

const RISK_OPTIONS: Incident["risk"][] = ["LOW", "MEDIUM", "HIGH"];
const SPILL_SOURCE_OPTIONS: SpillSource[] = ["Pipeline leak", "Tanker discharge", "Offshore platform", "Port terminal", "Illegal dumping", "Unknown / natural seep"];

type Props = {
  lat: number;
  lng: number;
  onClose: () => void;
  onCreated: (incident: Incident) => void;
};

type Errors = Partial<Record<"title" | "location" | "area", string>>;

export default function ManualIncidentForm({ lat, lng, onClose, onCreated }: Props) {
  const { t } = useLanguage();
  const f = t.manualIncidentForm;
  const { createIncident } = useIncidentStore();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [risk, setRisk] = useState<Incident["risk"]>("MEDIUM");
  const [spillSource, setSpillSource] = useState<SpillSource>("Unknown / natural seep");
  const [estimatedCause, setEstimatedCause] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const next: Errors = {};
    if (!title.trim()) next.title = f.titleRequired;
    if (!location.trim()) next.location = f.locationRequired;
    if (!(Number(areaM2) > 0)) next.area = f.areaRequired;
    setErrors(next);
    if (Object.keys(next).length) return;
    setError(null);
    setSubmitting(true);

    const input: ManualIncidentInput = {
      title: title.trim(),
      location: location.trim(),
      lat,
      lng,
      areaM2: Number(areaM2),
      risk,
      spillSource,
      estimatedCause: estimatedCause.trim() || "Reported by duty operator — cause under investigation",
      notes: notes.trim() || undefined,
    };

    const result = await createIncident(input);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.incident);
  };

  const invalid = (key: keyof Errors) => ({ "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `mi-${key}-error` : undefined });

  return (
    <Dialog
      open
      variant="center"
      width={520}
      title={f.title}
      subtitle={f.coordinatesCaptured(lat.toFixed(4), lng.toFixed(4))}
      onClose={() => { if (!submitting) onClose(); }}
      footer={<>
        <Button onClick={onClose} disabled={submitting}>{f.cancel}</Button>
        <Button type="submit" form="manual-incident-form" variant="primary" busy={submitting}>{f.createIncident}</Button>
      </>}
    >
      <form id="manual-incident-form" onSubmit={handleSubmit} className="form-grid" noValidate>
        <label className="ui-field form-span">
          {f.incidentTitle}
          <input className="ui-input" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={f.titlePlaceholder} data-autofocus {...invalid("title")} />
          {errors.title && <span id="mi-title-error" className="ui-field-error">{errors.title}</span>}
        </label>
        <label className="ui-field">
          {f.locationName}
          <input className="ui-input" name="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={f.locationPlaceholder} {...invalid("location")} />
          {errors.location && <span id="mi-location-error" className="ui-field-error">{errors.location}</span>}
        </label>
        <label className="ui-field">
          {f.estimatedAreaM2}
          <input className="ui-input" name="area" type="number" inputMode="decimal" min={1} value={areaM2} onChange={(e) => setAreaM2(e.target.value)} placeholder={f.areaPlaceholder} {...invalid("area")} />
          {errors.area && <span id="mi-area-error" className="ui-field-error">{errors.area}</span>}
        </label>
        <label className="ui-field">
          {f.risk}
          <select className="ui-select" name="risk" value={risk} onChange={(e) => setRisk(e.target.value as Incident["risk"])}>
            {RISK_OPTIONS.map((r) => <option key={r} value={r}>{t.risk[r]}</option>)}
          </select>
        </label>
        <label className="ui-field">
          {f.suspectedSource}
          <select className="ui-select" name="source" value={spillSource} onChange={(e) => setSpillSource(e.target.value as SpillSource)}>
            {SPILL_SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{t.spillSource[s]}</option>)}
          </select>
        </label>
        <label className="ui-field form-span">
          {f.estimatedCauseOptional}
          <input className="ui-input" name="cause" value={estimatedCause} onChange={(e) => setEstimatedCause(e.target.value)} placeholder={f.causePlaceholder} />
        </label>
        <label className="ui-field form-span">
          {f.notesOptional}
          <textarea className="ui-textarea" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={f.notesPlaceholder} />
        </label>
        {error && <div className="form-span"><Notice tone="error">{error}</Notice></div>}
      </form>
    </Dialog>
  );
}
