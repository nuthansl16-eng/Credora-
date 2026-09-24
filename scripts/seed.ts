/**
 * Seed script — NON-PRODUCTION REFERENCE DATA ONLY.
 *
 * This seeds:
 *  - A handful of example religions/communities (neutral names/descriptions,
 *    admin-approved so they show up in local dev)
 *  - The initial pricing catalog from the spec, per supported region
 *
 * It deliberately does NOT create:
 *  - Fake users
 *  - Fake purchases
 *  - Fake point transactions
 *  - Fake leaderboard activity
 *
 * Real leaderboard scores only ever come from real signups + the mock or
 * live payment flow. Run with: npm run db:seed
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to seed.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

const religions = [
  { slug: "example-community-a", name: "Example Community A", short_description: "A placeholder community for local development.", is_approved: true },
  { slug: "example-community-b", name: "Example Community B", short_description: "A placeholder community for local development.", is_approved: true },
  { slug: "example-community-c", name: "Example Community C", short_description: "A placeholder community for local development.", is_approved: true },
];

const pricingPackages = [
  // India (INR, minor units = paise)
  { region_code: "IN", currency: "INR", amount_minor_units: 4900, points_granted: 50, display_name: "₹49 — 50 points" },
  { region_code: "IN", currency: "INR", amount_minor_units: 9900, points_granted: 100, display_name: "₹99 — 100 points" },
  { region_code: "IN", currency: "INR", amount_minor_units: 49900, points_granted: 500, display_name: "₹499 — 500 points" },
  { region_code: "IN", currency: "INR", amount_minor_units: 99900, points_granted: 1000, display_name: "₹999 — 1,000 points" },
  { region_code: "IN", currency: "INR", amount_minor_units: 499900, points_granted: 5000, display_name: "₹4,999 — 5,000 points" },
  // United States (USD, minor units = cents)
  { region_code: "US", currency: "USD", amount_minor_units: 99, points_granted: 50, display_name: "$0.99 — 50 points" },
  { region_code: "US", currency: "USD", amount_minor_units: 199, points_granted: 100, display_name: "$1.99 — 100 points" },
  { region_code: "US", currency: "USD", amount_minor_units: 999, points_granted: 500, display_name: "$9.99 — 500 points" },
  { region_code: "US", currency: "USD", amount_minor_units: 1999, points_granted: 1000, display_name: "$19.99 — 1,000 points" },
  { region_code: "US", currency: "USD", amount_minor_units: 9999, points_granted: 5000, display_name: "$99.99 — 5,000 points" },
  // United Kingdom (GBP, minor units = pence)
  { region_code: "GB", currency: "GBP", amount_minor_units: 79, points_granted: 50, display_name: "£0.79 — 50 points" },
  { region_code: "GB", currency: "GBP", amount_minor_units: 149, points_granted: 100, display_name: "£1.49 — 100 points" },
  { region_code: "GB", currency: "GBP", amount_minor_units: 749, points_granted: 500, display_name: "£7.49 — 500 points" },
  { region_code: "GB", currency: "GBP", amount_minor_units: 1499, points_granted: 1000, display_name: "£14.99 — 1,000 points" },
  { region_code: "GB", currency: "GBP", amount_minor_units: 7499, points_granted: 5000, display_name: "£74.99 — 5,000 points" },
  // UAE (AED, minor units = fils)
  { region_code: "AE", currency: "AED", amount_minor_units: 399, points_granted: 50, display_name: "AED 3.99 — 50 points" },
  { region_code: "AE", currency: "AED", amount_minor_units: 799, points_granted: 100, display_name: "AED 7.99 — 100 points" },
  { region_code: "AE", currency: "AED", amount_minor_units: 3999, points_granted: 500, display_name: "AED 39.99 — 500 points" },
  { region_code: "AE", currency: "AED", amount_minor_units: 7499, points_granted: 1000, display_name: "AED 74.99 — 1,000 points" },
  { region_code: "AE", currency: "AED", amount_minor_units: 39999, points_granted: 5000, display_name: "AED 399.99 — 5,000 points" },
];

async function main() {
  console.log("Seeding religions/communities...");
  for (const r of religions) {
    const { error } = await supabase.from("religions").upsert(r, { onConflict: "slug" });
    if (error) console.error(`Failed to seed ${r.slug}:`, error.message);
  }

  console.log("Seeding pricing packages...");
  for (const p of pricingPackages) {
    const { error } = await supabase.from("pricing_packages").insert(p);
    if (error && error.code !== "23505") console.error("Failed to seed package:", error.message);
  }

  console.log("Seed complete. No fake users, purchases, or point activity were created.");
}

main().then(() => process.exit(0));
