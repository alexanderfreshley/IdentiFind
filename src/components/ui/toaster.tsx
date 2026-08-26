"use client";

// Minimal toast container — extend with a proper library (e.g. sonner) as needed.
export function Toaster() {
  return <div id="toast-root" aria-live="polite" aria-atomic="true" />;
}
