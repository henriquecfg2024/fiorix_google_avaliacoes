import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response("Não autorizado", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const protocolo = searchParams.get("protocolo") || "N/A";

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Auditoria - Protocolo ${protocolo}</title>
  <style>
    body {
      background-color: #080A12;
      color: #e2e8f0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
    }
    .container {
      width: 100%;
      max-width: 800px;
      background: #11131e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-b: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 900;
      font-size: 18px;
    }
    .logo-text {
      font-weight: 800;
      font-size: 20px;
      letter-spacing: 1px;
    }
    .badge {
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-amber {
      background-color: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .badge-green {
      background-color: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 30px;
      margin-bottom: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 8px;
    }
    .grid {
      display: grid;
      grid-cols: 1;
      gap: 15px;
    }
    @media (min-width: 600px) {
      .grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
    }
    .card h3 {
      margin-top: 0;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .text-red { color: #f87171; }
    .text-emerald { color: #34d399; }
    .data-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }
    .data-label {
      color: #64748b;
    }
    .data-value {
      color: #e2e8f0;
      font-weight: 500;
    }
    .footer {
      margin-top: 40px;
      font-size: 11px;
      color: #475569;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 20px;
    }
    .print-button {
      background: #fbbf24;
      color: #0f172a;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
      transition: opacity 0.2s;
    }
    .print-button:hover {
      opacity: 0.9;
    }
    @media print {
      body {
        background-color: white;
        color: black;
        padding: 0;
      }
      .container {
        border: none;
        box-shadow: none;
        background: transparent;
        padding: 0;
      }
      .print-button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-container">
        <div class="logo-icon">F</div>
        <span class="logo-text">FIORIX AUDITORIA</span>
      </div>
      <div>
        <span class="badge badge-amber">Atraso Falso Detectado</span>
      </div>
    </div>

    <div>
      <h2>Relatório de Compliance & Inconformidade Inteligente</h2>
      <p style="color: #64748b; font-size: 13px;">Documento gerado automaticamente pelo motor inteligente de auditoria FIORIX.CORRETOR.</p>
    </div>

    <div class="section-title">Informações do Protocolo</div>
    <div class="card">
      <div class="data-row">
        <span class="data-label">Número do Protocolo</span>
        <span class="data-value" style="font-weight: 700;"># ${protocolo}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Cartório Tenant</span>
        <span class="data-value">7º Registro de Imóveis de São Paulo</span>
      </div>
      <div class="data-row">
        <span class="data-label">Data da Auditoria</span>
        <span class="data-value">${new Date().toLocaleString("pt-BR")}</span>
      </div>
    </div>

    <div class="section-title">Análise de Compliance</div>
    <div class="grid">
      <div class="card">
        <h3 class="text-red">Cenário com Divergência (Antes)</h3>
        <p style="font-size: 12px; line-height: 1.5; color: #cbd5e1;">
          O protocolo consta no status de atrasado devido à ausência do andamento de baixa de balcão (ID 76).
        </p>
        <div class="data-row" style="border: none;">
          <span class="data-label">Status Sistêmico</span>
          <span class="data-value text-red" style="font-weight: 700;">ATRASADO</span>
        </div>
      </div>

      <div class="card">
        <h3 class="text-emerald">Ação de Saneamento (Depois)</h3>
        <p style="font-size: 12px; line-height: 1.5; color: #cbd5e1;">
          Lançamento automático do andamento ID 76 (BALCÃO REGISTRADO) no banco de dados WEBRI, eliminando a pendência e normalizando o fluxo.
        </p>
        <div class="data-row" style="border: none;">
          <span class="data-label">Status Proposto</span>
          <span class="data-value text-emerald" style="font-weight: 700;">NORMALIZADO</span>
        </div>
      </div>
    </div>

    <div class="footer">
      FIORIX COMPLIANCE • Versão 0.1 • Impressão autenticada via chave única de transação.
      <br>
      <button class="print-button" onclick="window.print()">🖨️ Imprimir Relatório</button>
    </div>
  </div>
</body>
</html>
    `;

    return new Response(htmlContent, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err: any) {
    return new Response(`Erro ao gerar relatório: ${err.message}`, { status: 500 });
  }
}
