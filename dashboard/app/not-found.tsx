import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel max-w-lg space-y-4 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          404
        </p>
        <h1 className="text-2xl font-semibold">This route does not exist.</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          The dashboard page you asked for either moved or is not available anymore.
        </p>
        <Link
          className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          href="/"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
