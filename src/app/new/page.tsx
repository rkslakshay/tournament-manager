import type { Metadata } from "next";
import { CreateWizard } from "@/components/create-wizard";

export const metadata: Metadata = { title: "Create a tournament" };

export default function NewTournamentPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Create a tournament</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Three quick steps. You can add teams afterwards.
      </p>
      <div className="mt-8">
        <CreateWizard />
      </div>
    </div>
  );
}
