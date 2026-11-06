"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  UserPlus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EscalaItem } from "@/lib/ferias/ferias-repository";
import {
  calcularIdadeCompleta,
  limparCpfReal,
} from "@/lib/ferias/idade-calculator";
import { validarRegrasCLTFerias } from "@/lib/ferias/clt-validator";
import { criarColaboradorManualFeriasAction } from "@/app/actions/ferias";
import { toast } from "sonner";

interface NovoColaboradorFeriasModalProps {
  open: boolean;
  onClose: () => void;
  anoSelecionado: number;
  setoresExistentes?: string[];
  onCreated: (novoItem: EscalaItem) => Promise<void> | void;
}

const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const SETORES_PADRAO = [
  "Atendimento",
  "Balcão",
  "Administrativo",
  "Registro",
  "Prenotação",
  "Certidões",
  "Financeiro",
  "Recursos Humanos",
  "Impressão/Arquivo",
  "TI",
];

function aplicarMascaraCpf(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  }
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

export function NovoColaboradorFeriasModal({
  open,
  onClose,
  anoSelecionado,
  setoresExistentes = [],
  onCreated,
}: NovoColaboradorFeriasModalProps) {
  const [nome, setNome] = useState("");
  const [registro, setRegistro] = useState("");
  const [apelido, setApelido] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [naturalidade, setNaturalidade] = useState("São Paulo");
  const [uf, setUf] = useState("SP");
  const [nacionalidade, setNacionalidade] = useState("Brasileiro(a)");

  const [setorSelecionado, setSetorSelecionado] = useState("Atendimento");
  const [setorCustom, setSetorCustom] = useState("");
  const [cargo, setCargo] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");

  const [programarAgora, setProgramarAgora] = useState(false);
  const [p1Inicio, setP1Inicio] = useState("");
  const [p1Fim, setP1Fim] = useState("");
  const [p1Dias, setP1Dias] = useState(15);
  const [observacao, setObservacao] = useState("");

  const [erroForm, setErroForm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const opcoesSetor = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of [...SETORES_PADRAO, ...setoresExistentes]) {
      const limpo = (s || "").trim();
      if (limpo && !map.has(limpo.toLowerCase())) {
        map.set(limpo.toLowerCase(), limpo);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [setoresExistentes]);

  useEffect(() => {
    if (open) {
      setNome("");
      setRegistro("");
      setApelido("");
      setCpf("");
      setDataNascimento("");
      setSexo("");
      setEstadoCivil("");
      setNaturalidade("São Paulo");
      setUf("SP");
      setNacionalidade("Brasileiro(a)");
      setSetorSelecionado(opcoesSetor[0] || "Atendimento");
      setSetorCustom("");
      setCargo("");
      setDataAdmissao("");
      setProgramarAgora(false);
      setP1Inicio(`${anoSelecionado}-01-10`);
      setP1Fim(`${anoSelecionado}-01-24`);
      setP1Dias(15);
      setObservacao("");
      setErroForm(null);
    }
  }, [open, anoSelecionado, opcoesSetor]);

  useEffect(() => {
    if (p1Inicio && p1Fim) {
      const d1 = new Date(`${p1Inicio}T00:00:00Z`);
      const d2 = new Date(`${p1Fim}T00:00:00Z`);
      const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setP1Dias(Math.max(1, diff));
    }
  }, [p1Inicio, p1Fim]);

  if (!open) return null;

  const idadePreview = calcularIdadeCompleta(dataNascimento || null);
  const cpfDigits = cpf.replace(/\D/g, "");
  const cpfValido = cpfDigits.length === 0 || (cpfDigits.length === 11 && Boolean(limparCpfReal(cpfDigits)));

  const cltPreview = programarAgora
    ? validarRegrasCLTFerias([{ inicio: p1Inicio, fim: p1Fim, dias: p1Dias }])
    : { valido: true, erros: [] as string[], alertas: [] as string[] };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm(null);

    if (nome.trim().length < 3) {
      setErroForm("Informe o nome completo do colaborador (mínimo 3 caracteres).");
      return;
    }

    if (cpfDigits.length > 0 && !cpfValido) {
      setErroForm("O CPF informado é inválido. Verifique os 11 dígitos ou deixe em branco.");
      return;
    }

    const setorFinal =
      setorSelecionado === "__OUTRO__" ? setorCustom.trim() : setorSelecionado.trim();
    if (!setorFinal) {
      setErroForm("Informe o setor de atuação do colaborador.");
      return;
    }

    if (programarAgora && !cltPreview.valido) {
      setErroForm(cltPreview.erros.join(" "));
      return;
    }

    setSaving(true);
    try {
      const res = await criarColaboradorManualFeriasAction({
        nome: nome.trim(),
        registro: registro.trim() !== "" ? Number(registro) : null,
        apelido: apelido.trim() || null,
        cpf: cpfDigits.length === 11 ? cpfDigits : null,
        dataNascimento: dataNascimento || null,
        sexo: sexo || null,
        estadoCivil: estadoCivil || null,
        naturalidade: naturalidade.trim() || null,
        uf: uf || null,
        nacionalidade: nacionalidade.trim() || "Brasileiro(a)",
        dataAdmissao: dataAdmissao || null,
        setor: setorFinal,
        cargo: cargo.trim() || null,
        ano: anoSelecionado,
        p1Inicio: programarAgora ? p1Inicio : null,
        p1Fim: programarAgora ? p1Fim : null,
        p1Dias: programarAgora ? p1Dias : 0,
        observacao: observacao.trim() || null,
      });

      if (!res.success || !res.item) {
        setErroForm(res.erro || "Não foi possível cadastrar o colaborador.");
        return;
      }

      toast.success(`Colaborador "${res.item.nome}" adicionado ao FIORIX com sucesso.`);
      await onCreated(res.item);
      onClose();
    } catch (err: any) {
      setErroForm(err?.message || "Erro inesperado ao cadastrar colaborador.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[24px] border border-white/15 bg-[#0B1020] shadow-2xl text-white"
      >
        {/* Header Executivo FIORIX */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-white/10 bg-[#0B1020]/95 sticky top-0 z-10 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Novo Colaborador · Cadastro Manual FIORIX
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inclusão direta na Escala {anoSelecionado} • Cadastro protegido contra sobrescrita na sincronização
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {erroForm && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{erroForm}</span>
            </div>
          )}

          {/* SEÇÃO 1: DADOS PESSOAIS */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              1. Dados Pessoais do Colaborador
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Nome Completo <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="Ex: Maria Clara de Souza"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="h-10 bg-[#080D1A] border-white/15 text-xs text-white rounded-xl"
                />
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Nº Registro (Opcional)
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ex: 135"
                  value={registro}
                  onChange={(e) => setRegistro(e.target.value)}
                  className="h-10 bg-[#080D1A] border-white/15 text-xs font-mono text-white rounded-xl"
                />
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Apelido / Conhecido como
                </label>
                <Input
                  type="text"
                  placeholder="Opcional"
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                  className="h-10 bg-[#080D1A] border-white/15 text-xs text-white rounded-xl"
                />
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">CPF (Opcional)</label>
                  {cpfDigits.length === 11 && (
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        cpfValido ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {cpfValido ? "CPF válido" : "CPF inválido"}
                    </span>
                  )}
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(aplicarMascaraCpf(e.target.value))}
                  className="h-10 bg-[#080D1A] border-white/15 text-xs font-mono text-white rounded-xl"
                />
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Data de Nascimento</label>
                <Input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="h-10 bg-[#080D1A] border-white/15 text-xs font-mono text-white rounded-xl"
                />
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Idade Atual (Automática)
                </label>
                <div className="h-10 px-3 rounded-xl bg-[#080D1A] border border-cyan-500/20 flex items-center text-xs">
                  {idadePreview ? (
                    <span className="font-semibold text-cyan-300 truncate" title={idadePreview.extenso}>
                      {idadePreview.extenso}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">
                      Informe a data de nascimento
                    </span>
                  )}
                </div>
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Sexo</label>
                <select
                  value={sexo}
                  onChange={(e) => setSexo(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#080D1A] border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="" className="bg-[#0B1020]">Não informado</option>
                  <option value="Masculino" className="bg-[#0B1020]">Masculino</option>
                  <option value="Feminino" className="bg-[#0B1020]">Feminino</option>
                  <option value="Outro" className="bg-[#0B1020]">Outro</option>
                </select>
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Estado Civil</label>
                <select
                  value={estadoCivil}
                  onChange={(e) => setEstadoCivil(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#080D1A] border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="" className="bg-[#0B1020]">Não informado</option>
                  <option value="Solteiro(a)" className="bg-[#0B1020]">Solteiro(a)</option>
                  <option value="Casado(a)" className="bg-[#0B1020]">Casado(a)</option>
                  <option value="União Estável" className="bg-[#0B1020]">União Estável</option>
                  <option value="Divorciado(a)" className="bg-[#0B1020]">Divorciado(a)</option>
                  <option value="Viúvo(a)" className="bg-[#0B1020]">Viúvo(a)</option>
                </select>
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Naturalidade (Cidade)</label>
                <Input
                  type="text"
                  placeholder="Ex: São Paulo"
                  value={naturalidade}
                  onChange={(e) => setNaturalidade(e.target.value)}
                  className="h-10 bg-[#080D1A] border-white/15 text-xs text-white rounded-xl"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">UF</label>
                <select
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-xl bg-[#080D1A] border border-white/15 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="" className="bg-[#0B1020]">—</option>
                  {UFS_BRASIL.map((sigla) => (
                    <option key={sigla} value={sigla} className="bg-[#0B1020]">
                      {sigla}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Nacionalidade</label>
                <Input
                  type="text"
                  placeholder="Ex: Brasileiro(a)"
                  value={nacionalidade}
                  onChange={(e) => setNacionalidade(e.target.value)}
                  className="h-10 bg-[#080D1A] border-white/15 text-xs text-white rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: LOTAÇÃO E ADMISSÃO */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              2. Vínculo & Lotação na Serventia
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Setor <span className="text-rose-400">*</span>
                </label>
                <select
                  value={setorSelecionado}
                  onChange={(e) => setSetorSelecionado(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#080D1A] border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                >
                  {opcoesSetor.map((s) => (
                    <option key={s} value={s} className="bg-[#0B1020]">
                      {s}
                    </option>
                  ))}
                  <option value="__OUTRO__" className="bg-[#0B1020]">
                    + Outro setor...
                  </option>
                </select>
                {setorSelecionado === "__OUTRO__" && (
                  <Input
                    type="text"
                    placeholder="Digite o nome do setor"
                    value={setorCustom}
                    onChange={(e) => setSetorCustom(e.target.value)}
                    className="h-9 mt-2 bg-[#080D1A] border-white/15 text-xs text-white rounded-xl"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Cargo / Função</label>
                <Input
                  type="text"
                  placeholder="Ex: Escrevente, Auxiliar..."
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="h-10 bg-[#080D1A] border-white/15 text-xs text-white rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Data de Admissão</label>
                <Input
                  type="date"
                  value={dataAdmissao}
                  onChange={(e) => setDataAdmissao(e.target.value)}
                  className="h-10 bg-[#080D1A] border-white/15 text-xs font-mono text-white rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: FÉRIAS INICIAIS OPCIONAIS */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={programarAgora}
                onChange={(e) => setProgramarAgora(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-[#080D1A] accent-cyan-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Já definir período inicial de férias para {anoSelecionado} (opcional)
              </span>
            </label>

            {programarAgora ? (
              <div className="p-4 rounded-2xl bg-[#080D1A] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    1º Período ({anoSelecionado})
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/15 px-2.5 py-0.5 rounded-full border border-cyan-500/25">
                    {p1Dias} dias
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Início</label>
                    <Input
                      type="date"
                      value={p1Inicio}
                      onChange={(e) => setP1Inicio(e.target.value)}
                      className="bg-[#0B1020] border-white/15 text-xs font-mono text-white h-9 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fim</label>
                    <Input
                      type="date"
                      value={p1Fim}
                      onChange={(e) => setP1Fim(e.target.value)}
                      className="bg-[#0B1020] border-white/15 text-xs font-mono text-white h-9 rounded-xl"
                    />
                  </div>
                </div>

                {!cltPreview.valido && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
                    {cltPreview.erros.map((er, i) => (
                      <p key={i}>{er}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 pl-6">
                O colaborador será incluído na escala de {anoSelecionado} com status{" "}
                <strong className="text-slate-200">Pendente</strong> para programação posterior.
              </p>
            )}
          </div>

          {/* Rodapé */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Registro auditado na trilha WORM • CPF protegido por mascaramento LGPD</span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-9 px-4 rounded-xl bg-[#080D1A] border-white/15 text-slate-300 hover:bg-white/10 text-xs cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || (programarAgora && !cltPreview.valido)}
                className="h-9 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-500/20 gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cadastrando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Salvar Novo Colaborador</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
