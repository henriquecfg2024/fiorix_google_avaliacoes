import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateConnector } from '@/lib/connectorAuth';
import { getLatestReleaseManifest, getReleaseArtifactDir } from '@/lib/connector/ha-manager';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const secret = authHeader.replace('Bearer ', '').trim();
  const connectorId =
    req.headers.get('x-connector-id')?.trim() ||
    req.nextUrl.searchParams.get('connectorId')?.trim() ||
    '';

  const authResult = await authenticateConnector(connectorId, secret);
  if (!authResult.success || !authResult.connector || !authResult.tenant) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const manifest = getLatestReleaseManifest();
  if (!manifest) {
    return NextResponse.json(
      { error: 'Release manifest unavailable' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const asset = (req.nextUrl.searchParams.get('asset') || 'manifest').toLowerCase();

  if (asset === 'manifest') {
    return NextResponse.json(manifest, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const artifactDir = getReleaseArtifactDir();

  if (asset === 'bundle') {
    const gzPath = path.join(artifactDir, 'index.js.gz');
    if (!fs.existsSync(gzPath)) {
      return NextResponse.json({ error: 'Bundle artifact not found' }, { status: 404 });
    }
    const rawBuffer = zlib.gunzipSync(fs.readFileSync(gzPath));
    return new NextResponse(new Uint8Array(rawBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Content-Length': String(rawBuffer.length),
        'Cache-Control': 'private, no-store',
        'X-Release-Version': manifest.version,
        'X-Checksum-Sha256': manifest.bundle.sha256,
      },
    });
  }

  if (asset === 'nssm') {
    const gzPath = path.join(artifactDir, 'nssm.exe.gz');
    if (!fs.existsSync(gzPath) || !manifest.nssm) {
      return NextResponse.json({ error: 'NSSM binary not found' }, { status: 404 });
    }
    const rawBuffer = zlib.gunzipSync(fs.readFileSync(gzPath));
    return new NextResponse(new Uint8Array(rawBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(rawBuffer.length),
        'Cache-Control': 'private, no-store',
        'X-Checksum-Sha256': manifest.nssm.sha256,
      },
    });
  }

  if (asset === 'rust-cli') {
    const gzPath = path.join(artifactDir, 'fiorix-gd-cli.exe.gz');
    if (!fs.existsSync(gzPath) || !manifest.rustCli) {
      return NextResponse.json({ error: 'Rust CLI binary not found' }, { status: 404 });
    }
    const rawBuffer = zlib.gunzipSync(fs.readFileSync(gzPath));
    return new NextResponse(new Uint8Array(rawBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(rawBuffer.length),
        'Cache-Control': 'private, no-store',
        'X-Checksum-Sha256': manifest.rustCli.sha256,
      },
    });
  }

  return NextResponse.json(
    { error: 'Unknown asset parameter. Expected manifest, bundle, nssm, or rust-cli.' },
    { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

