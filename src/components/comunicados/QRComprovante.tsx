"use client";

import React from "react";
import { QrCode, ExternalLink } from "lucide-react";

interface QRComprovanteProps {
  url: string;
  hash: string;
}

export function QRComprovante({ url, hash }: QRComprovanteProps) {
  // Gera um QR code visual utilizando a API pública de SVG ou padrão de fallback dinâmico
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
    url
  )}&bgcolor=12141F&color=22D3EE&margin=1`;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-[#0d0d16] border border-white/10 rounded-xl">
      <div className="relative w-36 h-36 bg-[#12141F] rounded-lg p-2 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
        {/* Imagem do QR Code ou fallback */}
        <img
          src={qrSvgUrl}
          alt={`QR Code para validação do hash ${hash}`}
          className="w-full h-full object-contain rounded"
          onError={(e) => {
            // Fallback caso offline
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity bg-[#12141F]/90 rounded-lg">
          <QrCode className="w-8 h-8 text-cyan-400 mb-1" />
          <span className="text-[10px] text-cyan-300 font-mono">Verificar Hash</span>
        </div>
      </div>

      <div className="mt-3 text-center max-w-[220px]">
        <p className="text-[11px] font-mono text-cyan-400 break-all bg-cyan-950/40 px-2 py-1 rounded border border-cyan-800/50">
          {hash.substring(0, 16)}...{hash.substring(hash.length - 8)}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-cyan-400 transition-colors"
        >
          <span>Abrir link de validação</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
