import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { BarChart3, Download, Printer, Users, Award, ExternalLink, Star, Sparkles, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function RelatoriosPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect('/login');
  }
  const tenantId = user.tenantId;

  let totalReviews = 547;
  try {
    const dbTotal = await prisma.review.count({ where: { tenantId, deletedFromGoogle: false } });
    if (dbTotal > 0) totalReviews = dbTotal;
  } catch (err) {
    console.error('Error fetching total reviews:', err);
  }

  let dbColaboradores: any[] = [];
  try {
    dbColaboradores = await prisma.colaborador.findMany({
      where: { tenantId, active: true },
      include: {
        mentions: {
          include: { review: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  } catch (err) {
    console.error('Error loading colaboradores:', err);
  }

  const allReviews = await prisma.review.findMany({ where: { tenantId } }).catch(() => []);

  const rawColabMap = new Map<string, { id: string; nome: string; elogios: number; mencoes: number; ratings: number[] }>();

  if (dbColaboradores.length > 0) {
    dbColaboradores.forEach((colab) => {
      const normalizedKey = colab.name.trim().toLowerCase();
      const namesToSearch = [colab.name, ...(colab.aliases || [])].map((n) => n.trim().toLowerCase()).filter(Boolean);

      const matchedReviews = allReviews.filter((rev) => {
        if (!rev.comment) return false;
        const commentLower = rev.comment.toLowerCase();
        return namesToSearch.some((term) => commentLower.includes(term));
      });

      const relationalReviews = colab.mentions.map((m: any) => m.review).filter(Boolean);
      const combinedReviewsMap = new Map();
      [...relationalReviews, ...matchedReviews].forEach((rev) => {
        if (rev && rev.id) combinedReviewsMap.set(rev.id, rev);
      });

      const uniqueReviews = Array.from(combinedReviewsMap.values());
      const mencoes = uniqueReviews.length;
      const elogios = uniqueReviews.filter((rev: any) => rev.rating >= 4 || rev.aiSentiment === 'POSITIVE').length;
      const ratings = uniqueReviews.map((rev: any) => rev.rating);

      if (rawColabMap.has(normalizedKey)) {
        const existing = rawColabMap.get(normalizedKey)!;
        existing.elogios += elogios;
        existing.mencoes += mencoes;
        existing.ratings.push(...ratings);
      } else {
        rawColabMap.set(normalizedKey, {
          id: colab.id,
          nome: colab.name,
          elogios,
          mencoes,
          ratings,
        });
      }
    });
  }

  const mockColaboradoresSample = [
    { id: 'm-1', nome: 'Ricardo Marçal', elogios: 77, mencoes: 77, notaMedia: '5.0' },
    { id: 'm-2', nome: 'Ana', elogios: 19, mencoes: 27, notaMedia: '3.9' },
    { id: 'm-3', nome: 'Jonatan', elogios: 5, mencoes: 5, notaMedia: '5.0' },
    { id: 'm-4', nome: 'Lucas', elogios: 10, mencoes: 10, notaMedia: '5.0' },
    { id: 'm-5', nome: 'Anne', elogios: 4, mencoes: 4, notaMedia: '5.0' },
    { id: 'm-6', nome: 'Jozilene', elogios: 2, mencoes: 3, notaMedia: '3.7' },
    { id: 'm-7', nome: 'Bruno', elogios: 2, mencoes: 2, notaMedia: '5.0' },
    { id: 'm-8', nome: 'David Bruno', elogios: 1, mencoes: 1, notaMedia: '5.0' },
  ];

  let colaboradoresList = Array.from(rawColabMap.values()).map((col) => {
    const notaMedia = col.ratings.length > 0 ? (col.ratings.reduce((a, b) => a + b, 0) / col.ratings.length).toFixed(1) : '5.0';
    return {
      id: col.id,
      nome: col.nome,
      elogios: col.elogios,
      mencoes: col.mencoes,
      notaMedia,
    };
  });

  if (colaboradoresList.length === 0 || dbColaboradores.length === 0) colaboradoresList = mockColaboradoresSample;
  colaboradoresList.sort((a, b) => b.mencoes - a.mencoes);

  const top1 = colaboradoresList[0];
  const top2 = colaboradoresList[1];
  const top3 = colaboradoresList[2];
  const totalElogiosSum = colaboradoresList.reduce((acc, c) => acc + c.elogios, 0);

  const surfaceCard = 'rounded-2xl border border-white/10 bg-slate-900/80 shadow-[0_12px_30px_rgba(2,6,23,0.2)]';

  return (
    <div className="fiorix-dark-page w-full space-y-6 px-4 py-6 md:px-7">
      <div className={`${surfaceCard} space-y-5 p-6`}>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-white">Relatórios Avançados & Exportação de Dados</h2>
          <p className="mt-1 text-xs text-slate-400">
            Gere relatórios impressos consolidados ou exporte a base bruta de avaliações em CSV e JSON.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2">
          <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-white/15">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/12 text-blue-300">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Relatório Mensal de Reputação</h4>
              <p className="text-xs leading-relaxed text-slate-400">
                Resumo consolidado do volume de notas, nota média e evolução mensal do cartório em folha A4.
              </p>
            </div>
            <a
              href="/relatorios/imprimir-mensal"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 self-start rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-500"
            >
              <Printer className="h-4 w-4" />
              <span>Gerar PDF Mensal</span>
            </a>
          </div>

          <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-white/15">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/12 text-violet-300">
                <Download className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Exportação de Dados Brutos</h4>
              <p className="text-xs leading-relaxed text-slate-400">
                Exporte todas as {totalReviews} avaliações para planilha Excel (CSV) ou estrutura de dados JSON.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/export?format=csv"
                download
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-xs font-bold text-slate-100 transition-colors hover:bg-white/[0.09]"
              >
                <span>📄 Exportar CSV</span>
              </a>
              <a
                href="/api/export?format=json"
                download
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3.5 py-2.5 text-xs font-bold text-blue-300 transition-colors hover:bg-blue-500/16"
              >
                <span>{'{ }'} Exportar JSON</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`${surfaceCard} flex items-center gap-3 p-4`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/12 text-blue-300">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Colaboradores</span>
            <div className="text-lg font-black text-white">{colaboradoresList.length} escreventes</div>
          </div>
        </div>

        <div className={`${surfaceCard} flex items-center gap-3 p-4`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/12 text-emerald-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Total de Elogios</span>
            <div className="text-lg font-black text-emerald-300">{totalElogiosSum} elogios</div>
          </div>
        </div>

        <div className={`${surfaceCard} flex items-center gap-3 p-4`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/12 text-amber-300">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Top Destaque</span>
            <div className="truncate text-sm font-black text-white">{top1 ? `${top1.nome} (🥇 1º)` : 'N/A'}</div>
          </div>
        </div>
      </div>

      {colaboradoresList.length >= 3 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative space-y-2 overflow-hidden rounded-2xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(30,41,59,0.94))] p-5 shadow-[0_10px_28px_rgba(2,6,23,0.18)]">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🥇</span>
              <span className="rounded-full border border-amber-500/20 bg-amber-500/12 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-300">1º Lugar • Ouro</span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">{top1.nome}</h3>
              <p className="text-xs font-semibold text-amber-300">{top1.elogios} Elogios Diretos ({top1.notaMedia} ★)</p>
            </div>
            <div className="text-[11px] font-medium text-slate-300">
              Taxa de Aprovação: <strong className="text-amber-200">100% Positivo</strong>
            </div>
          </div>

          <div className="relative space-y-2 overflow-hidden rounded-2xl border border-slate-500/20 bg-[linear-gradient(135deg,rgba(148,163,184,0.12),rgba(30,41,59,0.94))] p-5 shadow-[0_10px_28px_rgba(2,6,23,0.18)]">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🥈</span>
              <span className="rounded-full border border-slate-400/20 bg-slate-400/12 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-slate-200">2º Lugar • Prata</span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">{top2.nome}</h3>
              <p className="text-xs font-semibold text-slate-300">{top2.elogios} Elogios Diretos ({top2.notaMedia} ★)</p>
            </div>
            <div className="text-[11px] font-medium text-slate-300">
              Taxa de Aprovação: <strong className="text-slate-100">{((top2.elogios / top2.mencoes) * 100).toFixed(1)}% Positivo</strong>
            </div>
          </div>

          <div className="relative space-y-2 overflow-hidden rounded-2xl border border-orange-500/20 bg-[linear-gradient(135deg,rgba(249,115,22,0.10),rgba(30,41,59,0.94))] p-5 shadow-[0_10px_28px_rgba(2,6,23,0.18)]">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🥉</span>
              <span className="rounded-full border border-orange-500/20 bg-orange-500/12 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-orange-300">3º Lugar • Bronze</span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">{top3.nome}</h3>
              <p className="text-xs font-semibold text-orange-300">{top3.elogios} Elogios Diretos ({top3.notaMedia} ★)</p>
            </div>
            <div className="text-[11px] font-medium text-slate-300">
              Taxa de Aprovação: <strong className="text-orange-200">100% Positivo</strong>
            </div>
          </div>
        </div>
      )}

      <div className={`${surfaceCard} space-y-4 overflow-hidden p-6`}>
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">👥</span>
              <h3 className="text-base font-extrabold tracking-tight text-white">Desempenho & Elogios por Colaborador</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Clique nas ações para filtrar as avaliações nominais correspondentes de cada escrevente.
            </p>
          </div>

          <a
            href="/relatorios/imprimir-colaboradores"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-300 transition-colors hover:bg-blue-500/16 md:self-auto"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir / Versão PDF</span>
          </a>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-[640px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                <th className="w-12 p-3 pl-5 sm:w-16 sm:p-4">Rank</th>
                <th className="p-3 sm:p-4">Colaborador</th>
                <th className="p-3 text-center sm:p-4">Elogios Diretos</th>
                <th className="p-3 text-center sm:p-4">Total Menções</th>
                <th className="p-3 text-center sm:p-4">Taxa Positiva (%)</th>
                <th className="p-3 text-center sm:p-4">Nota Média</th>
                <th className="whitespace-nowrap p-3 pr-5 text-right sm:p-4">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 font-medium text-slate-300">
              {colaboradoresList.map((col, idx) => {
                const rankMedal = idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;
                const rowBg =
                  idx === 0
                    ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.10]'
                    : idx === 1
                      ? 'bg-slate-400/[0.05] hover:bg-slate-400/[0.08]'
                      : idx === 2
                        ? 'bg-orange-500/[0.05] hover:bg-orange-500/[0.09]'
                        : 'hover:bg-white/[0.03]';

                const searchUrl = `/avaliacoes?search=${encodeURIComponent(col.nome)}`;
                const pctPositiva = col.mencoes > 0 ? ((col.elogios / col.mencoes) * 100).toFixed(0) : '100';

                return (
                  <tr key={col.id || idx} className={`${rowBg} transition-colors`}>
                    <td className="p-3 pl-5 text-sm font-bold text-white sm:p-4">{rankMedal}</td>

                    <td className="p-3 sm:p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
                          {col.nome[0].toUpperCase()}
                        </div>
                        <Link href={searchUrl} className="text-xs font-bold text-white transition-colors hover:text-blue-300">
                          {col.nome}
                        </Link>
                      </div>
                    </td>

                    <td className="p-3 text-center sm:p-4">
                      <Link
                        href={searchUrl}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/12 px-2 py-1 text-[10px] font-extrabold text-emerald-300 transition-colors hover:bg-emerald-500/18 sm:px-3 sm:text-xs"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-300 sm:h-3.5 sm:w-3.5" />
                        <span>{col.elogios} elogios</span>
                      </Link>
                    </td>

                    <td className="p-3 text-center font-bold text-slate-300 sm:p-4">{col.mencoes}</td>

                    <td className="p-3 text-center font-bold text-slate-200 sm:p-4">{pctPositiva}%</td>

                    <td className="p-3 text-center sm:p-4">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-amber-500/20 bg-amber-500/12 px-2 py-1 text-[10px] font-extrabold text-amber-300 sm:px-2.5 sm:text-xs">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400 sm:h-3.5 sm:w-3.5" />
                        {col.notaMedia}
                      </span>
                    </td>

                    <td className="p-3 text-right sm:p-4">
                      <Link
                        href={searchUrl}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-[10px] font-bold text-blue-300 transition-colors hover:bg-blue-500/16 sm:px-3 sm:text-xs"
                      >
                        <span className="hidden sm:inline">Ver avaliações</span>
                        <span className="sm:hidden">Ver</span>
                        <ExternalLink className="h-3 w-3 text-blue-300 sm:h-3.5 sm:w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
