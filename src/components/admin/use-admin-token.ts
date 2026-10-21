"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const storageKey = (slug: string) => `tm-admin-token:${slug}`;

/**
 * The admin token for a tournament. A `?token=` from the admin link is moved into localStorage
 * and removed from the address bar, so it does not linger in history or get shared by accident.
 * `undefined` while loading, `null` when there is no token.
 */
export function useAdminToken(slug: string): {
  token: string | null | undefined;
  forget: () => void;
} {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("token");
    if (fromUrl) {
      try {
        localStorage.setItem(storageKey(slug), fromUrl);
      } catch {
        // Storage can be unavailable (private mode); the token still works for this visit.
      }
      url.searchParams.delete("token");
      // Through the router: a raw history.replaceState here is undone when the App Router
      // records its own initial history entry after child effects have run.
      router.replace(`${pathname}${url.search}`, { scroll: false });
      setToken(fromUrl);
      return;
    }
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(storageKey(slug));
    } catch {
      stored = null;
    }
    setToken(stored);
  }, [slug, router, pathname]);

  const forget = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(slug));
    } catch {
      // Nothing stored to remove.
    }
    setToken(null);
  }, [slug]);

  return { token, forget };
}
