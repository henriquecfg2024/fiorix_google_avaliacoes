"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  Check,
  ShieldCheck,
  Bot,
  Database,
  UserCog,
  FileCode2,
  Loader2,
  Lock,
} from "lucide-react";
import { salvarAutorizacaoRegistralUsuarioAction } from "@/app/actions/cartorio-virtual";
import type { DiagnosticoAdaptadorIntegracao } from "@/lib/cartorio-virtual/adapters";
import type { MapeamentoMarcadorSiplan } from "@/lib/cartorio-virtual/mapping-dictionary";
import {
  PAPEIS_REGISTRAIS_LABELS,
  type DefinicaoAgenteVirtual,
  type PapelRegistral,
} from "@/lib/cartorio-virtual/types";

interface UsuarioServentiaItem {
  id: string;
  nome: string;
  email: string;
  roleSistema: string;
  papelRegistralAtual: PapelRegistral;
  ativoRegistral: boolean;
}

interface RegraVersaoItem {
  id: string;
  codigoRegra: string;
  versao: number;
  titulo: string;
  especieAlvo: string;
  ativa: boolean;
  validadaJuridicamente: boolean;
  textoModelo: string;
  aprovadoPorNome: string | null;
  criadoEmBr: string;
}

interface GovernancaProps {
  tenantNome: string;
  migracaoPendente: boolean;
  adaptadores: DiagnosticoAdaptadorIntegracao[];
  scriptGrantSelectSql: string;
  agentesVirtuais: DefinicaoAgenteVirtual[];
  regras: RegraVersaoItem[];
  marcadoresSiplan: MapeamentoMarcadorSiplan[];
  usuarios: UsuarioServentiaItem[];
}

export function GovernancaCartorioVirtualClient({
  tenantNome,
  migracaoPendente,
  adaptadores,
  scriptGrantSelectSql,
  agentesVirtuais,
  regras,
  marcadoresSiplan,
  usuarios,
}: GovernancaProps) {
  const router = useRouter();
  const [copiadoSql, setCopiadoSql] = useState(false);
  const [usuarioSelId, setUsuarioSelId] = useState(usuarios[0]?.id || "");
  const [papelNovo, setPapelNovo] = useState<PapelRegistral>("ESCREVENTE_AUTORIZADO");
  const [observacoesOutorga, setObservacoesOutorga] = useState("");
  const [salvandoOutorga, setSalvandoOutorga] = useState(false);

  const copiarScriptSql = async () => {
    try {
      await navigator.clipboard.writeText(scriptGrantSelectSql);
      setCopiadoSql(true);
      toast.success("Script GRANT SELECT somente leitura copiado para a área de transferência.");
      setTimeout(() => setCopiadoSql(false), 2500);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleSalvarOutorga = async (e: React.FormEvent) => {
    e.preventDefault();
    const usr = usuarios.find((u) => u.id === usuarioSelId);
    if (!usr) {
      toast.error("Selecione um usuário da serventia.");
      return;
    }
    setSalvandoOutorga(true);
    try {
      await salvarAutorizacaoRegistralUsuarioAction({
        usuarioAlvoId: usr.id,
        usuarioAlvoNome: usr.nome,
        papelRegistral: papelNovo,
        ativo: papelNovo !== "SEM_ATRIBUICAO_REGISTRAL",
        observacoes: observacoesOutorga,
      });
      toast.success(`Atribuição registral atualizada para ${usr.nome}.`);
      setObservacoesOutorga("");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar atribuição registral.");
    } finally {
      setSalvandoOutorga(false);
    }
  };

  const corEstadoAdaptador = (estado: DiagnosticoAdaptadorIntegracao["estado"]) => {
    if (estado === "ONLINE") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    if (estado === "DESABILITADO_NO_PILOTO")
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    if (estado === "SEM_PERMISSAO_SELECT" || estado === "ATRASADO")
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  };

  return (
    <div className="space-y-6">
      {/* 1. Travas de Segurança do Piloto */}
      <div className="rounded-[24px] border border-cyan-500/30 bg-[#0B1020]/90 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Lock className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">
            Travas Inegociáveis do Piloto — {tenantNome}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {[
            { titulo: "Banco SQL WEBRI", status: "SOMENTE LEITURA (SELECT)" },
            { titulo: "Emissão Automática", status: "DESABILITADA NO PILOTO" },
            { titulo: "Assinatura A1/A3 Auto", status: "DESABILITADA NO PILOTO" },
            { titulo: "Entrega Auto (ONR/WhatsApp)", status: "DESABILITADA NO PILOTO" },
            { titulo: "Custo Adicional Mensal", status: "US$ 0,00 / mês (Teto US$ 50)" },
          ].map((item) => (
            <div
              key={item.titulo}
              className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 space-y-1"
            >
              <div className="text-[11px] text-slate-400">{item.titulo}</div>
              <div className="font-mono font-bold text-cyan-300">{item.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Estado dos Adaptadores e Connector + Script GRANT SELECT */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">
            Integrações, Connector Somente Leitura e Script DBA (SRVSQL\WEBRI)
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {adaptadores.map((ad) => (
            <div
              key={ad.id}
              className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white">{ad.nome}</div>
                  <div className="text-[11px] text-slate-400">{ad.sistemaAlvo}</div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${corEstadoAdaptador(
                    ad.estado
                  )}`}
                >
                  {ad.estado}
                </span>
              </div>
              <p className="text-xs text-slate-300">{ad.mensagemOperacional}</p>
              {ad.acaoRecomendadaTI && (
                <div className="text-[11px] text-amber-300">TI: {ad.acaoRecomendadaTI}</div>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-indigo-500/30 bg-[#070A12] p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-indigo-300">
              Script DBA Homologado — Permissão Estritamente SELECT para [fiorix_connector] (Zero
              Objetos Criados)
            </span>
            <button
              type="button"
              onClick={copiarScriptSql}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] px-3 py-1.5 text-xs text-white"
            >
              {copiadoSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiadoSql ? "Copiado" : "Copiar SQL"}
            </button>
          </div>
          <pre className="text-[11px] font-mono text-cyan-200 overflow-x-auto leading-relaxed">
            {scriptGrantSelectSql}
          </pre>
        </div>
      </div>

      {/* 3. Outorga de Competências Registrais (Separada de ADMIN de TI — Seção 14) */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <UserCog className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-bold text-white">
              Autorizações Funcionais e Registrais por Pessoa (Seção 14)
            </h2>
            <p className="text-xs text-slate-400">
              ADMIN de sistema não recebe competência registral automática. Atribua formalmente
              Oficial, Substituto ou Escrevente Autorizado.
            </p>
          </div>
        </div>

        {migracaoPendente && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Nota: a tabela PostgreSQL <code>fiorix_cv_autorizacoes</code> está preparada na
            migration local <code>20261107120000_cartorio_virtual_piloto</code> e aguarda sua
            autorização explícita antes de qualquer aplicação em banco compartilhado.
          </div>
        )}

        <form
          onSubmit={handleSalvarOutorga}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-2"
        >
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Usuário da Serventia</label>
            <select
              value={usuarioSelId}
              onChange={(e) => setUsuarioSelId(e.target.value)}
              className="w-full rounded-xl bg-[#0F1629] border border-white/15 px-3 py-2 text-xs text-white"
            >
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.roleSistema})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Papel Registral</label>
            <select
              value={papelNovo}
              onChange={(e) => setPapelNovo(e.target.value as PapelRegistral)}
              className="w-full rounded-xl bg-[#0F1629] border border-white/15 px-3 py-2 text-xs text-white"
            >
              {(Object.keys(PAPEIS_REGISTRAIS_LABELS) as PapelRegistral[]).map((p) => (
                <option key={p} value={p}>
                  {PAPEIS_REGISTRAIS_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Portaria / Observação de Outorga
            </label>
            <input
              type="text"
              value={observacoesOutorga}
              onChange={(e) => setObservacoesOutorga(e.target.value)}
              placeholder="Ex: Portaria Interna 7º RI-SP"
              className="w-full rounded-xl bg-white/[0.04] border border-white/15 px-3 py-2 text-xs text-white"
            />
          </div>

          <button
            type="submit"
            disabled={salvandoOutorga || usuarios.length === 0}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs py-2 px-4 inline-flex items-center justify-center gap-2"
          >
            {salvandoOutorga && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar Autorização
          </button>
        </form>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-[11px] uppercase">
                <th className="py-2 pr-3">Colaborador</th>
                <th className="py-2 px-3">E-mail</th>
                <th className="py-2 px-3">Perfil Técnico FIORIX</th>
                <th className="py-2 pl-3">Papel Registral Outorgado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 pr-3 font-semibold text-white">{u.nome}</td>
                  <td className="py-2.5 px-3 text-slate-400">{u.email}</td>
                  <td className="py-2.5 px-3 font-mono text-indigo-300">{u.roleSistema}</td>
                  <td className="py-2.5 pl-3 text-cyan-300">
                    {PAPEIS_REGISTRAIS_LABELS[u.papelRegistralAtual]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Agentes Virtuais Especializados (Sem Fé Pública) */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Bot className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">
            Agentes Virtuais Especializados (Operação Técnica Determinística)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agentesVirtuais.map((ag) => (
            <div
              key={ag.id}
              className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-1.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{ag.nome}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                  {ag.id}
                </span>
              </div>
              <p className="text-slate-300">{ag.responsabilidadeTecnica}</p>
              <p className="text-[11px] text-amber-300">Vedação jurídica: {ag.vedacaoJuridica}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Regras Versionadas e Modelos Homologáveis */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">
            Regras de Conferência e Modelos Textuais Versionados
          </h2>
        </div>
        <div className="space-y-3">
          {regras.map((reg) => (
            <div
              key={reg.id}
              className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-white">
                  {reg.codigoRegra} (v{reg.versao}) — {reg.titulo}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    reg.validadaJuridicamente
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {reg.validadaJuridicamente
                    ? "VALIDADA PELO OFICIAL"
                    : "AGUARDANDO HOMOLOGAÇÃO JURÍDICA DO OFICIAL"}
                </span>
              </div>
              <pre className="rounded-xl bg-[#070A12] border border-white/10 p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                {reg.textoModelo}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Dicionário Auditável dos 19 Marcadores SIPLAN RTF/SQL */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <FileCode2 className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">
            Dicionário Canônico SIPLAN RTF × SQL WEBRI ({marcadoresSiplan.length} marcadores)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                <th className="py-2 pr-3">Marcador RTF</th>
                <th className="py-2 px-3">Pág.</th>
                <th className="py-2 px-3">Campo FIORIX</th>
                <th className="py-2 px-3">Origem SQL / Regra</th>
                <th className="py-2 pl-3">Confirmação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {marcadoresSiplan.map((m) => (
                <tr key={m.marcadorRtf}>
                  <td className="py-2 pr-3 font-mono text-cyan-300">{m.marcadorRtf}</td>
                  <td className="py-2 px-3 font-mono text-slate-300">{m.paginaPdf}</td>
                  <td className="py-2 px-3 font-mono text-indigo-300">{m.campoFiorix}</td>
                  <td className="py-2 px-3 text-slate-300">
                    <div>{m.origemSqlIdentificada}</div>
                    <div className="text-[11px] text-slate-500">{m.regraSaneamentoSentinela}</div>
                  </td>
                  <td className="py-2 pl-3 font-mono text-[11px] text-slate-300">
                    {m.nivelConfirmacao}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

