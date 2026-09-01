import { NextRequest } from "next/server";

export function getRequestIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return "127.0.0.1";
}

export function maskIp(ip: string): string {
  if (!ip) return "***.***.***.***";
  // Máscara básica para IPv4 (ex: 192.168.***.***)
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  // Para IPv6 ou outros formatos, mascara a segunda metade
  return ip.substring(0, Math.floor(ip.length / 2)) + "****";
}
