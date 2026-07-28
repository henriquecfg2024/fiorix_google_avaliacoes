import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv';

  const session = await auth();
  const tenantId = (session?.user?.tenantId as string) || 'cartorio-7ri-sp';

  const reviews = await prisma.review.findMany({
    where: { tenantId },
    include: { response: true },
    orderBy: { publishedAt: 'desc' },
  });

  if (format === 'json') {
    const jsonString = JSON.stringify(reviews, null, 2);
    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="fiorix-avaliacoes-${tenantId}.json"`,
      },
    });
  }

  // CSV format
  const csvRows: string[] = [];
  csvRows.push(['ID', 'Avaliador', 'Nota', 'Comentário', 'Data Publicação', 'Status', 'Resposta'].map(v => `"${v}"`).join(','));

  for (const rev of reviews) {
    const row = [
      rev.googleId || rev.id,
      rev.reviewerName || '',
      rev.rating.toString(),
      (rev.comment || '').replace(/"/g, '""').replace(/\n/g, ' '),
      new Date(rev.publishedAt).toISOString(),
      rev.status === 'RESPONDED' ? 'Respondida' : 'Pendente',
      (rev.response?.content || '').replace(/"/g, '""').replace(/\n/g, ' ')
    ];
    csvRows.push(row.map(v => `"${v}"`).join(','));
  }

  const csvString = csvRows.join('\n');

  return new NextResponse(csvString, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fiorix-avaliacoes-${tenantId}.csv"`,
    },
  });
}
