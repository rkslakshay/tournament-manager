"use client";

import { Button } from "@/components/ui/button";

/** Builds a CSV file in the browser and saves it; nothing is sent to the server. */
export function DownloadCsv({
  label,
  filename,
  build,
}: {
  label: string;
  filename: string;
  build: () => string;
}) {
  function download() {
    const url = URL.createObjectURL(new Blob([build()], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button variant="secondary" size="sm" onClick={download}>
      {label}
    </Button>
  );
}
