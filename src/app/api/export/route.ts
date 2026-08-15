import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

function sanitizeCsvField(value: string | null | undefined): string {
  if (!value) return '';
  const str = String(value);
  // Se começar com caracteres perigosos de fórmula CSV/Excel/Calc, adiciona apóstrofo
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str.replace(/"/g, '""').replace(/\n/g, ' ')}`;
  }
  return str.replace(/"/g, '""').replace(/\n/g, ' ');
}

export async function GET(request: Request) {
  try {
    const user = await requireTenant();
    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

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

    // CSV format com sanitização contra CSV Injection
    const csvRows: string[] = [];
    csvRows.push(['ID', 'Avaliador', 'Nota', 'Comentário', 'Data Publicação', 'Status', 'Resposta'].map(v => `"${v}"`).join(','));

    for (const rev of reviews) {
      const row = [
        sanitizeCsvField(rev.googleId || rev.id),
        sanitizeCsvField(rev.reviewerName),
        rev.rating.toString(),
        sanitizeCsvField(rev.comment),
        new Date(rev.publishedAt).toISOString(),
        rev.status === 'RESPONDED' ? 'Respondida' : 'Pendente',
        sanitizeCsvField(rev.response?.content)
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
  } catch (error: any) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao exportar avaliações' }, { status: 401 });
  }
}

