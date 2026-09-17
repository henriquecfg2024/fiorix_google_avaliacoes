export interface UploadResult {
  success: boolean;
  storagePath: string;
  publicUrl: string;
  error?: string;
}

/**
 * Realiza o upload de PDF de forma direta para o Supabase Storage via Signed URL.
 * Isso contorna o limite de payload de 4.5 MB da Vercel, transmitindo o arquivo
 * diretamente do navegador para o armazenamento na nuvem.
 */
export async function uploadItPdfDirectly(
  file: File,
  codigo: string = 'IT'
): Promise<UploadResult> {
  if (!file) {
    throw new Error('Nenhum arquivo PDF selecionado.');
  }

  // 1. Obter a Signed URL pré-autenticada no servidor
  let signData: any;
  let signErrorMsg = '';

  try {
    const signRes = await fetch('/api/its/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/pdf' }),
    });

    const rawSignText = await signRes.text();
    try {
      signData = JSON.parse(rawSignText);
    } catch {
      signErrorMsg = `Falha no serviço de autorização (${signRes.status}): ${rawSignText}`;
    }

    if (!signRes.ok || !signData?.success || !signData?.signedUrl) {
      signErrorMsg = signData?.error || `Erro de autorização no servidor (HTTP ${signRes.status}).`;
    }
  } catch (err: any) {
    signErrorMsg = err?.message || 'Falha de comunicação ao solicitar autorização de envio.';
  }

  // Se o endpoint dedicado falhar, tenta via Server Action getITUploadSignedUrl como fallback
  if (!signData?.signedUrl) {
    try {
      const { getITUploadSignedUrl } = await import('@/app/actions/its');
      const actionData = await getITUploadSignedUrl(file.name, file.type || 'application/pdf');
      if (actionData.success && actionData.signedUrl) {
        signData = actionData;
        signErrorMsg = '';
      } else if (actionData.error) {
        signErrorMsg = actionData.error;
      }
    } catch (actionErr: any) {
      console.warn('Fallback Server Action getITUploadSignedUrl falhou:', actionErr);
    }
  }

  // Se não foi possível obter a Signed URL:
  if (!signData?.signedUrl) {
    // Se o arquivo for maior que 4.2 MB, não pode usar o proxy da Vercel
    if (file.size > 4.2 * 1024 * 1024) {
      throw new Error(`Não foi possível autorizar o envio direto: ${signErrorMsg || 'Serviço de armazenamento indisponível.'}`);
    }

    // Para arquivos pequenos (< 4.2 MB), tenta fallback via proxy legada
    return await uploadViaProxy(file, codigo);
  }

  // 2. Transmissão DIRETA do navegador para o Supabase Storage via PUT streaming
  try {
    const uploadRes = await fetch(signData.signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/pdf',
      },
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => '');
      throw new Error(
        `O armazenamento rejeitou o arquivo (HTTP ${uploadRes.status}): ${errText || uploadRes.statusText}`
      );
    }

    return {
      success: true,
      storagePath: signData.storagePath,
      publicUrl: signData.publicUrl,
    };
  } catch (uploadErr: any) {
    console.error('Erro na transmissão direta para Supabase Storage:', uploadErr);

    // Se falhar o upload direto e o arquivo for pequeno, tenta proxy
    if (file.size <= 4.2 * 1024 * 1024) {
      console.warn('Tentando fallback via proxy para arquivo pequeno...');
      return await uploadViaProxy(file, codigo);
    }

    throw new Error(
      `Falha na transmissão do arquivo para a nuvem: ${uploadErr?.message || uploadErr}`
    );
  }
}

async function uploadViaProxy(file: File, codigo: string): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('codigo', codigo);

  const uploadRes = await fetch('/api/its/upload-pdf', {
    method: 'POST',
    body: fd,
  });

  const rawText = await uploadRes.text();
  let uploadJson: any;
  try {
    uploadJson = JSON.parse(rawText);
  } catch {
    if (uploadRes.status === 413 || rawText.includes('Request Entity Too Large')) {
      throw new Error('O arquivo excede o limite de upload do servidor proxy (máx. 4.5 MB).');
    }
    throw new Error(rawText || `Erro no servidor durante upload (${uploadRes.status})`);
  }

  if (!uploadRes.ok || !uploadJson?.success) {
    throw new Error(uploadJson?.error || 'Falha no upload do arquivo PDF.');
  }

  return {
    success: true,
    storagePath: uploadJson.storagePath,
    publicUrl: uploadJson.publicUrl,
  };
}
