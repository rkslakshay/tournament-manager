import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTournament } from "@/components/public/public-tournament";
import { loadPublicView } from "@/server/load-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await loadPublicView(slug);
  return { title: view?.tournament.name ?? "Tournament not found" };
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await loadPublicView(slug);
  if (!view) notFound();
  return <PublicTournament initialView={view} />;
}
