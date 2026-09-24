import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, contentLengthWithin, hasJsonContentType, clientIp } from "@/lib/request-security";
import { z } from "zod";

const reportSchema = z.object({
  targetType: z.enum(["religion", "profile", "contribution", "other"]),
  targetId: z.string().uuid().optional(),
  reason: z.string().min(10).max(2000),
});

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req) || !hasJsonContentType(req) || !contentLengthWithin(req, 8 * 1024)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const [userRl, ipRl] = await Promise.all([
    checkRateLimit(`report:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }),
    checkRateLimit(`report-ip:${clientIp(req)}`, { limit: 10, windowMs: 60 * 60 * 1000 }),
  ]);
  if (!userRl.allowed || !ipRl.allowed) return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  const { error } = await supabase.from("abuse_reports").insert({ reporter_user_id: user.id, target_type: parsed.data.targetType, target_id: parsed.data.targetId ?? null, reason: parsed.data.reason });
  if (error) return NextResponse.json({ error: "Could not submit report" }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
