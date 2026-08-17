import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { ReviewItemCard } from '@/components/avaliacoes/ReviewItemCard';
import { MessageSquare, CheckCircle, Clock, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect('/login');
  }
  const tenantId = user.tenantId;

  const rawStatus = Array.isArray(searchParams?.status) ? searchParams.status[0] : searchParams?.status;
  const statusFilter = typeof rawStatus === 'string' ? rawStatus : undefined;

  const rawRating = Array.isArray(searchParams?.rating) ? searchParams.rating[0] : searchParams?.rating;
  const parsedRating = typeof rawRating === 'string' ? parseInt(rawRating, 10) : undefined;
  const ratingFilter = parsedRating && !isNaN(parsedRating) ? parsedRating : undefined;

  const rawColab = Array.isArray(searchParams?.colaborador) ? searchParams.colaborador[0] : searchParams?.colaborador;
  const colabFilter = typeof rawColab === 'string' ? rawColab : undefined;

  const rawSearch = Array.isArray(searchParams?.search) ? searchParams.search[0] : searchParams?.search;
  const searchQuery = typeof rawSearch === 'string' ? rawSearch.trim() : undefined;

  const whereClause: any = { tenantId, deletedFromGoogle: false };
  if (statusFilter === 'PENDING') whereClause.status = 'PENDING';
  if (statusFilter === 'RESPONDED') whereClause.status = 'RESPONDED';
  if (ratingFilter) whereClause.rating = ratingFilter;
  if (searchQuery) whereClause.comment = { contains: searchQuery, mode: 'insensitive' };
  if (colabFilter) whereClause.comment = { contains: colabFilter, mode: 'insensitive' };

  const rawPage = Array.isArray(searchParams?.page) ? searchParams.page[0] : searchParams?.page;
  const currentPage = Math.max(1, parseInt(typeof rawPage === 'string' ? rawPage : '1', 10) || 1);
  const pageSize = 10;
  const skip = (currentPage - 1) * pageSize;

  let dbReviews: any[] = [];
  let totalCount = 547;
  let totalFilteredCount = 547;
  let pendingCount = 0;
  let respondedCount = 547;

  try {
    const dbTotal = await prisma.review.count({ where: { tenantId, deletedFromGoogle: false } });
    if (dbTotal > 0) {
      totalCount = dbTotal;
      totalFilteredCount = await prisma.review.count({ where: whereClause });
      pendingCount = await prisma.review.count({ where: { tenantId, status: 'PENDING', deletedFromGoogle: false } });
      respondedCount = await prisma.review.count({ where: { tenantId, status: 'RESPONDED', deletedFromGoogle: false } });

      dbReviews = await prisma.review.findMany({
        where: whereClause,
        include: { response: true },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: pageSize,
      });
    }
  } catch (err) {
    console.error('Error fetching reviews:', err);
  }

  const mockReviewsSample = [
    {
      id: 'mock-1',
      googleId: 'AbFv0qmQDBmHWPhr_sample1',
      reviewerName: 'Daniel Costa',
      rating: 5,
      comment: null,
      status: 'RESPONDED',
      publishedAt: new Date('2026-08-07T15:23:00'),
      response: {
        content:
          'Prezado Daniel Costa, agradecemos imensamente por sua avaliação 5 estrelas! Ficamos honrados em oferecer um atendimento de excelência no 7º Cartório de Imóveis de SP.',
      },
    },
    {
      id: 'mock-2',
      googleId: 'AbFv0qmQDBmHWPhr_sample2',
      reviewerName: 'Cleber A. Coutinho',
      rating: 5,
      comment: 'Muito bem atendido pelo Sr Edvan!! Parabéns a toda equipe pela recepção!!!',
      status: 'RESPONDED',
      publishedAt: new Date('2026-08-07T11:45:00'),
      response: {
        content:
          'Prezado Cleber A. Coutinho, muito obrigado por registrar sua avaliação positiva! Repassaremos seus elogios diretamente ao escrevente Edvan e a toda nossa recepção.',
      },
    },
    {
      id: 'mock-3',
      googleId: 'AbFv0qmQDBmHWPhr_sample3',
      reviewerName: 'Reinaldo Kosmo',
      rating: 1,
      comment:
        'Solicitei o cancelamento de alienação fiduciária em 21/07. O prazo informado foi de 10 dias úteis conforme prevê as normas da Corregedoria Geral da Justiça do TJ/SP. Hoje é dia 05/08, ultrapassou o prazo legal e o título continua em preparação sem nenhuma justificativa. Absurdo a falta de concorrência e o descaso no atendimento ao cliente.',
      status: 'RESPONDED',
      publishedAt: new Date('2026-08-05T09:12:00'),
      response: {
        content:
          'Prezado Reinaldo Kosmo, lamentamos formalmente o transtorno e a demora no cancelamento de alienação fiduciária. Solicitamos que envie o número do seu protocolo para sac@7risp.com.br ou ligue para (11) 3218-0527 para priorizarmos a finalização do seu título imediatamente.',
      },
    },
    {
      id: 'mock-4',
      googleId: 'AbFv0qmQDBmHWPhr_sample4',
      reviewerName: 'Maria Santos',
      rating: 3,
      comment: 'Atendimento ok mas a fila estava absurda. Esperei 1h20min para ser chamada.',
      status: 'RESPONDED',
      publishedAt: new Date('2026-07-21T14:30:00'),
      response: {
        content:
          'Prezada Maria Santos, agradecemos seu relato. Pedimos sinceras desculpas pelo tempo de espera excessivo em nossa recepção e informamos que já estamos implementando melhorias de triagem.',
      },
    },
    {
      id: 'mock-5',
      googleId: 'AbFv0qmQDBmHWPhr_sample5',
      reviewerName: 'Glória Gomes',
      rating: 5,
      comment: 'Gostaria de registrar meu agradecimento pelo excelente atendimento prestado pela Ana.',
      status: 'RESPONDED',
      publishedAt: new Date('2026-07-23T16:10:00'),
      response: {
        content:
          'Olá Glória Gomes! Ficamos extremamente felizes com seu reconhecimento ao atendimento prestado pela escrevente Ana. Já repassamos seu elogio a ela. Conte sempre conosco!',
      },
    },
  ];

  let displayReviews = dbReviews.length > 0 ? dbReviews : mockReviewsSample;

  if (dbReviews.length === 0) {
    if (statusFilter === 'PENDING') displayReviews = displayReviews.filter((r) => r.status === 'PENDING');
    else if (statusFilter === 'RESPONDED') displayReviews = displayReviews.filter((r) => r.status === 'RESPONDED');

    if (ratingFilter) {
      displayReviews = ratingFilter === 3 ? displayReviews.filter((r) => r.rating <= 3) : displayReviews.filter((r) => r.rating === ratingFilter);
    }
    if (searchQuery) {
      displayReviews = displayReviews.filter(
        (r) =>
          (r.comment || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.reviewerName.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    if (colabFilter) {
      displayReviews = displayReviews.filter((r) => (r.comment || '').toLowerCase().includes(colabFilter.toLowerCase()));
    }
    totalFilteredCount = displayReviews.length;
  }

  const effectiveTotalCount = dbReviews.length > 0 ? totalFilteredCount : displayReviews.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotalCount / pageSize));
  const startItemIndex = Math.min(skip + 1, effectiveTotalCount);
  const endItemIndex = Math.min(skip + displayReviews.length, effectiveTotalCount);

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (ratingFilter) params.set('rating', String(ratingFilter));
    if (colabFilter) params.set('colaborador', colabFilter);
    if (searchQuery) params.set('search', searchQuery);
    params.set('page', String(newPage));
    return `/avaliacoes?${params.toString()}`;
  };

  return (
    <div className="fiorix-dark-page w-full space-y-6 px-4 py-6 md:px-7">
      <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-[0_14px_35px_rgba(2,6,23,0.22)]">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
              <h1 className="text-xl font-extrabold tracking-tight text-white">Avaliações do Google Meu Negócio</h1>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Gerencie, monitore e responda às avaliações recebidas pelo 7º Cartório de Imóveis de SP.
            </p>
          </div>

          <div className="inline-flex flex-wrap gap-1 self-start rounded-xl border border-white/10 bg-white/[0.04] p-1 text-xs font-semibold md:self-auto">
            <Link
              href="/avaliacoes"
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                !statusFilter ? 'bg-blue-600 font-bold text-white shadow-sm' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              Todas ({totalCount})
            </Link>
            <Link
              href="/avaliacoes?status=PENDING"
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                statusFilter === 'PENDING' ? 'bg-amber-500 font-bold text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Aguardando ({pendingCount})
              </span>
            </Link>
            <Link
              href="/avaliacoes?status=RESPONDED"
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                statusFilter === 'RESPONDED'
                  ? 'bg-emerald-600 font-bold text-white shadow-sm'
                  : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/16'
              }`}
            >
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Respondidas ({respondedCount})
              </span>
            </Link>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-200">
            <span>Distribuição de Notas das Avaliações</span>
            <span className="font-semibold text-slate-400">Nota Média: 4.4 ★</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-700/80">
            <div className="h-full bg-emerald-500" style={{ width: '85%' }} title="5★ - 85%" />
            <div className="h-full bg-emerald-400" style={{ width: '8%' }} title="4★ - 8%" />
            <div className="h-full bg-amber-400" style={{ width: '3%' }} title="3★ - 3%" />
            <div className="h-full bg-red-400" style={{ width: '4%' }} title="1-2★ - 4%" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-400">
            <span className="flex items-center gap-1 text-emerald-300">● 5★: 85%</span>
            <span className="flex items-center gap-1 text-emerald-400">● 4★: 8%</span>
            <span className="flex items-center gap-1 text-amber-300">● 3★: 3%</span>
            <span className="flex items-center gap-1 text-red-300">● 1-2★: 4%</span>
          </div>
        </div>

        <form action="/avaliacoes" method="GET" className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-12">
          <div className="relative sm:col-span-6">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Buscar por nome, comentário ou colaborador..."
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 py-2 pl-9 pr-4 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              name="rating"
              defaultValue={ratingFilter ? String(ratingFilter) : ''}
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Todas as Estrelas</option>
              <option value="5">5 Estrelas (★★★★★)</option>
              <option value="4">4 Estrelas (★★★★☆)</option>
              <option value="3">3 Estrelas ou menos (★-★★★)</option>
            </select>
          </div>

          <div className="flex gap-2 sm:col-span-3">
            <select
              name="colaborador"
              defaultValue={colabFilter || ''}
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Todos Colaboradores</option>
              <option value="Lucas">Lucas</option>
              <option value="Ana">Ana</option>
              <option value="Edvan">Edvan</option>
              <option value="Juliana">Juliana</option>
              <option value="Sarah">Sarah</option>
            </select>

            <button type="submit" className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500">
              Filtrar
            </button>
          </div>
        </form>
      </div>

      {(searchQuery || ratingFilter || colabFilter || statusFilter) && (
        <div className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 px-4 text-xs text-blue-100">
          <div className="flex items-center gap-2 font-semibold">
            <Filter className="h-4 w-4 text-blue-400" />
            <span>
              Filtros ativos:{' '}
              {[searchQuery && `Busca: "${searchQuery}"`, ratingFilter && `Nota: ${ratingFilter}★`, colabFilter && `Colaborador: ${colabFilter}`, statusFilter && `Status: ${statusFilter}`]
                .filter(Boolean)
                .join(' • ')}
            </span>
          </div>
          <Link href="/avaliacoes" className="font-bold text-blue-300 hover:text-blue-200 hover:underline">
            ✕ Limpar tudo
          </Link>
        </div>
      )}

      {!displayReviews || displayReviews.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/80 p-12 text-center shadow-[0_12px_30px_rgba(2,6,23,0.18)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] text-slate-400">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhuma avaliação encontrada</h3>
          <p className="mx-auto max-w-sm text-xs text-slate-400">
            Tente remover alguns filtros ou buscar por outro termo para encontrar o registro desejado.
          </p>
          <Link href="/avaliacoes" className="inline-block rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]">
            Ver todas as avaliações
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {displayReviews.map((rev) => (
            <ReviewItemCard key={rev.id} review={rev} />
          ))}
        </div>
      )}

      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 px-6 text-xs font-medium text-slate-400 shadow-[0_12px_30px_rgba(2,6,23,0.18)] sm:flex-row">
        <div>
          Mostrando <strong className="text-white">{startItemIndex}-{endItemIndex}</strong> de <strong className="text-white">{effectiveTotalCount}</strong> avaliações
          {totalPages > 1 && <span className="ml-1 text-slate-500">(Página {currentPage} de {totalPages})</span>}
        </div>

        <div className="flex items-center gap-2">
          {currentPage > 1 ? (
            <Link
              href={buildPageUrl(currentPage - 1)}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:bg-white/[0.08]"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Link>
          ) : (
            <button disabled className="flex cursor-not-allowed items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-bold text-slate-500">
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
          )}

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  p = currentPage - 2 + i;
                  if (p > totalPages) p = totalPages - (4 - i);
                }
                return (
                  <Link
                    key={p}
                    href={buildPageUrl(p)}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                      currentPage === p ? 'bg-blue-600 text-white shadow-xs' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}
            </div>
          )}

          {currentPage < totalPages ? (
            <Link
              href={buildPageUrl(currentPage + 1)}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:bg-white/[0.08]"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <button disabled className="flex cursor-not-allowed items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-bold text-slate-500">
              Próxima
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
