"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import type { PublicTeam } from "@/lib/public-view";
import { moveItem, parseTeamList } from "@/lib/team-list";
import { MAX_TEAMS } from "@/lib/tournament-config";
import type { AdminActions } from "./admin-app";

interface Props {
  teams: PublicTeam[];
  actions: AdminActions;
}

/** Add, remove and reseed teams before the tournament starts. */
export function TeamManager({ teams, actions }: Props) {
  const [text, setText] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const names = parseTeamList(text);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (names.length === 0) return;
    const ok = await actions.run(
      () => actions.api("teams", { method: "POST", body: { names } }),
      `${names.length} team(s) added`,
    );
    if (ok) setText("");
  }

  async function reorder(from: number, to: number) {
    if (from === to) return;
    const order = moveItem(teams, from, to).map((t) => t.id);
    await actions.run(
      () => actions.api("teams/order", { method: "PUT", body: { teamIds: order } }),
      "Seeds updated",
    );
  }

  function onDrop(event: DragEvent, to: number) {
    event.preventDefault();
    if (dragIndex !== null) void reorder(dragIndex, to);
    setDragIndex(null);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <form onSubmit={add} className="space-y-3">
          <label htmlFor="team-names" className="block font-semibold">
            Add teams
          </label>
          <p id="team-names-hint" className="text-sm text-slate-500 dark:text-slate-400">
            Paste a list, one team per line. Add them strongest first: the order becomes the
            seeding.
          </p>
          <textarea
            id="team-names"
            aria-describedby="team-names-hint"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${inputClass} h-auto py-2`}
            placeholder={"Red Lions\nBlue Sharks\nGreen Eagles"}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {names.length > 0 ? `${names.length} to add` : `${teams.length} / ${MAX_TEAMS} teams`}
            </span>
            <Button type="submit" disabled={names.length === 0 || actions.busy}>
              Add {names.length > 1 ? `${names.length} teams` : "team"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold">Teams and seeding</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Seed 1 is the strongest. Drag, or use the arrow buttons, to reorder.
        </p>
        {teams.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No teams yet.</p>
        ) : (
          <ol
            className="mt-3 divide-y divide-slate-200 dark:divide-slate-800"
            aria-label="Teams by seed"
          >
            {teams.map((team, i) => (
              <li
                key={team.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, i)}
                className={`flex items-center gap-2 py-2 ${dragIndex === i ? "opacity-50" : ""}`}
              >
                <span aria-hidden className="cursor-grab select-none px-1 text-slate-400">
                  ⋮⋮
                </span>
                <span className="w-8 text-right text-sm tabular-nums text-slate-500">
                  {team.seed}
                </span>
                <span className="flex-1 truncate font-medium">{team.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move ${team.name} up`}
                  disabled={i === 0 || actions.busy}
                  onClick={() => reorder(i, i - 1)}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move ${team.name} down`}
                  disabled={i === teams.length - 1 || actions.busy}
                  onClick={() => reorder(i, i + 1)}
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${team.name}`}
                  disabled={actions.busy}
                  onClick={() =>
                    actions.run(
                      () => actions.api(`teams/${team.id}`, { method: "DELETE" }),
                      `${team.name} removed`,
                    )
                  }
                >
                  ✕
                </Button>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
