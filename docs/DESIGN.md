# Design

## Users

- **Organizer**: runs the tournament, enters results. Needs speed and no mistakes.
- **Viewer**: players and fans on mobile, following along. Needs a clear, fast, read-only page.

## Pages

| Route             | Audience  | Purpose                                                          |
| ----------------- | --------- | ---------------------------------------------------------------- |
| `/`               | all       | Landing, "Create tournament" CTA, link to a demo tournament      |
| `/new`            | organizer | Create wizard: name, sport, format, rules                        |
| `/t/[slug]`       | viewer    | Public page: tabs for Fixtures, Standings, Bracket               |
| `/t/[slug]/admin` | organizer | Manage teams, start tournament, enter and edit results, schedule |

## Public page (mobile first)

- Header: tournament name, sport, status badge (Live / Upcoming / Completed).
- Tabs: **Standings** (table), **Fixtures** (grouped by round or date), **Bracket** (visual tree, horizontally scrollable on mobile).
- A "Live" dot on matches in progress. Page updates without reload.
- Share button copies the URL; open-graph metadata so links preview nicely in WhatsApp and social apps.

## Organizer flow

1. Create tournament and receive the admin link (copy prompt: "Save this link, it is the only way to manage your tournament").
2. Add teams (paste a list, one per line). Drag to reorder seeds.
3. Choose format and rules (points per win/draw/loss, legs, tiebreakers, third-place match).
4. Preview generated fixtures, then **Start** (locks teams).
5. Enter results inline: two number inputs and a save button. Winner advances immediately.
6. Optional: assign venues and time slots using auto-scheduler, then adjust manually.

## API contract (REST, JSON)

```
POST   /api/tournaments                      create -> { slug, adminToken }
GET    /api/t/:slug                          public view
GET    /api/t/:slug/events                   SSE stream
POST   /api/t/:slug/teams                    (admin) add team(s)
DELETE /api/t/:slug/teams/:teamId            (admin)
PUT    /api/t/:slug/teams/order              (admin) reseed
POST   /api/t/:slug/start                    (admin) generate fixtures
PUT    /api/t/:slug/matches/:id/result       (admin) record or edit result
PUT    /api/t/:slug/matches/:id/status       (admin) mark LIVE or back to SCHEDULED
PUT    /api/t/:slug/matches/:id/forfeit      (admin) { teamId } forfeits; opponent wins by walkover
POST   /api/t/:slug/schedule                 (admin) run auto-scheduler
```

Admin auth: `Authorization: Bearer <token>` header. Errors: `{ error: { code, message, details? } }` with proper HTTP status.

## Edge cases the design must handle

- Odd number of teams (round-robin byes, bracket byes).
- Minimum 2 teams; sensible maximum (e.g. 128).
- Draws in knockout matches: require a winner (extra-time/penalty field) or disallow draws.
- Editing a result that already advanced a team (invalidate downstream with confirmation).
- Removing a team after start: not allowed; offer "forfeit" instead (opponent gets a walkover).
  Implemented per match: the organizer picks which team forfeits and the opponent wins with the
  tournament's walkover score (default 3-0; 1-0 for game-scored sports such as chess or tennis).
  It is stored as a normal result marked `WALKOVER`, so it counts in standings, advances the
  winner in brackets and follows the edit policy like any other result.
- Duplicate team names (reject, case-insensitive).
- Two organizers editing at once: last write wins per match, with a version field to detect conflicts and show a clear message.
- Viewer opens page mid-tournament: always fetch full current state, never rely on missed events.

## Visual design

- Clean, high-contrast, sporty but minimal. One accent colour, dark mode supported.
- Standings table: sticky header, highlight qualification positions.
- Bracket: connector lines between matches, winner in bold, TBD slots in muted style.
- Accessibility: keyboard-operable result entry, labelled inputs, sufficient contrast, no colour-only meaning.

## Demo data

`npm run db:seed` creates three public demo tournaments: an 8-team round-robin, a 12-team single-elimination (with byes), and a 16-team group + knockout. Link the live demo from the README.
