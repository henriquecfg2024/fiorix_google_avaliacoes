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
    const protocolsRaw = searchParams.get("protocolos") || "";
    const protocolIds = protocolsRaw.split(",").filter(Boolean);

    // Mock protocols list corresponding to active items
    const allMockProtocolos: Record<string, any> = {
      "642368": { id: "642368", badge: "IP-248", cliente: "Instrumento Particular", fase: "Exame Formal", falta: 76, dias: 5, setor: "Conferência", responsavel: "Maria" },
      "642371": { id: "642371", badge: "CA-251", cliente: "Construtora Aurora Ltda", fase: "Registro", falta: 76, dias: 12, setor: "Conferência", responsavel: "João" },
      "642389": { id: "642389", badge: "SA-309", cliente: "Silva & Andrade Imóveis", fase: "Conferência", falta: 76, dias: 27, setor: "Conferência", responsavel: "Maria" },
      "642402": { id: "642402", badge: "BR-402", cliente: "Banco Regional S/A", fase: "Prenotação", falta: 76, dias: 8, setor: "Conferência", responsavel: "Carlos" },
      "642415": { id: "642415", badge: "MRV-415", cliente: "MRV Engenharia", fase: "Exigência", falta: 76, dias: 3, setor: "Balcão", responsavel: "Ana" },
      "642429": { id: "642429", badge: "CY-429", cliente: "Cyrela Construtora", fase: "Análise", falta: 76, dias: 19, setor: "Conferência", responsavel: "Maria" },
    };

    const selectedProtocolos = protocolIds.map((id) => allMockProtocolos[id]).filter(Boolean);

    // Group by sector
    const groupedBySetor: Record<string, any[]> = {};
    selectedProtocolos.forEach((p) => {
      if (!groupedBySetor[p.setor]) {
        groupedBySetor[p.setor] = [];
      }
      groupedBySetor[p.setor].push(p);
    });

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Auditoria Inteligente - FIORIX</title>
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
      max-width: 850px;
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
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 30px;
      margin-bottom: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 8px;
    }
    .instruction-card {
      background: rgba(99, 102, 241, 0.05);
      border: 1px solid rgba(99, 102, 241, 0.15);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 25px;
    }
    .instruction-card h3 {
      margin-top: 0;
      font-size: 14px;
      color: #a5b4fc;
    }
    .instruction-card ol {
      margin: 0;
      padding-left: 20px;
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.6;
    }
    .setor-group {
      margin-bottom: 30px;
    }
    .setor-name {
      font-size: 14px;
      font-weight: 700;
      color: #fbbf24;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 15px;
    }
    th, td {
      padding: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      text-align: left;
    }
    th {
      background: rgba(255, 255, 255, 0.02);
      color: #94a3b8;
      font-weight: 700;
    }
    .col-check {
      width: 40px;
      text-align: center;
    }
    .badge-falta {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 800;
    }
    .badge-76 {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
    }
    .badge-75 {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
    }
    .sign-section {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      gap: 40px;
    }
    .sign-box {
      flex: 1;
      border-top: 1px dashed rgba(255, 255, 255, 0.2);
      text-align: center;
      padding-top: 10px;
      font-size: 11px;
      color: #94a3b8;
    }
    .footer {
      margin-top: 40px;
      font-size: 11px;
      color: #475569;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
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
      transition: opacity 0.2s;
    }
    .print-button:hover {
      opacity: 0.9;
    }
    .qr-placeholder {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      color: #64748b;
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
      th {
        background: #f1f5f9;
        color: #475569;
        border-bottom: 2px solid #cbd5e1;
      }
      td, th {
        border-bottom: 1px solid #cbd5e1;
      }
      .badge-76 {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
      }
      .badge-75 {
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
      }
      .instruction-card {
        background: #f5f3ff;
        border: 1px solid #ddd6fe;
      }
      .instruction-card h3 {
        color: #4c1d95;
      }
      .instruction-card ol {
        color: #1e1b4b;
      }
      .sign-box {
        border-top: 1px dashed #64748b;
        color: #334155;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-container">
        <div class="logo-icon">F</div>
        <span class="logo-text">7º REGISTRO DE IMÓVEIS DE SP</span>
      </div>
      <div>
        <span class="badge badge-amber">Auditoria Inteligente de Prazos</span>
      </div>
    </div>

    <div>
      <h2>Relatório Executivo de Pendências</h2>
      <p style="color: #64748b; font-size: 13px;">Documento gerado em ${new Date().toLocaleString("pt-BR")} contendo ${selectedProtocolos.length} pendências para acompanhamento gerencial.</p>
    </div>

    <!-- ROTEIRO DE CORREÇÃO -->
    <div class="instruction-card">
      <h3>📋 Direcionamento de Acompanhamento</h3>
      <ol>
        <li>Priorizar os protocolos com maior tempo de permanência.</li>
        <li>Encaminhar os itens aos setores responsáveis pela regularização.</li>
        <li>Acompanhar a evolução das pendências na próxima auditoria.</li>
        <li>Validar a redução dos riscos operacionais no painel FIORIX.</li>
      </ol>
    </div>

    <div class="section-title">Detalhamento de Pendências por Setor</div>

    ${Object.entries(groupedBySetor).map(([setor, itens]) => `
      <div class="setor-group">
        <div class="setor-name">
          📁 Setor: ${setor}
        </div>
        <table>
          <thead>
            <tr>
              <th class="col-check">OK</th>
              <th>Protocolo</th>
              <th>Cliente</th>
              <th>Fase Atual</th>
              <th>Andamento Ausente</th>
              <th>Parado</th>
              <th>Responsável</th>
            </tr>
          </thead>
          <tbody>
            ${itens.map((p) => `
              <tr>
                <td class="col-check"><input type="checkbox" style="transform: scale(1.1);"></td>
                <td style="font-weight: 700;"># ${p.id}</td>
                <td>${p.cliente}</td>
                <td>${p.fase}</td>
                <td>
                  <span class="badge-falta ${p.falta === 76 ? "badge-76" : "badge-75"}">
                    ID ${p.falta} (${p.falta === 76 ? "BALCÃO REGISTRADO" : "BALCÃO DEVOLVIDO"})
                  </span>
                </td>
                <td style="font-weight: 600;">${p.dias}d</td>
                <td>${p.responsavel}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `).join("")}

    <!-- ASSINATURAS MANUAIS -->
    <div class="section-title" style="margin-top: 40px;">Validação e Assinatura por Setor</div>
    <div class="sign-section">
      <div class="sign-box">
        Responsável pelo Setor / Conferência
        <br><br>
        Assinatura: ___________________________
      </div>
      <div class="sign-box">
        Responsável pelo Setor / Balcão
        <br><br>
        Assinatura: ___________________________
      </div>
    </div>

    <div class="footer">
      <div class="qr-placeholder">
        <!-- SVG simulado de QR Code -->
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="2" width="6" height="6" />
          <rect x="16" y="2" width="6" height="6" />
          <rect x="2" y="16" width="6" height="6" />
          <rect x="9" y="9" width="6" height="6" fill="currentColor" opacity="0.1" />
          <path d="M9 2h3m0 4v3m4-4h3m-7 13h3m0-4v3" />
        </svg>
        <span>Código de Verificação de Auditoria</span>
      </div>
      FIORIX COMPLIANCE • Gerado por Henrique em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}
      <br>
      <button class="print-button" onclick="window.print()">🖨️ Imprimir para Assinatura</button>
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
