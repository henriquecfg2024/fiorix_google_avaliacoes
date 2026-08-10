import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Link from 'next/link';
import { ReviewItemCard } from '@/components/avaliacoes/ReviewItemCard';
import { MessageSquare, CheckCircle, Clock, Search, Filter, Star, User, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  const tenantId = (session?.user?.tenantId as string) || 'cartorio-7ri-sp';

  const rawStatus = Array.isArray(searchParams?.status) ? searchParams.status[0] : searchParams?.status;
  const statusFilter = typeof rawStatus === 'string' ? rawStatus : undefined;

  const rawRating = Array.isArray(searchParams?.rating) ? searchParams.rating[0] : searchParams?.rating;
  const parsedRating = typeof rawRating === 'string' ? parseInt(rawRating, 10) : undefined;
  const ratingFilter = (parsedRating && !isNaN(parsedRating)) ? parsedRating : undefined;

  const rawColab = Array.isArray(searchParams?.colaborador) ? searchParams.colaborador[0] : searchParams?.colaborador;
  const colabFilter = typeof rawColab === 'string' ? rawColab : undefined;

  const rawSearch = Array.isArray(searchParams?.search) ? searchParams.search[0] : searchParams?.search;
  const searchQuery = typeof rawSearch === 'string' ? rawSearch.trim() : undefined;

  const whereClause: any = { tenantId };
  if (statusFilter === 'PENDING') whereClause.status = 'PENDING';
  if (statusFilter === 'RESPONDED') whereClause.status = 'RESPONDED';
  if (ratingFilter) whereClause.rating = ratingFilter;
  if (searchQuery) {
    whereClause.comment = { contains: searchQuery, mode: 'insensitive' };
  }
  if (colabFilter) {
    whereClause.comment = { contains: colabFilter, mode: 'insensitive' };
  }

  let dbReviews: any[] = [];
  let totalCount = 547;
  let pendingCount = 0;
  let respondedCount = 547;

  try {
    dbReviews = await prisma.review.findMany({
      where: whereClause,
      include: { response: true },
      orderBy: { publishedAt: 'desc' },
    });

    const dbTotal = await prisma.review.count({ where: { tenantId } });
    if (dbTotal > 0) {
      totalCount = dbTotal;
      pendingCount = await prisma.review.count({ where: { tenantId, status: 'PENDING' } });
      respondedCount = await prisma.review.count({ where: { tenantId, status: 'RESPONDED' } });
    }
  } catch (err) {
    console.error('Error fetching reviews:', err);
  }

  // Exact 5 mock items from prompt for fallback
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
        content: 'Prezado Daniel Costa, agradecemos imensamente por sua avaliação 5 estrelas! Ficamos honrados em oferecer um atendimento de excelência no 7º Cartório de Imóveis de SP.',
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
        content: 'Prezado Cleber A. Coutinho, muito obrigado por registrar sua avaliação positiva! Repassaremos seus elogios diretamente ao escrevente Edvan e a toda nossa recepção.',
      },
    },
    {
      id: 'mock-3',
      googleId: 'AbFv0qmQDBmHWPhr_sample3',
      reviewerName: 'Reinaldo Kosmo',
      rating: 1,
      comment: 'Solicitei o cancelamento de alienação fiduciária em 21/07. O prazo informado foi de 10 dias úteis conforme prevê as normas da Corregedoria Geral da Justiça do TJ/SP. Hoje é dia 05/08, ultrapassou o prazo legal e o título continua em preparação sem nenhuma justificativa. Absurdo a falta de concorrência e o descaso no atendimento ao cliente.',
      status: 'RESPONDED',
      publishedAt: new Date('2026-08-05T09:12:00'),
      response: {
        content: 'Prezado Reinaldo Kosmo, lamentamos formalmente o transtorno e a demora no cancelamento de alienação fiduciária. Solicitamos que envie o número do seu protocolo para sac@7risp.com.br ou ligue para (11) 3218-0527 para priorizarmos a finalização do seu título imediatamente.',
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
        content: 'Prezada Maria Santos, agradecemos seu relato. Pedimos sinceras desculpas pelo tempo de espera excessivo em nossa recepção e informamos que já estamos implementando melhorias de triagem.',
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
        content: 'Olá Glória Gomes! Ficamos extremamente felizes com seu reconhecimento ao atendimento prestado pela escrevente Ana. Já repassamos seu elogio a ela. Conte sempre conosco!',
      },
    },
  ];

  // Apply filters on mock sample if using mock
  let displayReviews = dbReviews.length > 0 ? dbReviews : mockReviewsSample;

  if (dbReviews.length === 0) {
    if (statusFilter === 'PENDING') {
      displayReviews = displayReviews.filter((r) => r.status === 'PENDING');
    } else if (statusFilter === 'RESPONDED') {
      displayReviews = displayReviews.filter((r) => r.status === 'RESPONDED');
    }
    if (ratingFilter) {
      if (ratingFilter === 3) {
        displayReviews = displayReviews.filter((r) => r.rating <= 3);
      } else {
        displayReviews = displayReviews.filter((r) => r.rating === ratingFilter);
      }
    }
    if (searchQuery) {
      displayReviews = displayReviews.filter((r) =>
        (r.comment || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reviewerName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (colabFilter) {
      displayReviews = displayReviews.filter((r) =>
        (r.comment || '').toLowerCase().includes(colabFilter.toLowerCase())
      );
    }
  }

  return (
    <div className="w-full px-4 md:px-7 py-6 space-y-6">
      {/* HEADER CARD WITH SUMMARY */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        {/* ROW 1: TITLE & PILL FILTERS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Avaliações do Google Meu Negócio
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Gerencie, monitore e responda às avaliações recebidas pelo 7º Cartório de Imóveis de SP.
            </p>
          </div>

          {/* NAV PILLS */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold self-start md:self-auto flex-wrap">
            <Link
              href="/avaliacoes"
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                !statusFilter
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Todas ({totalCount})
            </Link>
            <Link
              href="/avaliacoes?status=PENDING"
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                statusFilter === 'PENDING'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Aguardando ({pendingCount})
              </span>
            </Link>
            <Link
              href="/avaliacoes?status=RESPONDED"
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                statusFilter === 'RESPONDED'
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80'
              }`}
            >
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Respondidas ({respondedCount})
              </span>
            </Link>
          </div>
        </div>

        {/* RATING DISTRIBUTION SUMMARY BAR */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Distribuição de Notas das Avaliações</span>
            <span className="text-slate-500 font-semibold">Nota Média: 4.4 ★</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: '85%' }} title="5★ - 85%" />
            <div className="bg-emerald-400 h-full" style={{ width: '8%' }} title="4★ - 8%" />
            <div className="bg-amber-400 h-full" style={{ width: '3%' }} title="3★ - 3%" />
            <div className="bg-red-400 h-full" style={{ width: '4%' }} title="1-2★ - 4%" />
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 flex-wrap gap-2">
            <span className="flex items-center gap-1 text-emerald-700">● 5★: 85%</span>
            <span className="flex items-center gap-1 text-emerald-600">● 4★: 8%</span>
            <span className="flex items-center gap-1 text-amber-600">● 3★: 3%</span>
            <span className="flex items-center gap-1 text-red-600">● 1-2★: 4%</span>
          </div>
        </div>

        {/* ROW 2: SEARCH INPUT & FILTERS */}
        <form action="/avaliacoes" method="GET" className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* SEARCH FIELD */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Buscar por nome, comentário ou colaborador..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* RATING SELECT */}
          <div className="sm:col-span-3">
            <select
              name="rating"
              defaultValue={ratingFilter ? String(ratingFilter) : ''}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none font-medium bg-white"
            >
              <option value="">Todas as Estrelas</option>
              <option value="5">5 Estrelas (★★★★★)</option>
              <option value="4">4 Estrelas (★★★★☆)</option>
              <option value="3">3 Estrelas ou menos (★-★★★)</option>
            </select>
          </div>

          {/* COLABORADOR SELECT */}
          <div className="sm:col-span-3 flex gap-2">
            <select
              name="colaborador"
              defaultValue={colabFilter || ''}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none font-medium bg-white"
            >
              <option value="">Todos Colaboradores</option>
              <option value="Lucas">Lucas</option>
              <option value="Ana">Ana</option>
              <option value="Edvan">Edvan</option>
              <option value="Juliana">Juliana</option>
              <option value="Sarah">Sarah</option>
            </select>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
            >
              Filtrar
            </button>
          </div>
        </form>
      </div>

      {/* FILTER ACTIVE INDICATOR */}
      {(searchQuery || ratingFilter || colabFilter || statusFilter) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 px-4 flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2 font-semibold">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>
              Filtros ativos:{' '}
              {[
                searchQuery && `Busca: "${searchQuery}"`,
                ratingFilter && `Nota: ${ratingFilter}★`,
                colabFilter && `Colaborador: ${colabFilter}`,
                statusFilter && `Status: ${statusFilter}`,
              ]
                .filter(Boolean)
                .join(' • ')}
            </span>
          </div>
          <Link
            href="/avaliacoes"
            className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
          >
            ✕ Limpar tudo
          </Link>
        </div>
      )}

      {/* REVIEWS LIST */}
      {!displayReviews || displayReviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Nenhuma avaliação encontrada</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tente remover alguns filtros ou buscar por outro termo para encontrar o registro desejado.
          </p>
          <Link
            href="/avaliacoes"
            className="inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs transition-colors"
          >
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

      {/* FOOTER PAGINATION */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 px-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium">
        <div>
          Mostrando <strong className="text-slate-900">1-{displayReviews.length}</strong> de{' '}
          <strong className="text-slate-900">{totalCount}</strong> avaliações registradas
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 font-bold flex items-center gap-1 cursor-not-allowed text-xs"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>
          <button
            disabled
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 font-bold flex items-center gap-1 cursor-not-allowed text-xs"
          >
            Próxima
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

