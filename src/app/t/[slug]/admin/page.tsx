import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminApp } from "@/components/admin/admin-app";
import { loadPublicView } from "@/server/load-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage tournament",
  robots: { index: false, follow: false },
};

export default async function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await loadPublicView(slug);
  if (!view) notFound();
  return <AdminApp initialView={view} />;
}
