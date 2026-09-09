import { NextRequest, NextResponse } from "next/server";
import { getRequestIp, maskIp } from "@/lib/security/requestIp";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  await requireAuth();

  const ip = getRequestIp(req);
  return NextResponse.json({
    ip,
    ipMascarado: maskIp(ip),
  });
}
