import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTournament } from "@/components/public/public-tournament";
import { FORMAT_LABELS } from "@/lib/tournament-config";
import { loadPublicView } from "@/server/load-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await loadPublicView(slug);
  if (!view) return { title: "Tournament not found" };
  const { name, sport, format } = view.tournament;
  const description = `Live standings, fixtures and bracket for ${name}: ${sport}, ${FORMAT_LABELS[format].toLowerCase()}, ${view.teams.length} teams.`;
  return {
    title: name,
    description,
    alternates: { canonical: `/t/${slug}` },
    openGraph: {
      title: name,
      description,
      type: "website",
      url: `/t/${slug}`,
      siteName: "Tournament Manager",
    },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await loadPublicView(slug);
  if (!view) notFound();
  return <PublicTournament initialView={view} />;
}
