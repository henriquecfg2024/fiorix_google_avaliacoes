import React from "react";
import Link from "next/link";
import { ArrowLeft, Landmark } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  diagnosticarAdaptadoresCartorioVirtual,
  gerarScriptGrantSelectSomenteLeitura,
} from "@/lib/cartorio-virtual/adapters";
import { DICIONARIO_MARCADORES_SIPLAN } from "@/lib/cartorio-virtual/mapping-dictionary";
import { exigirCapacidadeCartorioVirtual } from "@/lib/cartorio-virtual/permissions";
import { listarRegrasGovernancaCartorioVirtual } from "@/lib/cartorio-virtual/repository";
import { CATALOGO_AGENTES_VIRTUAIS, type PapelRegistral } from "@/lib/cartorio-virtual/types";
import { GovernancaCartorioVirtualClient } from "@/components/cartorio-virtual/GovernancaCartorioVirtualClient";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesCartorioVirtualPage() {
  const ctx = await exigirCapacidadeCartorioVirtual("configurar_regras");

  const [adaptadores, regras, usersDb] = await Promise.all([
    diagnosticarAdaptadoresCartorioVirtual(ctx.tenantId),
    listarRegrasGovernancaCartorioVirtual(ctx.tenantId),
    prisma.user
      .findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, role: true },
      })
      .catch(() => []),
  ]);

  const autorizacoesMap = new Map<string, { papel: PapelRegistral; ativo: boolean }>();
  if (!ctx.migracaoTabelaPendente) {
    try {
      const authRows = await prisma.fiorixCvAutorizacao.findMany({
        where: { tenantId: ctx.tenantId },
        select: { usuarioId: true, papelRegistral: true, ativo: true },
      });
      for (const r of authRows) {
        autorizacoesMap.set(r.usuarioId, {
          papel: r.papelRegistral as PapelRegistral,
          ativo: r.ativo,
        });
      }
    } catch {
      // Tabela pendente de migração local
    }
  }

  const usuarios = usersDb.map((u) => {
    const outorga = autorizacoesMap.get(u.id);
    return {
      id: u.id,
      nome: u.name || u.email,
      email: u.email,
      roleSistema: String(u.role),
      papelRegistralAtual: outorga?.ativo
        ? outorga.papel
        : ("SEM_ATRIBUICAO_REGISTRAL" as PapelRegistral),
      ativoRegistral: Boolean(outorga?.ativo),
    };
  });

  return (
    <div className="min-h-screen bg-[#070A12] text-white pb-16">
      <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5 text-xs font-mono">
            <Landmark className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">SISTEMA &amp; TECNOLOGIA</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-bold">GOVERNANÇA DO CARTÓRIO VIRTUAL</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/cartorio-virtual"
              className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-3.5 py-1.5 text-xs font-semibold text-cyan-300"
            >
              Abrir Operação Cartório Virtual
            </Link>
            <Link
              href="/configuracoes"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] px-3.5 py-1.5 text-xs text-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              Voltar a Configurações
            </Link>
          </div>
        </div>

        <GovernancaCartorioVirtualClient
          tenantNome={ctx.tenantNome}
          migracaoPendente={ctx.migracaoTabelaPendente}
          adaptadores={adaptadores}
          scriptGrantSelectSql={gerarScriptGrantSelectSomenteLeitura("fiorix_connector")}
          agentesVirtuais={CATALOGO_AGENTES_VIRTUAIS}
          regras={regras}
          marcadoresSiplan={DICIONARIO_MARCADORES_SIPLAN}
          usuarios={usuarios}
        />
      </div>
    </div>
  );
}

