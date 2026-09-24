/**
 * Central application configuration.
 * Change app name, tagline, theme, and feature flags here.
 * Do NOT put secrets in this file — it is imported by client components.
 */

export const appConfig = {
  name: "Credora", // [APP NAME] placeholder — rename here
  tagline: "One world. Many communities. One permanent leaderboard.",
  integrityPhrase:
    "Verified contributions. Permanent rankings. Strict integrity standards.",
  supportEmail: "support@example.com",
  legalEntityName: "[LEGAL ENTITY NAME PLACEHOLDER]",

  // Charity disclosure percentage. Must match docs/CHARITY.md and the
  // CHARITY_ALLOCATION_PERCENTAGE env var used by admin reporting.
  charityAllocationPercentage: Number(
    process.env.CHARITY_ALLOCATION_PERCENTAGE ?? 10
  ),

  // Points/leaderboard rules — centralised so copy and logic never drift.
  points: {
    hasNoCashValue: true,
    nonTransferable: true,
    nonWithdrawable: true,
    nonExpiring: true,
  },

  theme: {
    light: {
      background: "#ffffff",
      foreground: "#0a0a0a",
      primary: "#1d4ed8",
      accent: "#0ea5e9",
      muted: "#f4f4f5",
      border: "#e4e4e7",
    },
    dark: {
      background: "#0a0a0a",
      foreground: "#fafafa",
      primary: "#3b82f6",
      accent: "#38bdf8",
      muted: "#18181b",
      border: "#27272a",
    },
  },

  pagination: {
    leaderboardPageSize: 25,
    top100PageSize: 25, // "load more" in pages of 25 up to 100
  },

  achievements: {
    EARLY_SUPPORTER: "Early Supporter",
    COMMUNITY_CONTRIBUTOR: "Community Contributor",
    CONSISTENT_SUPPORTER: "Consistent Supporter",
    TOP_100_SUPPORTER: "Top 100 Supporter",
    VERIFIED_SUPPORTER: "Verified Supporter",
  },

  // Supported billing regions for the initial pricing catalog.
  // Extend via the admin dashboard / pricing_packages table, not here.
  supportedRegions: ["IN", "US", "GB", "AE", "CA", "AU", "SG", "BR", "MX", "DE", "FR", "IT", "ES", "NL", "BE", "PL", "SE", "NO", "FI", "AT", "CN", "HK", "JP", "KR", "MY", "PH", "ID", "AR", "CL", "CO"] as const,
} as const;

export type SupportedRegion = (typeof appConfig.supportedRegions)[number];
