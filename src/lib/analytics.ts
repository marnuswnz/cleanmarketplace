"use client";

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Record<string, string | number>; revenue?: { currency: string; amount: number } }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

/** Fire a conversion/analytics event to whichever provider is loaded. */
export function track(event: string, props: Record<string, string | number> = {}) {
  try {
    window.plausible?.(event, { props });
    window.gtag?.("event", event.toLowerCase().replace(/\s+/g, "_"), props);
  } catch {
    /* analytics must never break the page */
  }
}
