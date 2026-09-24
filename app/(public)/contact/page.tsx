import { appConfig } from "@/lib/config";

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10 text-sm">
      <h1 className="text-2xl font-semibold">Contact</h1>
      <p className="mt-4 text-muted-foreground">
        For support, privacy requests, abuse reports, or anything else, email us at:
      </p>
      <p className="mt-2 font-medium">{appConfig.supportEmail}</p>
      <p className="mt-6 text-xs text-muted-foreground">
        {appConfig.legalEntityName}. Replace this placeholder in <code>lib/config.ts</code> and this
        page with your real support channel and registered entity details before launch.
      </p>
    </main>
  );
}
