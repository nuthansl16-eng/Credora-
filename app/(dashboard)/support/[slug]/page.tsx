import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { appConfig } from "@/lib/config";
import { PackagePicker } from "./package-picker";

export default async function SupportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createClient();

  const { data: religion } = await supabase
    .from("religions")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("is_approved", true)
    .single();
  if (!religion) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("region_code").eq("id", user.id).single()
    : { data: null };

  const preferredRegion = profile?.region_code ?? "US";

  const { data: packages } = await supabase
    .from("pricing_packages")
    .select("*")
    .eq("is_active", true)
    .order("amount_minor_units", { ascending: true });

  type PricingPackage = NonNullable<typeof packages>[number];
  const grouped = (packages ?? []).reduce<Record<string, PricingPackage[]>>((acc, p) => {
    (acc[p.region_code] ??= []).push(p);
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">Support {religion.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{appConfig.integrityPhrase}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Digital points have no cash value and cannot be withdrawn, transferred, or resold.
      </p>

      <PackagePicker
        religionId={religion.id}
        packagesByRegion={grouped}
        defaultRegion={preferredRegion}
        isLoggedIn={!!user}
      />
    </main>
  );
}
