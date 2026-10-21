import { ImageResponse } from "next/og";
import { FORMAT_LABELS } from "@/lib/tournament-config";
import { loadPublicView } from "@/server/load-view";

export const alt = "Tournament standings and fixtures";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STATUS_TEXT = {
  DRAFT: "Upcoming",
  REGISTRATION: "Upcoming",
  IN_PROGRESS: "Live now",
  COMPLETED: "Final results",
  ARCHIVED: "Archived",
} as const;

/** Social preview card (WhatsApp, Slack, X…) showing the tournament name and status. */
export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await loadPublicView(slug);
  const name = view?.tournament.name ?? "Tournament";
  const subtitle = view
    ? `${view.tournament.sport} · ${FORMAT_LABELS[view.tournament.format]} · ${view.teams.length} teams`
    : "Tournament Manager";
  const status = view ? STATUS_TEXT[view.tournament.status] : "";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0b1120",
        color: "#f8fafc",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, color: "#94a3b8" }}
      >
        <div style={{ width: 24, height: 24, background: "#059669", transform: "rotate(45deg)" }} />
        Tournament Manager
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
        <div style={{ fontSize: 36, color: "#cbd5e1" }}>{subtitle}</div>
      </div>
      {status && (
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            padding: "10px 24px",
            borderRadius: 999,
            background: "#065f46",
            color: "#d1fae5",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {status}
        </div>
      )}
    </div>,
    size,
  );
}
