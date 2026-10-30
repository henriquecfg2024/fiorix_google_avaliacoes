'use client';

import { useEffect, useRef, useState } from 'react';
import { Monitor, MonitorUp, AppWindow, Loader2, Check } from 'lucide-react';
import {
  abrirDocumentoEmJanela,
  desfazerMemorizacaoMonitor,
  gravarPreferenciasJanelas,
  lerPreferenciasJanelas,
  listarMonitores,
  suportaSelecaoDeMonitor,
  tipoDoDocumento,
  type DocumentoJanela,
  type MonitorDisponivel,
  type PreferenciasJanelas,
} from '@/lib/documental/janelasDocumento';

interface JanelaSeparadaMenuProps {
  item: DocumentoJanela;
  /** Chamado após abrir a janela (ex.: fechar o visualizador sobreposto) */
  onAberto?: () => void;
  variant?: 'siplan' | 'dark';
}

/** Botão "Abrir em outro monitor" do visualizador de documentos */
export function JanelaSeparadaMenu({ item, onAberto, variant = 'siplan' }: JanelaSeparadaMenuProps) {
  const [aberto, setAberto] = useState(false);
  const [monitores, setMonitores] = useState<MonitorDisponivel[]>([]);
  const [detectando, setDetectando] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [pref, setPref] = useState<PreferenciasJanelas>({ sempreEmJanela: false, lembrarUltimoMonitor: true, monitorPorTipo: {} });
  const [suporte, setSuporte] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tipo = tipoDoDocumento(item.documento);

  useEffect(() => {
    setPref(lerPreferenciasJanelas());
    setSuporte(suportaSelecaoDeMonitor());
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  async function detectarMonitores() {
    setDetectando(true);
    setMonitores(await listarMonitores());
    setDetectando(false);
  }

  function abrir(monitor: MonitorDisponivel | null) {
    const ok = abrirDocumentoEmJanela(item, monitor);
    if (!ok) {
      setBloqueado(true);
      return;
    }
    if (monitor) {
      const novo = { ...pref, monitorPorTipo: { ...pref.monitorPorTipo, [tipo]: monitor.indice } };
      setPref(novo);
      gravarPreferenciasJanelas(novo);
    }
    setAberto(false);
    onAberto?.();
  }

  function alternarSempreEmJanela() {
    const novo = { ...pref, sempreEmJanela: !pref.sempreEmJanela };
    setPref(novo);
    gravarPreferenciasJanelas(novo);
  }

  const isSiplan = variant === 'siplan';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id="botao-abrir-outro-monitor"
        onClick={() => {
          setAberto(v => !v);
          setBloqueado(false);
          if (!aberto && suporte && monitores.length === 0) void detectarMonitores();
        }}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title="Abrir este documento em uma janela separada (outro monitor) para conferir lado a lado com a Ficha / Manifestação"
        className={
          isSiplan
            ? 'inline-flex items-center gap-1 rounded border border-[#C0C0C0] bg-white px-1.5 h-5 text-[11px] font-bold text-[#800000] hover:border-[#800000] hover:bg-gray-50 transition cursor-pointer'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 transition'
        }
      >
        <MonitorUp className={isSiplan ? 'h-3 w-3 text-[#800000]' : 'h-3.5 w-3.5 text-cyan-300'} />
        <span className="hidden md:inline">Outro monitor</span>
      </button>

      {aberto && (
        <div
          role="menu"
          className={
            isSiplan
              ? 'absolute right-0 top-full z-[130] mt-1 w-72 rounded border border-gray-300 bg-white p-2 text-xs text-gray-800 shadow-xl'
              : 'absolute right-0 top-full z-[130] mt-1.5 w-72 rounded-xl border border-slate-700 bg-slate-900 p-2 text-xs text-slate-200 shadow-2xl'
          }
        >
          <p className={`px-2 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-wider ${isSiplan ? 'text-[#800000]' : 'text-slate-400'}`}>
            Abrir em janela separada
          </p>

          {detectando && (
            <div className={`flex items-center gap-2 px-2 py-2 ${isSiplan ? 'text-gray-500' : 'text-slate-400'}`}>
              <Loader2 className={`h-3.5 w-3.5 animate-spin ${isSiplan ? 'text-[#800000]' : ''}`} /> Detectando monitores…
            </div>
          )}

          {!detectando && monitores.length > 0 && (
            <div className="space-y-0.5">
              {monitores.map(m => {
                const lembrado = pref.monitorPorTipo[tipo] === m.indice;
                return (
                  <button
                    key={m.indice}
                    type="button"
                    role="menuitem"
                    onClick={() => abrir(m)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition ${
                      isSiplan
                        ? lembrado
                          ? 'bg-[#FFF0F0] text-[#800000] font-bold'
                          : 'hover:bg-gray-100 text-gray-700'
                        : lembrado
                        ? 'bg-cyan-950/60 text-cyan-200'
                        : 'hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    <Monitor className={`h-4 w-4 ${isSiplan ? (lembrado ? 'text-[#800000]' : 'text-gray-500') : (lembrado ? 'text-cyan-300' : 'text-slate-400')}`} />
                    <span className="flex-1">{m.rotulo}</span>
                    <span className="font-mono text-[10px] text-gray-400">{m.width}×{m.height}</span>
                    {lembrado && <Check className={`h-3.5 w-3.5 ${isSiplan ? 'text-[#800000]' : 'text-cyan-300'}`} aria-label="Último usado para este tipo" />}
                  </button>
                );
              })}
            </div>
          )}

          {!detectando && suporte && monitores.length === 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={detectarMonitores}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition ${isSiplan ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-slate-800 text-slate-200'}`}
            >
              <Monitor className="h-4 w-4 text-gray-400" />
              <span>Detectar monitores (pedir permissão)</span>
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => abrir(null)}
            className={`mt-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition ${isSiplan ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-slate-800 text-slate-200'}`}
          >
            <AppWindow className="h-4 w-4 text-gray-400" />
            <span>Nova janela (arrastar para o monitor)</span>
          </button>

          {!suporte && (
            <p className="px-2 pt-1 text-[10px] leading-snug text-gray-500">
              Este navegador não permite escolher o monitor automaticamente. A janela abre ao lado; arraste-a para o monitor desejado.
            </p>
          )}

          {bloqueado && (
            <p className="mx-1 mt-1 rounded border border-amber-400 bg-amber-50 px-2 py-1.5 text-[10px] leading-snug text-amber-800">
              O navegador bloqueou a janela. Permita pop-ups para este site (ícone na barra de endereço) e tente novamente.
            </p>
          )}

          <div className={`mt-2 space-y-1.5 border-t ${isSiplan ? 'border-gray-200' : 'border-slate-800'} pt-2`}>
            <label className={`flex cursor-pointer items-start gap-2 px-2 text-[11px] ${isSiplan ? 'text-gray-700' : 'text-slate-300'}`}>
              <input
                type="checkbox"
                checked={pref.lembrarUltimoMonitor}
                onChange={() => {
                  const novo = { ...pref, lembrarUltimoMonitor: !pref.lembrarUltimoMonitor };
                  setPref(novo);
                  gravarPreferenciasJanelas(novo);
                }}
                className={`mt-0.5 ${isSiplan ? 'accent-[#800000]' : 'accent-cyan-500'}`}
              />
              <span>Sempre abrir no monitor da última vez</span>
            </label>

            {pref.ultimoMonitor && (
              <div className={`flex items-center justify-between rounded px-2.5 py-1 text-[10px] ${isSiplan ? 'bg-gray-100 text-gray-700' : 'bg-slate-950 text-slate-400'}`}>
                <span>Monitor memorizado ({pref.ultimoMonitor.rotulo || `${pref.ultimoMonitor.left},${pref.ultimoMonitor.top}`})</span>
                <button
                  type="button"
                  onClick={() => {
                    const limpo = desfazerMemorizacaoMonitor();
                    setPref(limpo);
                  }}
                  className={`font-semibold underline ${isSiplan ? 'text-[#800000] hover:text-[#990000]' : 'text-rose-400 hover:text-rose-300'}`}
                  title="Desfazer memorização e voltar a abrir ao lado da tela principal"
                >
                  Desfazer
                </button>
              </div>
            )}

            <label className={`flex cursor-pointer items-start gap-2 px-2 text-[11px] ${isSiplan ? 'text-gray-500' : 'text-slate-400'}`}>
              <input
                type="checkbox"
                checked={pref.sempreEmJanela}
                onChange={alternarSempreEmJanela}
                className={`mt-0.5 ${isSiplan ? 'accent-[#800000]' : 'accent-cyan-500'}`}
              />
              <span>Abrir sempre em janela separada por padrão</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
