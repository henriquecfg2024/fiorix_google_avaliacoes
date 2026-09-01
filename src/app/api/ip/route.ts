import { NextRequest, NextResponse } from "next/server";
import { getRequestIp, maskIp } from "@/lib/security/requestIp";

export async function GET(req: NextRequest) {
  const ip = getRequestIp(req);
  return NextResponse.json({
    ip,
    ipMascarado: maskIp(ip),
  });
}
