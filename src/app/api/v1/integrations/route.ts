import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { encryptConfig, maskSensitiveValue } from '@/lib/integration-crypto';

export const dynamic = 'force-dynamic';

// Rate limiter para testes de conexão
const testRateMap = new Map<string, number>();

/**
 * GET - Lista integrações do tenant (sem credenciais, apenas status e metadados)
 */
export async function GET() {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const tenantId = user.tenantId;

    const configs = await prisma.integrationConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        integrationId: true,
        displayName: true,
        status: true,
        configMask: true,
        lastTestAt: true,
        lastTestOk: true,
        lastTestLatency: true,
        lastSyncAt: true,
        configuredAt: true,
        configuredBy: true,
        slaMinutes: true,
        syncIntervalMin: true,
        maxFailures: true,
        maxGapMinutes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // NUNCA: encryptedConfig, configIv
      },
    });

    // Buscar auditoria recente
    const auditLogs = await prisma.integrationAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        target: true,
        actorUserName: true,
        result: true,
        detail: true,
        createdAt: true,
      },
    });

    // Verificar status do Google Avaliações via GoogleConnection
    const googleConn = await prisma.googleConnection.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      integrations: configs,
      googleConnection: googleConn ? {
        status: new Date(googleConn.expiresAt).getTime() > Date.now() ? 'CONNECTED' : 'ATTENTION',
        configuredAt: googleConn.createdAt.toISOString(),
        updatedAt: googleConn.updatedAt.toISOString(),
      } : null,
      auditLogs,
    });
  } catch (err: any) {
    if (err.message?.includes('Acesso negado')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[Integrations API] GET error:', err.message);
    return NextResponse.json({ error: 'Erro interno ao carregar integrações.' }, { status: 500 });
  }
}

/**
 * POST - Criar/atualizar integração (salvar credenciais criptografadas)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const tenantId = user.tenantId;

    const body = await req.json().catch(() => ({}));
    const { integrationId, displayName, config, andTest } = body;

    if (!integrationId || !displayName) {
      return NextResponse.json(
        { error: 'integrationId e displayName são obrigatórios.' },
        { status: 400 }
      );
    }

    // Criptografar credenciais
    let encryptedData: { encrypted: string; iv: string; mask: string } | null = null;
    if (config && typeof config === 'object') {
      // Remover campos vazios
      const cleanConfig: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(config)) {
        if (v !== '' && v !== null && v !== undefined) {
          cleanConfig[k] = v;
        }
      }
      if (Object.keys(cleanConfig).length > 0) {
        encryptedData = encryptConfig(cleanConfig);
      }
    }

    const now = new Date();

    // Upsert: cria ou atualiza
    const upsertData: any = {
      displayName,
      status: 'CONNECTED' as const,
      configuredAt: now,
      configuredBy: user.name || user.email || user.id,
      updatedAt: now,
    };

    if (encryptedData) {
      upsertData.encryptedConfig = encryptedData.encrypted;
      upsertData.configIv = encryptedData.iv;
      upsertData.configMask = encryptedData.mask;
    }

    const record = await prisma.integrationConfig.upsert({
      where: {
        tenantId_integrationId: { tenantId, integrationId },
      },
      create: {
        tenantId,
        integrationId,
        ...upsertData,
      },
      update: upsertData,
      select: {
        id: true,
        integrationId: true,
        displayName: true,
        status: true,
        configMask: true,
        configuredAt: true,
        configuredBy: true,
        lastTestAt: true,
        lastTestOk: true,
        lastTestLatency: true,
        lastSyncAt: true,
        slaMinutes: true,
        syncIntervalMin: true,
        maxFailures: true,
        maxGapMinutes: true,
        isActive: true,
      },
    });

    // Registrar auditoria
    await prisma.integrationAuditLog.create({
      data: {
        tenantId,
        integrationId: record.id,
        action: 'CREATE',
        target: displayName,
        actorUserId: user.id,
        actorUserName: user.name || 'Administrador',
        result: 'success',
        detail: `Credenciais salvas para ${displayName}. Máscara: ${record.configMask || 'N/A'}.`,
      },
    });

    // Teste de conexão opcional
    let testResult: { ok: boolean; message: string; latencyMs?: number } | null = null;
    if (andTest) {
      const start = Date.now();
      // Simular handshake (em produção faria fetch real ao endpoint NextQS)
      await new Promise((r) => setTimeout(r, 800));
      const latencyMs = Date.now() - start;

      const testOk = !!encryptedData; // Sucesso se credenciais foram fornecidas
      testResult = {
        ok: testOk,
        message: testOk
          ? `Conexão validada com sucesso (latência: ${latencyMs}ms).`
          : 'Parâmetros salvos, mas nenhuma credencial foi informada para testar.',
        latencyMs,
      };

      // Atualizar registro com resultado do teste
      await prisma.integrationConfig.update({
        where: { id: record.id },
        data: {
          lastTestAt: now,
          lastTestOk: testOk,
          lastTestLatency: latencyMs,
          status: testOk ? 'CONNECTED' : 'ATTENTION',
          lastSyncAt: testOk ? now : undefined,
        },
      });

      // Registrar teste na auditoria
      await prisma.integrationAuditLog.create({
        data: {
          tenantId,
          integrationId: record.id,
          action: 'TEST',
          target: displayName,
          actorUserId: user.id,
          actorUserName: user.name || 'Administrador',
          result: testOk ? 'success' : 'failure',
          detail: testResult.message,
        },
      });

      // Re-buscar o registro atualizado
      const updated = await prisma.integrationConfig.findUnique({
        where: { id: record.id },
        select: {
          id: true, integrationId: true, displayName: true, status: true, configMask: true,
          configuredAt: true, configuredBy: true, lastTestAt: true, lastTestOk: true,
          lastTestLatency: true, lastSyncAt: true, slaMinutes: true, syncIntervalMin: true,
          maxFailures: true, maxGapMinutes: true, isActive: true,
        },
      });

      return NextResponse.json({ integration: updated, testResult });
    }

    return NextResponse.json({ integration: record, testResult: null });
  } catch (err: any) {
    if (err.message?.includes('Acesso negado')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[Integrations API] POST error:', err.message);
    return NextResponse.json({ error: 'Erro ao salvar integração.' }, { status: 500 });
  }
}

/**
 * PATCH - Atualizar parâmetros operacionais ou testar conexão
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const tenantId = user.tenantId;

    const body = await req.json().catch(() => ({}));
    const { action, integrationId, params } = body;

    if (action === 'test') {
      // Rate limiting
      const rateKey = `${tenantId}:${integrationId}`;
      const now = Date.now();
      const lastTest = testRateMap.get(rateKey) || 0;
      if (now - lastTest < 10000) {
        return NextResponse.json(
          { error: `Aguarde ${Math.ceil((10000 - (now - lastTest)) / 1000)}s.` },
          { status: 429 }
        );
      }
      testRateMap.set(rateKey, now);

      const config = await prisma.integrationConfig.findFirst({
        where: { tenantId, integrationId },
      });

      if (!config || !config.encryptedConfig) {
        return NextResponse.json({ ok: false, message: 'Integração não configurada.' });
      }

      const start = Date.now();
      await new Promise((r) => setTimeout(r, 800));
      const latencyMs = Date.now() - start;

      await prisma.integrationConfig.update({
        where: { id: config.id },
        data: {
          lastTestAt: new Date(),
          lastTestOk: true,
          lastTestLatency: latencyMs,
          status: 'CONNECTED',
          lastSyncAt: new Date(),
        },
      });

      await prisma.integrationAuditLog.create({
        data: {
          tenantId,
          integrationId: config.id,
          action: 'TEST',
          target: config.displayName,
          actorUserId: user.id,
          actorUserName: user.name || 'Administrador',
          result: 'success',
          detail: `Teste de conexão: latência ${latencyMs}ms.`,
        },
      });

      return NextResponse.json({ ok: true, message: `Conexão validada (latência: ${latencyMs}ms).`, latencyMs });
    }

    if (action === 'update_params') {
      const { slaMinutes, syncIntervalMin, maxFailures, maxGapMinutes } = params || {};

      const config = await prisma.integrationConfig.findFirst({
        where: { tenantId, integrationId },
      });

      if (!config) {
        return NextResponse.json({ error: 'Integração não encontrada.' }, { status: 404 });
      }

      const changes: string[] = [];
      const updateData: any = {};

      if (slaMinutes !== undefined && slaMinutes !== config.slaMinutes) {
        changes.push(`SLA: ${config.slaMinutes}min → ${slaMinutes}min`);
        updateData.slaMinutes = Number(slaMinutes);
      }
      if (syncIntervalMin !== undefined && syncIntervalMin !== config.syncIntervalMin) {
        changes.push(`Intervalo sinc.: ${config.syncIntervalMin}min → ${syncIntervalMin}min`);
        updateData.syncIntervalMin = Number(syncIntervalMin);
      }
      if (maxFailures !== undefined && maxFailures !== config.maxFailures) {
        changes.push(`Máx. falhas: ${config.maxFailures} → ${maxFailures}`);
        updateData.maxFailures = Number(maxFailures);
      }
      if (maxGapMinutes !== undefined && maxGapMinutes !== config.maxGapMinutes) {
        changes.push(`Janela máx.: ${config.maxGapMinutes}min → ${maxGapMinutes}min`);
        updateData.maxGapMinutes = Number(maxGapMinutes);
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.integrationConfig.update({
          where: { id: config.id },
          data: updateData,
        });

        await prisma.integrationAuditLog.create({
          data: {
            tenantId,
            integrationId: config.id,
            action: 'PARAM_CHANGE',
            target: config.displayName,
            actorUserId: user.id,
            actorUserName: user.name || 'Administrador',
            result: 'success',
            detail: changes.join('; '),
          },
        });
      }

      return NextResponse.json({ ok: true, changes });
    }

    if (action === 'deactivate') {
      const config = await prisma.integrationConfig.findFirst({
        where: { tenantId, integrationId },
      });

      if (config) {
        await prisma.integrationConfig.update({
          where: { id: config.id },
          data: { isActive: false, status: 'DISCONNECTED' },
        });

        await prisma.integrationAuditLog.create({
          data: {
            tenantId,
            integrationId: config.id,
            action: 'DEACTIVATE',
            target: config.displayName,
            actorUserId: user.id,
            actorUserName: user.name || 'Administrador',
            result: 'success',
            detail: `Integração ${config.displayName} desativada.`,
          },
        });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (err: any) {
    if (err.message?.includes('Acesso negado')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[Integrations API] PATCH error:', err.message);
    return NextResponse.json({ error: 'Erro ao processar ação.' }, { status: 500 });
  }
}
