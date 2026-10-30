'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, MonitorX, Eye, ArrowLeft } from 'lucide-react';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { CANAL_VISUALIZADOR, type DocumentoJanela, type MensagemVisualizador } from '@/lib/documental/janelasDocumento';



/** Conteúdo da janela destacada: recebe o documento da tela principal e o exibe em tela cheia */
export function VisualizadorJanela({ id }: { id: string }) {
  const [item, setItem] = useState<DocumentoJanela | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);

  useEffect(() => {
    // Se não foi fornecido um id (acesso direto ou F5) ou id for demo, carrega diretamente a Matrícula 1 real do acervo
    if (!id || id === 'demo') {
      let cancelado = false;
      setCarregando(true);
      fetch('/api/documental/ken?doc=1&sessao=LV2')
        .then(async res => {
          if (cancelado) return;
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.pages?.length > 0) {
              setItem({
                rootId: 'livro2',
                relativePath: data.relativePath || '00000000\\00000001.KEN',
                documento: {
                  fileName: data.fileName || '00000001.KEN',
                  extension: '.KEN',
                  html: '',
                  text: data.text || '',
                  pageTexts: data.pageTexts || [],
                  size: data.size || 0,
                  pageCount: data.pages.length,
                  pages: data.pages,
                },
              });
              document.title = `${data.fileName} — Visualizador de Imagens FIORIX`;
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelado) setCarregando(false);
        });

      return () => {
        cancelado = true;
      };
    }

    if (typeof BroadcastChannel === 'undefined') {
      setCarregando(false);
      return;
    }

    const canal = new BroadcastChannel(CANAL_VISUALIZADOR);
    let recebido = false;
    canal.onmessage = (event: MessageEvent<MensagemVisualizador>) => {
      const msg = event.data;
      if (msg?.tipo === 'documento' && msg.id === id) {
        recebido = true;
        setItem(msg.payload);
        setCarregando(false);
        setIndisponivel(false);
        document.title = `${msg.payload.documento.fileName} — Visualizador de Imagens FIORIX`;
      }
    };
    canal.postMessage({ tipo: 'pedir', id } satisfies MensagemVisualizador);
    // Repete o pedido algumas vezes (a tela principal pode estar ocupada) antes de desistir
    const tentativas = [400, 1200, 2500].map(ms =>
      setTimeout(() => {
        if (!recebido) canal.postMessage({ tipo: 'pedir', id } satisfies MensagemVisualizador);
      }, ms),
    );
    const limite = setTimeout(() => {
      if (!recebido) {
        setCarregando(false);
        setIndisponivel(true);
      }
    }, 4000);
    return () => {
      tentativas.forEach(clearTimeout);
      clearTimeout(limite);
      canal.close();
    };
  }, [id]);

  if (carregando && !item) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#EAEAEA] text-gray-800">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F3D6E] mb-3" />
        <p className="text-sm font-semibold tracking-wide text-gray-900">Carregando Acervo Oficial...</p>
        <p className="text-xs font-mono text-gray-600 mt-1">K:\IMAGENS\LV2\00000000\00000001.KEN</p>
      </div>
    );
  }

  if (item) {
    return (
      <DocumentPreviewModal
        modo="janela"
        documento={item.documento}
        relativePath={item.relativePath}
        rootId={item.rootId}
        onClose={() => {
          if (window.opener) {
            window.close();
          } else {
            window.location.href = '/gestao-documental';
          }
        }}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-slate-300">
      {indisponivel ? (
        <div className="max-w-md space-y-4 rounded-xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md">
          <MonitorX className="mx-auto h-12 w-12 text-rose-400" />
          <h1 className="text-lg font-bold text-white">Nenhum documento sincronizado nesta janela</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Esta janela aguarda o sinal de um documento aberto na tela principal de Manifestações pelo botão{' '}
            <strong className="text-cyan-300">Outro monitor</strong>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCarregando(true);
                setIndisponivel(false);
                fetch('/api/documental/ken?doc=1&sessao=LV2')
                  .then(async res => {
                    if (res.ok) {
                      const data = await res.json();
                      if (data.success && data.pages?.length > 0) {
                        setItem({
                          rootId: 'livro2',
                          relativePath: data.relativePath || '00000000\\00000001.KEN',
                          documento: {
                            fileName: data.fileName || '00000001.KEN',
                            extension: '.KEN',
                            html: '',
                            text: data.text || '',
                            pageTexts: data.pageTexts || [],
                            size: data.size || 0,
                            pageCount: data.pages.length,
                            pages: data.pages,
                          },
                        });
                      }
                    }
                  })
                  .finally(() => setCarregando(false));
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 transition shadow-md"
            >
              <Eye className="h-4 w-4" />
              <span>Abrir Matrícula 1 Oficial</span>
            </button>

            <Link
              href="/gestao-documental"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 transition"
            >
              <ArrowLeft className="h-4 w-4 text-cyan-400" />
              <span>Ir para Gestão Documental</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          <span>Carregando documento no Visualizador…</span>
        </div>
      )}
    </main>
  );
}
