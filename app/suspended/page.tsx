import Link from "next/link";

export default function SuspendedPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-20">
      <h1 className="text-2xl font-semibold">Account suspended</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This account is currently restricted from using Credora. If you believe this is an error, contact the site administrator.
      </p>
      <Link href="/" className="mt-6 inline-block underline">Return home</Link>
    </main>
  );
}
