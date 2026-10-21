import Link from "next/link";
import { DEMO_TOURNAMENTS } from "@/lib/demo";
import { FORMAT_LABELS, FORMATS } from "@/lib/tournament-config";

const FEATURES = [
  {
    title: "Every format",
    text: "Round robin, single and double elimination, and groups + knockout.",
  },
  {
    title: "Fair by design",
    text: "Standard seeding, byes for top seeds and configurable tiebreakers.",
  },
  { title: "Live for everyone", text: "A public page that updates the moment a result is saved." },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Run your tournament in minutes.
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
          Add teams, pick a format and get fixtures instantly. Enter results and standings and
          brackets update themselves. Share one link so players and fans can follow along live.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/new"
            className="rounded-md bg-accent-600 px-5 py-3 font-semibold text-white hover:bg-accent-700"
          >
            Create a tournament
          </Link>
          <Link
            href={`/t/${DEMO_TOURNAMENTS[0].slug}`}
            className="rounded-md border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            See a demo
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          No sign-up: you get a private admin link. Formats:{" "}
          {FORMATS.map((f) => FORMAT_LABELS[f]).join(", ")}.
        </p>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3" aria-label="Features">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-slate-200 p-5 dark:border-slate-800"
          >
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-16" aria-labelledby="demos">
        <h2 id="demos" className="text-xl font-bold">
          Demo tournaments
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {DEMO_TOURNAMENTS.map((demo) => (
            <li key={demo.slug}>
              <Link
                href={`/t/${demo.slug}`}
                className="block rounded-lg border border-slate-200 p-4 hover:border-accent-500 dark:border-slate-800"
              >
                <span className="font-medium">{demo.label}</span>
                <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                  {demo.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
