"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="panel max-w-xl space-y-4 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-destructive">
            Dashboard Error
          </p>
          <h1 className="text-2xl font-semibold">The app hit an unrecoverable state.</h1>
          <p className="text-sm leading-7 text-muted-foreground">
            {error.message || "Something went wrong while rendering the dashboard."}
          </p>
          <button
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
