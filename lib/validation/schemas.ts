import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores are allowed");

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const onboardingRegionSchema = z.object({
  countryCode: z.string().length(2),
  regionCode: z.string().length(2),
});

export const onboardingUsernameSchema = z.object({
  username: usernameSchema,
});

export const privacySettingsSchema = z.object({
  publicUsername: z.boolean(),
  publicAvatar: z.boolean(),
  showPointsPublicly: z.boolean(),
  showCountryPublicly: z.boolean(),
  appearInTop100: z.boolean(),
  anonymousDisplay: z.boolean(),
  publicProfile: z.boolean(),
});

/**
 * Client sends ONLY identifiers — never price, currency, or points.
 * The server looks up the package server-side (see app/api/purchases).
 */
export const createPurchaseSchema = z.object({
  religionId: z.string().uuid(),
  pricingPackageId: z.string().uuid(),
  paymentMethod: z.string().max(40).optional(),
});

export const adminCreateReligionSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  name: z.string().min(1).max(200),
  shortDescription: z.string().max(280).optional(),
  description: z.string().max(5000).optional(),
  symbolImageUrl: z.string().url().optional(),
  sacredSymbol: z.string().max(32).optional(),
  sacredSymbolLabel: z.string().max(120).optional(),
});

export const adminPricingPackageSchema = z.object({
  regionCode: z.string().length(2),
  currency: z.string().length(3),
  amountMinorUnits: z.number().int().positive(),
  pointsGranted: z.number().int().positive(),
  displayName: z.string().min(1).max(120),
  isActive: z.boolean(),
});

export const adminCorrectionSchema = z.object({
  userId: z.string().uuid(),
  religionId: z.string().uuid(),
  points: z.number().int().refine((v) => v !== 0, "Points cannot be zero"),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

export const adminRefundSchema = z.object({
  purchaseId: z.string().uuid(),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

export const accountDeletionRequestSchema = z.object({
  confirmationPhrase: z.literal("DELETE MY ACCOUNT"),
});
