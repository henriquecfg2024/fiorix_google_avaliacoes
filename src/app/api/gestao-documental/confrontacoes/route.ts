import { NextRequest, NextResponse } from 'next/server';
import {
  extrairConfrontacoes,
  resolverPlantaSetorQuadra,
  sanitizarDescricaoImovel,
  sanitizarLogradouroConfrontacao,
} from '@/lib/confrontacoes';

export const dynamic = 'force-dynamic';

interface UtmPoint {
  x: number;
  y: number;
}

interface GeoSampaLotFeature {
  id: string;
  geometry?: {
    type: string;
    coordinates: number[][][];
  };
  properties: {
    cd_setor_fiscal?: string;
    cd_quadra_fiscal?: string;
    cd_lote?: string;
    cd_digito_sql?: string;
    nr_contribuinte?: string;
    nm_logradouro_completo?: string;
    cd_numero_porta?: string;
    tx_complemento_endereco?: string;
    qt_area_terreno?: number;
    qt_area_construida?: number;
    dc_tipo_uso_imovel?: string;
    cd_cib?: string;
    nm_condominio?: string;
  };
}

/**
 * Converte coordenadas UTM Zona 23S (SIRGAS 2000 / EPSG:31983) para WGS84 (lat, lon).
 */
function utm23sToLatLon(easting: number, northing: number): { lat: number; lon: number } {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const k0 = 0.9996;
  const lon0 = (-45 * Math.PI) / 180;
  const e2 = 2 * f - f * f;
  const ep2 = e2 / (1 - e2);

  const x = easting - 500000.0;
  const y = northing - 10000000.0;
  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * Math.pow(e1, 4)) / 32) * Math.sin(4 * mu) +
    ((151 * Math.pow(e1, 3)) / 96) * Math.sin(6 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e2 * sinPhi1 * sinPhi1);
  const T1 = tanPhi1 * tanPhi1;
  const C1 = ep2 * cosPhi1 * cosPhi1;
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * sinPhi1 * sinPhi1, 1.5);
  const D = x / (N1 * k0);

  const latRad =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4)) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6)) / 720);

  const lonRad =
    lon0 +
    (D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5)) / 120) /
      cosPhi1;

  return {
    lat: (latRad * 180) / Math.PI,
    lon: (lonRad * 180) / Math.PI,
  };
}

function pointToSegmentDistance(p: UtmPoint, a: UtmPoint, b: UtmPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function extractRing(feature: GeoSampaLotFeature): UtmPoint[] {
  const coords = feature.geometry?.coordinates?.[0];
  if (!Array.isArray(coords)) return [];
  return coords
    .filter((pt): pt is number[] => Array.isArray(pt) && pt.length >= 2)
    .map(pt => ({ x: Number(pt[0]), y: Number(pt[1]) }));
}

function centroid(ring: UtmPoint[]): UtmPoint {
  if (ring.length === 0) return { x: 0, y: 0 };
  const pts = ring.length > 1 && ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y
    ? ring.slice(0, -1)
    : ring;
  const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / pts.length, y: sum.y / pts.length };
}

function minPolygonDistanceAndSharedMidpoint(
  ringA: UtmPoint[],
  ringB: UtmPoint[],
): { minDistance: number; sharedMidpoint: UtmPoint } {
  let minDistance = Infinity;
  const closePoints: UtmPoint[] = [];

  for (const pA of ringA) {
    for (let j = 0; j < ringB.length - 1; j++) {
      const d = pointToSegmentDistance(pA, ringB[j], ringB[j + 1]);
      if (d < minDistance) minDistance = d;
      if (d <= 1.2) closePoints.push(pA);
    }
  }
  for (const pB of ringB) {
    for (let i = 0; i < ringA.length - 1; i++) {
      const d = pointToSegmentDistance(pB, ringA[i], ringA[i + 1]);
      if (d < minDistance) minDistance = d;
      if (d <= 1.2) closePoints.push(pB);
    }
  }

  const sharedMidpoint = closePoints.length > 0 ? centroid(closePoints) : centroid(ringB);
  return { minDistance, sharedMidpoint };
}

function formatarDescricaoLoteVizinho(props: GeoSampaLotFeature['properties']): string {
  const lote = props.cd_lote || '';
  const porta = props.cd_numero_porta ? `nº ${props.cd_numero_porta}` : '';
  const logradouro = props.nm_logradouro_completo || '';
  const sql = props.nr_contribuinte || '';
  const partes: string[] = [];
  if (lote) partes.push(`lote ${lote}`);
  if (porta && logradouro) partes.push(`prédio ${porta} da ${logradouro}`);
  else if (logradouro) partes.push(logradouro);
  else if (porta) partes.push(porta);
  if (sql) partes.push(`SQL ${sql}`);
  return `com o ${partes.join(' (')}${partes.length > 1 ? ')'.repeat(partes.length - 1) : ''}`;
}

async function buscarSetorQuadraPorEnderecoNoGeoSampa(
  consultaEndereco: string,
  subdistrito?: string,
): Promise<{ setor: string; quadra: string; logradouroDetectado?: string; numeroDetectado?: string } | null> {
  const limpo = consultaEndereco
    .replace(/\b(?:im[óo]vel|situado|localizado|na|no|à|a|lote\s+\d+|quadra\s+\d+|cep\s*[0-9.\-]+)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (limpo.length < 4) return null;

  try {
    const resp = await fetch('https://novogeosampa.prefeitura.sp.gov.br/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        query: limpo.slice(0, 80),
        searches: [
          {
            searchDefinitionId: 10,
            enabled: true,
            order: 10,
            stopIfFound: false,
            name: 'Logradouros - Município de São Paulo',
          },
          {
            searchDefinitionId: 11,
            enabled: true,
            order: 20,
            stopIfFound: false,
            name: 'Setor.Quadra.Lote',
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as Array<{ displayText?: string }>;
    if (!Array.isArray(json) || json.length === 0) return null;

    const normSub = (subdistrito || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    const ordenado = [...json].sort((a, b) => {
      const ta = (a.displayText || '').toUpperCase();
      const tb = (b.displayText || '').toUpperCase();
      const aMatch = normSub && ta.includes(normSub.split(' ')[0]) ? 1 : 0;
      const bMatch = normSub && tb.includes(normSub.split(' ')[0]) ? 1 : 0;
      return bMatch - aMatch;
    });

    for (const item of ordenado) {
      const txt = item.displayText || '';
      const sqMatch = txt.match(/\b(\d{3})\.(\d{3})\b/);
      if (sqMatch) {
        const endMatch = txt.match(/^([^,\-]+)(?:,\s*(\d+[A-Za-z0-9\-]*))?/);
        return {
          setor: sqMatch[1],
          quadra: sqMatch[2],
          logradouroDetectado: endMatch?.[1]?.trim(),
          numeroDetectado: endMatch?.[2]?.trim(),
        };
      }
    }
  } catch {}
  return null;
}

async function consultarIntegracaoIptuGeoSampa(
  setor: string,
  quadra: string,
  lote: string,
): Promise<Record<string, string> | null> {
  if (!setor || !quadra || !lote) return null;
  try {
    const resp = await fetch('https://novogeosampa.prefeitura.sp.gov.br/Integration/Execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        integrationService: 'api_tpcl_lote_flatsetor_quadra_lote',
        setor,
        quadra,
        lote,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const headers: string[] = [];
    const values: string[] = [];

    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let m: RegExpExecArray | null;
    while ((m = thRegex.exec(html)) !== null) {
      headers.push(m[1].replace(/<[^>]+>/g, '').trim());
    }
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    while ((m = tdRegex.exec(html)) !== null) {
      values.push(m[1].replace(/<[^>]+>/g, '').trim());
    }

    if (headers.length === 0 || values.length === 0) return null;
    const out: Record<string, string> = {};
    for (let i = 0; i < Math.min(headers.length, values.length); i++) {
      if (headers[i]) out[headers[i]] = values[i];
    }
    return out;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sqlInput = String(body.sql || '').trim();
    const imovelRaw = String(body.imovel || '').trim();
    const imovelInput = sanitizarDescricaoImovel(imovelRaw);
    const ruaInput = sanitizarLogradouroConfrontacao(String(body.rua || '').trim(), imovelRaw);
    const subdistritoInput = String(body.subdistrito || '').trim();
    const matriculaInput = String(body.matricula || '').trim();
    const textoAutosInput = String(body.textoAutos || '').trim();

    // 1. Extração textual de confrontações a partir dos dados já presentes nos autos
    const confTexto = extrairConfrontacoes(`${imovelInput}\n${textoAutosInput}`);

    // 2. Identifica Setor, Quadra e Lote a partir do SQL ou da descrição do imóvel
    let infoPlanta = resolverPlantaSetorQuadra(sqlInput, imovelInput);
    let setor = infoPlanta?.setor || '';
    let quadra = infoPlanta?.quadra || '';
    let lote = infoPlanta?.lote || '';

    // Extrai possível número de porta e lote da descrição do imóvel
    const portaMatch =
      imovelInput.match(/(?:n[ºo°.]?\s*|,\s*)(\d{1,5})\b/i) ||
      ruaInput.match(/(?:n[ºo°.]?\s*|,\s*)(\d{1,5})\b/i);
    let numeroPorta = portaMatch ? portaMatch[1] : '';

    const loteTextoMatch = imovelInput.match(/\blote\s*(?:n[ºo°.]?)?\s*(\d{1,4})\b/i);
    if (!lote && loteTextoMatch) {
      lote = loteTextoMatch[1].padStart(4, '0');
    }

    // Se ainda não temos Setor e Quadra válidos, consulta a busca de endereço do Novo GeoSampa
    if (!setor || !quadra || setor === '000') {
      const termoEnd = ruaInput && numeroPorta ? `${ruaInput}, ${numeroPorta}` : imovelInput || ruaInput;
      const descoberto = await buscarSetorQuadraPorEnderecoNoGeoSampa(termoEnd, subdistritoInput);
      if (descoberto) {
        setor = descoberto.setor;
        quadra = descoberto.quadra;
        if (!numeroPorta && descoberto.numeroDetectado) {
          numeroPorta = descoberto.numeroDetectado;
        }
        infoPlanta = resolverPlantaSetorQuadra(`${setor}.${quadra}.${lote || '0000'}-0`, imovelInput);
      }
    }

    let loteAlvoProps: GeoSampaLotFeature['properties'] | null = null;
    let iptuIntegracao: Record<string, string> | null = null;
    let confrontantesGeoSampa: {
      frente: string;
      ladoDireito: string;
      ladoEsquerdo: string;
      fundos: string;
      vizinhos: Array<{
        direcao: 'DIREITO' | 'ESQUERDO' | 'FUNDOS' | 'LINDEIRO';
        lote: string;
        sql: string;
        logradouro: string;
        numeroPorta: string;
        areaTerreno?: number;
        distanciaMetros: number;
        descricaoFormatada: string;
      }>;
    } | null = null;
    let coordenadasMapa: { lat: number; lon: number } | null = null;

    // 3. Consulta WFS de Lotes do GeoSampa (geoportal:lote_cidadao) para obter a quadra inteira e calcular os confrontantes
    if (setor && quadra && setor !== '000') {
      try {
        const cql = encodeURIComponent(`cd_setor_fiscal='${setor}' AND cd_quadra_fiscal='${quadra}'`);
        const wfsUrl = `https://geoserver.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=geoportal:lote_cidadao&maxFeatures=450&outputFormat=application/json&CQL_FILTER=${cql}`;
        const wfsResp = await fetch(wfsUrl, { signal: AbortSignal.timeout(12000) });
        if (wfsResp.ok) {
          const geojson = (await wfsResp.json()) as { features?: GeoSampaLotFeature[] };
          const features = Array.isArray(geojson.features) ? geojson.features : [];

          if (features.length > 0) {
            const normRua = (ruaInput || imovelInput)
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toUpperCase();

            // Localiza o lote alvo dentro da quadra
            let alvo =
              (lote &&
                features.find(
                  f =>
                    f.properties?.cd_lote === lote.padStart(4, '0') ||
                    Number(f.properties?.cd_lote) === Number(lote),
                )) ||
              null;

            if (!alvo && numeroPorta) {
              alvo =
                features.find(
                  f =>
                    String(f.properties?.cd_numero_porta || '').trim() === numeroPorta &&
                    (!normRua ||
                      normRua.includes(
                        String(f.properties?.nm_logradouro_completo || '')
                          .split(' ')
                          .slice(-1)[0] || '',
                      )),
                ) ||
                features.find(f => String(f.properties?.cd_numero_porta || '').trim() === numeroPorta) ||
                null;
            }

            if (!alvo) {
              alvo = features[0];
            }

            if (alvo) {
              loteAlvoProps = alvo.properties;
              const loteCodigo = alvo.properties.cd_lote || lote;
              if (loteCodigo) {
                lote = loteCodigo;
                infoPlanta = resolverPlantaSetorQuadra(`${setor}.${quadra}.${loteCodigo}-0`, imovelInput);
              }

              const ringAlvo = extractRing(alvo);
              const centroAlvo = centroid(ringAlvo);
              if (centroAlvo.x > 100000 && centroAlvo.y > 1000000) {
                coordenadasMapa = utm23sToLatLon(centroAlvo.x, centroAlvo.y);
              }

              // Identifica os lotes vizinhos que tocam o polígono do lote alvo (distância <= 1.2m)
              const candidatosVizinhos: Array<{
                feature: GeoSampaLotFeature;
                minDistance: number;
                sharedMidpoint: UtmPoint;
              }> = [];

              for (const cand of features) {
                if (cand.id === alvo.id || cand.properties?.cd_lote === alvo.properties?.cd_lote) continue;
                const ringCand = extractRing(cand);
                if (ringCand.length < 3) continue;
                const { minDistance, sharedMidpoint } = minPolygonDistanceAndSharedMidpoint(ringAlvo, ringCand);
                if (minDistance <= 1.25) {
                  candidatosVizinhos.push({ feature: cand, minDistance, sharedMidpoint });
                }
              }

              // Determina a aresta frontal (voltada para a rua / logradouro) como as arestas de ringAlvo que não tocam lotes vizinhos
              const pontosFrente: UtmPoint[] = [];
              for (let i = 0; i < ringAlvo.length - 1; i++) {
                const midEdge = {
                  x: (ringAlvo[i].x + ringAlvo[i + 1].x) / 2,
                  y: (ringAlvo[i].y + ringAlvo[i + 1].y) / 2,
                };
                const tocaVizinho = candidatosVizinhos.some(v => {
                  const rV = extractRing(v.feature);
                  for (let j = 0; j < rV.length - 1; j++) {
                    if (pointToSegmentDistance(midEdge, rV[j], rV[j + 1]) <= 1.1) return true;
                  }
                  return false;
                });
                if (!tocaVizinho) {
                  pontosFrente.push(midEdge);
                }
              }

              const pontoFrente = pontosFrente.length > 0 ? centroid(pontosFrente) : { x: centroAlvo.x, y: centroAlvo.y - 10 };
              const vx = centroAlvo.x - pontoFrente.x;
              const vy = centroAlvo.y - pontoFrente.y;
              const vLen = Math.hypot(vx, vy) || 1;
              // Vetor unitário de quem da rua olha para o imóvel (frente -> fundos)
              const uFrenteFundos = { x: vx / vLen, y: vy / vLen };
              // Vetor unitário para a DIREITA de quem da rua olha para o imóvel: (u_y, -u_x)
              const uDireito = { x: uFrenteFundos.y, y: -uFrenteFundos.x };

              const logradouroAlvo = (alvo.properties?.nm_logradouro_completo || '').trim();
              let descDireito = '';
              let descEsquerdo = '';
              const descsFundos: string[] = [];

              const vizinhosClassificados = candidatosVizinhos
                .sort((a, b) => a.minDistance - b.minDistance)
                .map(v => {
                  const dx = v.sharedMidpoint.x - centroAlvo.x;
                  const dy = v.sharedMidpoint.y - centroAlvo.y;
                  const projDireita = dx * uDireito.x + dy * uDireito.y;
                  const projFundos = dx * uFrenteFundos.x + dy * uFrenteFundos.y;
                  const mesmoLogradouro =
                    Boolean(logradouroAlvo) &&
                    (v.feature.properties?.nm_logradouro_completo || '').trim() === logradouroAlvo;

                  let direcao: 'DIREITO' | 'ESQUERDO' | 'FUNDOS' | 'LINDEIRO' = 'LINDEIRO';
                  const descricaoFormatada = formatarDescricaoLoteVizinho(v.feature.properties);

                  if (!mesmoLogradouro && projFundos > Math.abs(projDireita) * 0.45) {
                    direcao = 'FUNDOS';
                    descsFundos.push(descricaoFormatada);
                  } else if (projDireita >= 0 && !descDireito) {
                    direcao = 'DIREITO';
                    descDireito = descricaoFormatada;
                  } else if (projDireita < 0 && !descEsquerdo) {
                    direcao = 'ESQUERDO';
                    descEsquerdo = descricaoFormatada;
                  } else if (projFundos > 0) {
                    direcao = 'FUNDOS';
                    descsFundos.push(descricaoFormatada);
                  } else if (projDireita >= 0) {
                    direcao = 'DIREITO';
                    if (!descDireito) descDireito = descricaoFormatada;
                  } else {
                    direcao = 'ESQUERDO';
                    if (!descEsquerdo) descEsquerdo = descricaoFormatada;
                  }

                  return {
                    direcao,
                    lote: v.feature.properties?.cd_lote || '',
                    sql: v.feature.properties?.nr_contribuinte || '',
                    logradouro: v.feature.properties?.nm_logradouro_completo || '',
                    numeroPorta: v.feature.properties?.cd_numero_porta || '',
                    areaTerreno: v.feature.properties?.qt_area_terreno,
                    distanciaMetros: Number(v.minDistance.toFixed(2)),
                    descricaoFormatada,
                  };
                });

              confrontantesGeoSampa = {
                frente: logradouroAlvo
                  ? `${logradouroAlvo}${alvo.properties?.cd_numero_porta ? `, nº ${alvo.properties.cd_numero_porta}` : ''}`
                  : ruaInput,
                ladoDireito: descDireito,
                ladoEsquerdo: descEsquerdo,
                fundos: descsFundos.join('; e '),
                vizinhos: vizinhosClassificados,
              };
            }
          }
        }
      } catch {}

      // 4. Consulta Integração de IPTU do Novo GeoSampa
      if (lote) {
        iptuIntegracao = await consultarIntegracaoIptuGeoSampa(setor, quadra, lote.padStart(4, '0'));
      }
    }

    const linkMapaLote = coordenadasMapa
      ? `https://novogeosampa.prefeitura.sp.gov.br/#map=19/${coordenadasMapa.lat.toFixed(5)}/${coordenadasMapa.lon.toFixed(5)}/0&layers=103/100/100/&basemap=5/100/100`
      : 'https://novogeosampa.prefeitura.sp.gov.br/#map=9.49/-23.67359/-46.60345/0&layers=103/100/100/&basemap=5/100/100';

    return NextResponse.json({
      ok: true,
      setor: setor || null,
      quadra: quadra || null,
      lote: lote || null,
      matricula: matriculaInput || null,
      confrontacoesTextoAutos: confTexto,
      plantaSetor: infoPlanta,
      loteGeoSampa: loteAlvoProps,
      iptuIntegracao,
      confrontantesGeoSampa,
      coordenadasMapa,
      linksGeoSampa: {
        portalNovoGeoSampa: 'https://novogeosampa.prefeitura.sp.gov.br/',
        mapaCamadasSetoresLotes: linkMapaLote,
        mapaPadrao:
          'https://novogeosampa.prefeitura.sp.gov.br/#map=9.49/-23.67359/-46.60345/0&layers=103/100/100/&basemap=5/100/100',
        atalhoCompartilhado: 'https://novogeosampa.prefeitura.sp.gov.br/u/RCdgNKWQ',
        geoSampaClassicoSbc: 'https://geosampa.prefeitura.sp.gov.br/PaginasPublicas/_SBC.aspx',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message || 'Erro ao consultar confrontações no GeoSampa.'),
      },
      { status: 500 },
    );
  }
}

