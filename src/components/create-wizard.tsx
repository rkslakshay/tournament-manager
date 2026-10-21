"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { apiFetch, ApiError } from "@/lib/api-client";
import { FORMAT_LABELS, FORMATS, type Format } from "@/lib/tournament-config";
import {
  adminUrl,
  buildCreateRequest,
  defaultWalkoverScore,
  DEFAULT_WIZARD_FORM,
  usesLeagueRules,
  type WizardForm,
} from "@/lib/wizard";

const STEPS = ["Basics", "Format & rules", "Review"] as const;
const SPORTS = [
  "Football",
  "Basketball",
  "Volleyball",
  "Tennis",
  "Table tennis",
  "Chess",
  "Esports",
  "Cricket",
];

const FORMAT_HELP: Record<Format, string> = {
  ROUND_ROBIN: "Everyone plays everyone. Best for leagues; standings decide the winner.",
  SINGLE_ELIM: "Lose once and you are out. Fast, with byes for top seeds.",
  DOUBLE_ELIM: "Teams are out after two losses, with a losers bracket and grand final.",
  GROUP_KNOCKOUT: "Round-robin groups first, then the best teams play a knockout.",
};

export function CreateWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(DEFAULT_WIZARD_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ slug: string; url: string } | null>(null);

  const update = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const request = buildCreateRequest(form);

  function next(event: FormEvent) {
    event.preventDefault();
    const stepErrors = request.ok ? {} : fieldsForStep(step, request.errors);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (!request.ok) return setErrors(request.errors);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { slug, adminToken } = await apiFetch<{ slug: string; adminToken: string }>(
        "/api/tournaments",
        {
          method: "POST",
          body: request.body,
        },
      );
      setCreated({ slug, url: adminUrl(window.location.origin, slug, adminToken) });
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : "Could not create the tournament. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (created) return <Created slug={created.slug} url={created.url} />;

  return (
    <form onSubmit={next} noValidate aria-labelledby="wizard-step">
      <ol className="mb-6 flex gap-2 text-sm" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`flex-1 border-t-4 pt-2 ${i <= step ? "border-accent-600 font-semibold" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      <h2 id="wizard-step" className="sr-only">
        Step {step + 1}: {STEPS[step]}
      </h2>

      <Card className="space-y-5">
        {step === 0 && (
          <>
            <Field label="Tournament name" error={errors.name}>
              {(id, describedBy) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={Boolean(errors.name)}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Summer Cup 2026"
                  maxLength={100}
                  autoFocus
                />
              )}
            </Field>
            <Field label="Sport" error={errors.sport}>
              {(id, describedBy) => (
                <>
                  <TextInput
                    id={id}
                    list="sports"
                    aria-describedby={describedBy}
                    aria-invalid={Boolean(errors.sport)}
                    value={form.sport}
                    onChange={(e) => update("sport", e.target.value)}
                    placeholder="Football"
                    maxLength={50}
                  />
                  <datalist id="sports">
                    {SPORTS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Format</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {FORMATS.map((f) => (
                  <label
                    key={f}
                    className={`cursor-pointer rounded-md border p-3 text-sm ${form.format === f ? "border-accent-600 bg-accent-50 dark:bg-accent-900/30" : "border-slate-300 dark:border-slate-700"}`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={f}
                      checked={form.format === f}
                      onChange={() => update("format", f)}
                      className="mr-2 accent-accent-600"
                    />
                    <span className="font-medium">{FORMAT_LABELS[f]}</span>
                    <span className="mt-1 block text-slate-600 dark:text-slate-400">
                      {FORMAT_HELP[f]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {form.format === "GROUP_KNOCKOUT" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Number of groups"
                  value={form.groups}
                  min={1}
                  max={32}
                  error={errors.groups}
                  onChange={(v) => update("groups", v)}
                />
                <NumberField
                  label="Teams advancing per group"
                  value={form.advancePerGroup}
                  min={1}
                  max={8}
                  error={errors.advancePerGroup}
                  onChange={(v) => update("advancePerGroup", v)}
                />
              </div>
            )}

            {usesLeagueRules(form.format) && (
              <>
                <Field label="Legs" hint="Two legs means home and away.">
                  {(id, describedBy) => (
                    <Select
                      id={id}
                      aria-describedby={describedBy}
                      value={form.legs}
                      onChange={(e) => update("legs", Number(e.target.value) as 1 | 2)}
                    >
                      <option value={1}>Single (play each team once)</option>
                      <option value={2}>Double (home and away)</option>
                    </Select>
                  )}
                </Field>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Points</legend>
                  <div className="grid grid-cols-3 gap-3">
                    <NumberField
                      label="Win"
                      value={form.pointsForWin}
                      min={-10}
                      max={10}
                      onChange={(v) => update("pointsForWin", v)}
                    />
                    <NumberField
                      label="Draw"
                      value={form.pointsForDraw}
                      min={-10}
                      max={10}
                      onChange={(v) => update("pointsForDraw", v)}
                    />
                    <NumberField
                      label="Loss"
                      value={form.pointsForLoss}
                      min={-10}
                      max={10}
                      onChange={(v) => update("pointsForLoss", v)}
                    />
                  </div>
                </fieldset>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ties are broken by points, head-to-head, goal difference, goals scored, wins, then
                  seed.
                </p>
              </>
            )}

            {(form.format === "SINGLE_ELIM" || form.format === "GROUP_KNOCKOUT") && (
              <Checkbox
                label="Play a third-place match"
                checked={form.thirdPlaceMatch}
                onChange={(v) => update("thirdPlaceMatch", v)}
              />
            )}
            {form.format === "DOUBLE_ELIM" && (
              <Checkbox
                label="Bracket reset: replay the grand final if the losers-bracket champion wins it"
                checked={form.grandFinalReset}
                onChange={(v) => update("grandFinalReset", v)}
              />
            )}

            <Field
              label="When an edited result changes later matches"
              hint="Matches that were already played with the old winner."
            >
              {(id, describedBy) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={form.editPolicy}
                  onChange={(e) => update("editPolicy", e.target.value as WizardForm["editPolicy"])}
                >
                  <option value="RESET_DOWNSTREAM">Ask me, then reset those results</option>
                  <option value="BLOCK_EDIT">Block the edit</option>
                </Select>
              )}
            </Field>
          </>
        )}

        {step === 2 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium">{form.name}</dd>
            <dt className="text-slate-500">Sport</dt>
            <dd>{form.sport}</dd>
            <dt className="text-slate-500">Format</dt>
            <dd>{FORMAT_LABELS[form.format]}</dd>
            <dt className="text-slate-500">Forfeits</dt>
            <dd>
              Walkover counts as {defaultWalkoverScore(form.sport).winner}–
              {defaultWalkoverScore(form.sport).loser}
            </dd>
            {usesLeagueRules(form.format) && (
              <>
                <dt className="text-slate-500">Points</dt>
                <dd>
                  {form.pointsForWin} / {form.pointsForDraw} / {form.pointsForLoss} (win / draw /
                  loss), {form.legs === 2 ? "home and away" : "single leg"}
                </dd>
              </>
            )}
            {form.format === "GROUP_KNOCKOUT" && (
              <>
                <dt className="text-slate-500">Groups</dt>
                <dd>
                  {form.groups} groups, top {form.advancePerGroup} advance
                </dd>
              </>
            )}
          </dl>
        )}

        {submitError && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {submitError}
          </p>
        )}

        <div className="flex justify-between gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="submit">Next</Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Creating…" : "Create tournament"}
            </Button>
          )}
        </div>
      </Card>
    </form>
  );
}

function fieldsForStep(step: number, errors: Record<string, string>): Record<string, string> {
  const keys =
    step === 0
      ? ["name", "sport"]
      : step === 1
        ? ["groups", "advancePerGroup", "legs"]
        : Object.keys(errors);
  return Object.fromEntries(Object.entries(errors).filter(([k]) => keys.includes(k)));
}

function NumberField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  error?: string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={props.label} error={props.error}>
      {(id, describedBy) => (
        <TextInput
          id={id}
          type="number"
          inputMode="numeric"
          aria-describedby={describedBy}
          min={props.min}
          max={props.max}
          value={Number.isNaN(props.value) ? "" : props.value}
          onChange={(e) => props.onChange(e.target.valueAsNumber)}
        />
      )}
    </Field>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-accent-600"
      />
      {label}
    </label>
  );
}

function Created({ slug, url }: { slug: string; url: string }) {
  return (
    <Card className="space-y-4" role="status">
      <h2 className="text-xl font-bold">Tournament created</h2>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        <strong>Save this link, it is the only way to manage your tournament.</strong> Anyone with
        it can edit results.
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput
          readOnly
          value={url}
          aria-label="Admin link"
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
        />
        <CopyButton text={url} label="Copy admin link" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={url.slice(url.indexOf("/t/"))}
          className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
        >
          Open admin page
        </Link>
        <Link
          href={`/t/${slug}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
        >
          View public page
        </Link>
      </div>
    </Card>
  );
}
