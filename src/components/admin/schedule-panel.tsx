"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, TextInput, inputClass } from "@/components/ui/field";
import { scheduleBody } from "@/lib/api-schemas";
import { parseTeamList } from "@/lib/team-list";
import type { AdminActions } from "./admin-app";

/** Auto-schedule open matches across venues and time slots. */
export function SchedulePanel({
  actions,
  venueNames,
}: {
  actions: AdminActions;
  venueNames: string[];
}) {
  const [venues, setVenues] = useState(venueNames.join("\n") || "Court 1\nCourt 2");
  const [start, setStart] = useState("");
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [rest, setRest] = useState(1);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = scheduleBody.safeParse({
      venues: parseTeamList(venues),
      startTime: start ? new Date(start).toISOString() : "",
      slotMinutes,
      minRestSlots: rest,
    });
    if (!parsed.success)
      return setError(
        "Add at least one venue, a start time and a slot length of 5 minutes or more.",
      );
    setError(null);
    let summary = "";
    await actions.run(async () => {
      const out = await actions.api<{ scheduled: number; unscheduled: string[] }>("schedule", {
        method: "POST",
        body: parsed.data,
      });
      summary = out.unscheduled.length > 0 ? `, ${out.unscheduled.length} did not fit` : "";
      return out;
    }, "Schedule updated");
    if (summary)
      actions.notify(`Schedule updated${summary}. Add venues or shorten slots.`, "error");
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Schedule</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Assign open matches to venues and time slots. Teams get the rest you ask for, and later
        rounds wait for the matches that feed them.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:row-span-2">
          <label htmlFor="venues" className="block text-sm font-medium">
            Venues (one per line)
          </label>
          <textarea
            id="venues"
            rows={4}
            value={venues}
            onChange={(e) => setVenues(e.target.value)}
            className={`${inputClass} h-auto py-2`}
          />
        </div>
        <Field label="First match starts">
          {(id) => (
            <TextInput
              id={id}
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Slot length (min)">
            {(id) => (
              <TextInput
                id={id}
                type="number"
                min={5}
                max={1440}
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(e.target.valueAsNumber)}
              />
            )}
          </Field>
          <Field label="Rest slots">
            {(id) => (
              <TextInput
                id={id}
                type="number"
                min={0}
                max={10}
                value={rest}
                onChange={(e) => setRest(e.target.valueAsNumber)}
              />
            )}
          </Field>
        </div>
        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-red-600 sm:col-span-2 dark:text-red-400"
          >
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={actions.busy}>
            Auto-schedule
          </Button>
        </div>
      </form>
    </Card>
  );
}
