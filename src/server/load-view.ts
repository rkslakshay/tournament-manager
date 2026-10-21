import { cache } from "react";
import type { PublicView } from "@/lib/public-view";
import { getDb } from "./db";
import { ServiceError } from "./errors";
import { getPublicView } from "./services/public-view";

/**
 * Public view for server components, or null when the slug does not exist. Cached per request
 * so a page and its metadata share one database read.
 */
export const loadPublicView = cache(async (slug: string): Promise<PublicView | null> => {
  try {
    return await getPublicView(getDb(), slug);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "NOT_FOUND") return null;
    throw error;
  }
});
