import { getCurrentUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type RelatorioRow = {
  protocolo: number;
  dataApresentado: Date | null;
  natureza: string | null;
  d4Qualificacao: Date | null;
  d8Impressao: Date | null;
  d9Preparacao: Date | null;
  d9Conferencia: Date | null;
  dBalcaoDevolvido: Date | null;
  hasDevolucao: boolean;
};

type RelatorioProtocolo = {
  id: string;
  cliente: string;
  fase: string;
  falta: 75 | 76;
  dias: number;
  setor: string;
  responsavel: string;
  dataUltAndamento: string;
};

const QR_VERSION = 3;
const QR_SIZE = 17 + QR_VERSION * 4;
const QR_DATA_CODEWORDS = 55;
const QR_EC_CODEWORDS = 15;

function toBits(value: number, length: number) {
  return Array.from({ length }, (_, index) => (value >> (length - index - 1)) & 1);
}

function createGaloisTables() {
  const exp = new Array<number>(512).fill(0);
  const log = new Array<number>(256).fill(0);
  let value = 1;

  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }

  for (let index = 255; index < 512; index += 1) {
    exp[index] = exp[index - 255];
  }

  return { exp, log };
}

function multiplyGalois(a: number, b: number, exp: number[], log: number[]) {
  if (a === 0 || b === 0) return 0;
  return exp[log[a] + log[b]];
}

function createErrorCorrection(data: number[]) {
  const { exp, log } = createGaloisTables();
  let generator = [1];

  for (let index = 0; index < QR_EC_CODEWORDS; index += 1) {
    const next = new Array<number>(generator.length + 1).fill(0);
    generator.forEach((coefficient, coefficientIndex) => {
      next[coefficientIndex] ^= multiplyGalois(coefficient, exp[index], exp, log);
      next[coefficientIndex + 1] ^= coefficient;
    });
    generator = next;
  }

  const result = new Array<number>(QR_EC_CODEWORDS).fill(0);
  data.forEach((codeword) => {
    const factor = codeword ^ result.shift()!;
    result.push(0);
    generator.slice(1).forEach((coefficient, index) => {
      result[index] ^= multiplyGalois(coefficient, factor, exp, log);
    });
  });

  return result;
}

function encodeQrData(text: string) {
  const bytes = Array.from(new TextEncoder().encode(text.slice(0, 53)));
  const bits = [
    ...toBits(0b0100, 4),
    ...toBits(bytes.length, 8),
    ...bytes.flatMap((byte) => toBits(byte, 8)),
  ];

  const maxBits = QR_DATA_CODEWORDS * 8;
  bits.push(...new Array(Math.min(4, maxBits - bits.length)).fill(0));
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(parseInt(bits.slice(index, index + 8).join(""), 2));
  }

  while (data.length < QR_DATA_CODEWORDS) {
    data.push(data.length % 2 === 0 ? 0xec : 0x11);
  }

  return [...data, ...createErrorCorrection(data)];
}

function createQrSvg(text: string) {
  const modules = Array.from({ length: QR_SIZE }, () => new Array<boolean>(QR_SIZE).fill(false));
  const reserved = Array.from({ length: QR_SIZE }, () => new Array<boolean>(QR_SIZE).fill(false));

  const setModule = (row: number, col: number, value: boolean, isReserved = true) => {
    if (row < 0 || col < 0 || row >= QR_SIZE || col >= QR_SIZE) return;
    modules[row][col] = value;
    if (isReserved) reserved[row][col] = true;
  };

  const addFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row + r;
        const cc = col + c;
        const isFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setModule(rr, cc, isFinder);
      }
    }
  };

  const addAlignment = (centerRow: number, centerCol: number) => {
    for (let r = -2; r <= 2; r += 1) {
      for (let c = -2; c <= 2; c += 1) {
        const isDark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        setModule(centerRow + r, centerCol + c, isDark);
      }
    }
  };

  addFinder(0, 0);
  addFinder(0, QR_SIZE - 7);
  addFinder(QR_SIZE - 7, 0);
  addAlignment(22, 22);

  for (let index = 8; index < QR_SIZE - 8; index += 1) {
    setModule(6, index, index % 2 === 0);
    setModule(index, 6, index % 2 === 0);
  }
  setModule(4 * QR_VERSION + 9, 8, true);

  const codewordBits = encodeQrData(text).flatMap((byte) => toBits(byte, 8));
  let bitIndex = 0;
  let direction = -1;

  for (let col = QR_SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let step = 0; step < QR_SIZE; step += 1) {
      const row = direction === -1 ? QR_SIZE - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const currentCol = col - offset;
        if (reserved[row][currentCol]) continue;

        const rawBit = bitIndex < codewordBits.length ? codewordBits[bitIndex] === 1 : false;
        const maskedBit = rawBit !== ((row + currentCol) % 2 === 0);
        setModule(row, currentCol, maskedBit, false);
        bitIndex += 1;
      }
    }
    direction *= -1;
  }

  const formatBits = "111011111000100".split("").map((bit) => bit === "1");
  const formatPositionsA = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  const formatPositionsB = [[QR_SIZE - 1, 8], [QR_SIZE - 2, 8], [QR_SIZE - 3, 8], [QR_SIZE - 4, 8], [QR_SIZE - 5, 8], [QR_SIZE - 6, 8], [QR_SIZE - 7, 8], [8, QR_SIZE - 8], [8, QR_SIZE - 7], [8, QR_SIZE - 6], [8, QR_SIZE - 5], [8, QR_SIZE - 4], [8, QR_SIZE - 3], [8, QR_SIZE - 2], [8, QR_SIZE - 1]];
  formatBits.forEach((bit, index) => {
    setModule(formatPositionsA[index][0], formatPositionsA[index][1], bit);
    setModule(formatPositionsB[index][0], formatPositionsB[index][1], bit);
  });

  const scale = 3;
  const quiet = 4;
  const size = (QR_SIZE + quiet * 2) * scale;
  const rects = modules
    .flatMap((row, rowIndex) =>
      row.map((isDark, colIndex) =>
        isDark ? `<rect x="${(colIndex + quiet) * scale}" y="${(rowIndex + quiet) * scale}" width="${scale}" height="${scale}" />` : ""
      )
    )
    .join("");

  return `<svg width="96" height="96" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR Code de verificacao"><rect width="${size}" height="${size}" fill="#ffffff" rx="6" /> <g fill="#111827">${rects}</g></svg>`;
}

export async function GET(request: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return new Response("Não autorizado", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: sessionUser.email },
    });

    if (!user) {
      return new Response("Usuário não encontrado", { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const protocolsRaw = searchParams.get("protocolos") || "";
    const protocolIds = protocolsRaw
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    const rawProtocolos = protocolIds.length > 0
      ? await prisma.$queryRaw<RelatorioRow[]>(
        Prisma.sql`
          WITH eventos_bi AS (
            SELECT
              b.tenant_id,
              b."Protocolo" AS protocolo,
              BOOL_OR(COALESCE(b."IsRegistrado", false)) AS has_registro,
              BOOL_OR(COALESCE(b."IsDevolucao", false)) AS has_devolucao
            FROM public.fiorix_bi_data b
            WHERE b.tenant_id = ${user.tenantId}
            GROUP BY b.tenant_id, b."Protocolo"
          ),
          eventos_prod AS (
            SELECT
              p.tenant_id,
              p.pedido::text AS protocolo,
              BOOL_OR(p.tipo_detalhado ILIKE '%Registrado%') AS has_registro,
              BOOL_OR(
                p.tipo_detalhado ILIKE '%Devolver%'
                OR p.tipo_detalhado ILIKE '%Devolu%'
              ) AS has_devolucao
            FROM public.fiorix_produtividade_dados p
            WHERE p.tenant_id = ${user.tenantId}
            GROUP BY p.tenant_id, p.pedido
          ),
          eventos AS (
            SELECT
              tenant_id,
              protocolo,
              BOOL_OR(has_registro) AS has_registro,
              BOOL_OR(has_devolucao) AS has_devolucao
            FROM (
              SELECT * FROM eventos_bi
              UNION ALL
              SELECT * FROM eventos_prod
            ) fontes
            GROUP BY tenant_id, protocolo
          )
          SELECT
            m.protocolo,
            m.data_apresentado AS "dataApresentado",
            m.natureza,
            m.d4_qualificacao AS "d4Qualificacao",
            m.d8_impressao AS "d8Impressao",
            m.d9_preparacao AS "d9Preparacao",
            m.d9_conferencia AS "d9Conferencia",
            m.d_balcao_devolvido AS "dBalcaoDevolvido",
            e.has_devolucao AS "hasDevolucao"
          FROM public.fiorix_metas_dados m
          JOIN eventos e
            ON e.tenant_id = m.tenant_id
            AND e.protocolo = m.protocolo::text
          WHERE m.tenant_id = ${user.tenantId}
            AND m.protocolo IN (${Prisma.join(protocolIds)})
            AND (
              (e.has_registro = true AND m.d_balcao_registrado IS NULL)
              OR (e.has_devolucao = true AND m.d_balcao_devolvido IS NULL)
            )
          ORDER BY m.protocolo ASC
        `
      )
      : [];

    const selectedProtocolos: RelatorioProtocolo[] = rawProtocolos.map((p) => {
      let fase = "Apresentação";
      let setor = "Qualificação";

      if (p.d9Conferencia) {
        fase = "Conferência";
        setor = "Conferência";
      } else if (p.d9Preparacao) {
        fase = "Preparação";
        setor = "Preparação";
      } else if (p.d8Impressao) {
        fase = "Impressão";
        setor = "Impressão";
      } else if (p.d4Qualificacao) {
        fase = "Exame Formal";
        setor = "Qualificação";
      }

      const start = p.dataApresentado ? new Date(p.dataApresentado) : new Date();
      const diffTime = Math.abs(new Date().getTime() - start.getTime());
      const dias = Math.min(60, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1);

      const lastDate = p.d9Conferencia || p.d9Preparacao || p.d8Impressao || p.d4Qualificacao || p.dataApresentado;
      let dataUltAndamento = "-";
      if (lastDate) {
        const d = new Date(lastDate);
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const year = d.getFullYear();
          dataUltAndamento = `${day}/${month}/${year}`;
        }
      }

      return {
        id: String(p.protocolo),
        cliente: p.natureza || "Instrumento Particular",
        fase,
        falta: p.hasDevolucao && !p.dBalcaoDevolvido ? 75 : 76,
        dias,
        setor,
        responsavel: setor,
        dataUltAndamento,
      };
    });

    // Group by sector
    const groupedBySetor: Record<string, RelatorioProtocolo[]> = {};
    selectedProtocolos.forEach((p) => {
      if (!groupedBySetor[p.setor]) {
        groupedBySetor[p.setor] = [];
      }
      groupedBySetor[p.setor].push(p);
    });

    const verificationSeed = `${user.tenantId}|${selectedProtocolos.map((p) => p.id).join(",")}|${selectedProtocolos.length}`;
    const verificationHash = Array.from(verificationSeed).reduce(
      (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0,
      0
    );
    const verificationCode = `FIORIX-AUD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${selectedProtocolos.length}-${verificationHash.toString(36).toUpperCase()}`;
    const qrSvg = createQrSvg(verificationCode);

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
      <h2>Relatório Executivo de Andamentos WEBRI Pendentes</h2>
      <p style="color: #64748b; font-size: 13px;">
        Documento gerado em ${new Date().toLocaleString("pt-BR")} contendo ${selectedProtocolos.length} protocolo(s) sem o andamento WEBRI esperado:
        <strong>BALCÃO REGISTRADO</strong> ou <strong>BALCÃO DEVOLVIDO</strong>.
      </p>
    </div>

    <!-- ROTEIRO DE CORREÇÃO -->
    <div class="instruction-card">
      <h3>📋 Direcionamento de Acompanhamento</h3>
      <ol>
        <li>Priorizar os protocolos com maior tempo de permanência sem andamento WEBRI.</li>
        <li>Regularizar o andamento ausente: <strong>BALCÃO REGISTRADO</strong> ou <strong>BALCÃO DEVOLVIDO</strong>.</li>
        <li>Encaminhar os itens aos setores responsáveis pela conferência e registro do andamento.</li>
        <li>Acompanhar a redução das pendências no painel FIORIX após a regularização.</li>
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
              <th>Natureza</th>
              <th>Fase Atual</th>
              <th>Andamento Ausente</th>
              <th>Parado</th>
              <th>Data Últ. Andamento</th>
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
                    ${p.falta === 76 ? "Balcão registrado pendente" : "Balcão devolvido pendente"}
                  </span>
                </td>
                <td style="font-weight: 600;">${p.dias}d</td>
                <td>${p.dataUltAndamento}</td>
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
        ${qrSvg}
        <span>Código de Verificação: ${verificationCode}</span>
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(`Erro ao gerar relatório: ${message}`, { status: 500 });
  }
}
