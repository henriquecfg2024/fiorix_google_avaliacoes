import { supabase } from '@/lib/supabase';
import { getITUploadSignedUrl } from '@/app/actions/its';

export interface UploadResult {
  success: boolean;
  storagePath: string;
  publicUrl: string;
  error?: string;
}

/**
 * Realiza o upload de PDF de forma direta e segura para o Supabase Storage via Signed URL.
 * Isso contorna o limite de payload de 4.5 MB do Vercel Serverless Functions,
 * permitindo envio de arquivos até 20 MB sem erro de 'Request Entity Too Large'.
 */
export async function uploadItPdfDirectly(
  file: File,
  codigo: string = 'IT'
): Promise<UploadResult> {
  if (!file) {
    throw new Error('Nenhum arquivo PDF selecionado.');
  }

  // 1. Tenta upload direto com Signed URL (bypassa limite de 4.5MB da Vercel)
  try {
    const signedData = await getITUploadSignedUrl(file.name, file.type || 'application/pdf');

    if (signedData.success && signedData.path && signedData.token) {
      const { error: upError } = await supabase.storage
        .from('it-documentos')
        .uploadToSignedUrl(signedData.path, signedData.token, file);

      if (!upError) {
        return {
          success: true,
          storagePath: signedData.storagePath,
          publicUrl: signedData.publicUrl,
        };
      }
      console.warn('Falha no uploadToSignedUrl direto, avaliando fallback:', upError);
    } else {
      console.warn('getITUploadSignedUrl não retornou token/path:', signedData.error);
    }
  } catch (signedErr) {
    console.warn('Erro ao solicitar Signed URL:', signedErr);
  }

  // 2. Se o arquivo for maior que 4.2 MB, rejeitar antes de atingir o proxy da Vercel (limite estrito 4.5 MB)
  if (file.size > 4.2 * 1024 * 1024) {
    throw new Error(
      `O arquivo tem ${(file.size / (1024 * 1024)).toFixed(1)} MB e não pôde ser enviado diretamente para o armazenamento. Verifique sua conexão e tente novamente.`
    );
  }

  // 3. Fallback para proxy serverless Next.js (apenas para arquivos pequenos < 4.2 MB)
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
