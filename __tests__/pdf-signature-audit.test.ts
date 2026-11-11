import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createHash, generateKeyPairSync, sign as cryptoSign, X509Certificate } from 'node:crypto';
import {
  auditPdfSignatures,
  normalizeSignatureAuditResult,
  applyExternalConferenceToAudit,
  type ConferenciaExternaAssinatura,
} from '@/lib/documental/pdfSignatureAudit';

// Helpers ASN.1 DER para construção de certificado X.509 v3 e pacote CMS/PKCS#7 real nos testes
function derLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len <= 0xff) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function derNode(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derSequence(items: Buffer[]): Buffer {
  return derNode(0x30, Buffer.concat(items));
}

function derSet(items: Buffer[]): Buffer {
  return derNode(0x31, Buffer.concat(items));
}

function derOid(oidStr: string): Buffer {
  const parts = oidStr.split('.').map(Number);
  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    const stack: number[] = [v & 0x7f];
    v = Math.floor(v / 128);
    while (v > 0) {
      stack.push((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    bytes.push(...stack.reverse());
  }
  return derNode(0x06, Buffer.from(bytes));
}

function derInteger(numOrBuf: number | Buffer): Buffer {
  if (typeof numOrBuf === 'number') {
    return derNode(0x02, Buffer.from([numOrBuf]));
  }
  const b = numOrBuf[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), numOrBuf]) : numOrBuf;
  return derNode(0x02, b);
}

function derUtf8String(str: string): Buffer {
  return derNode(0x0c, Buffer.from(str, 'utf8'));
}

function derUtcTime(str: string): Buffer {
  return derNode(0x17, Buffer.from(str, 'ascii'));
}

function derName(cn: string, org: string): Buffer {
  const rdnCn = derSet([derSequence([derOid('2.5.4.3'), derUtf8String(cn)])]);
  const rdnOrg = derSet([derSequence([derOid('2.5.4.10'), derUtf8String(org)])]);
  return derSequence([rdnOrg, rdnCn]);
}

function buildSelfSignedX509CertificateDer(options: {
  subjectCn: string;
  issuerCn: string;
  org: string;
  serialBytes: Buffer;
  notBeforeUtc: string;
  notAfterUtc: string;
}): { certDer: Buffer; privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'] } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;

  const versionExplicit = derNode(0xa0, derInteger(2)); // v3
  const serial = derInteger(options.serialBytes);
  const sigAlgSha256Rsa = derSequence([
    derOid('1.2.840.113549.1.1.11'), // sha256WithRSAEncryption
    Buffer.from([0x05, 0x00]),
  ]);
  const issuer = derName(options.issuerCn, options.org);
  const validity = derSequence([
    derUtcTime(options.notBeforeUtc),
    derUtcTime(options.notAfterUtc),
  ]);
  const subject = derName(options.subjectCn, options.org);

  const tbsCert = derSequence([
    versionExplicit,
    serial,
    sigAlgSha256Rsa,
    issuer,
    validity,
    subject,
    spkiDer,
  ]);

  const signature = cryptoSign('sha256', tbsCert, privateKey);
  const bitStringSig = derNode(0x03, Buffer.concat([Buffer.from([0x00]), signature]));
  const certDer = derSequence([tbsCert, sigAlgSha256Rsa, bitStringSig]);

  // Garante que o Node.js reconhece como X509Certificate válido
  const parsed = new X509Certificate(certDer);
  expect(parsed.subject).toContain(options.subjectCn);

  return { certDer, privateKey };
}

function buildValidSignedPdfBuffer(options?: {
  subjectCn?: string;
  issuerCn?: string;
  signingTimeUtc?: string;
  tamperBodyAfterSigning?: boolean;
  tamperSignatureBytes?: boolean;
}): Buffer {
  const serialBytes = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const { certDer, privateKey } = buildSelfSignedX509CertificateDer({
    subjectCn: options?.subjectCn || 'MARIA DA SILVA:12345678909',
    issuerCn: options?.issuerCn || 'AC VALID RFB v5',
    org: 'ICP-Brasil',
    serialBytes,
    notBeforeUtc: '240101000000Z',
    notAfterUtc: '291231235959Z',
  });

  const reservedHexChars = 8192;
  const prefixPlaceholder =
    '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached ' +
    '/ByteRange [0 00000000 00000000 00000000] /Contents ';
  const suffix = '\n>>\nendobj\n%%EOF\n';

  const l1 = Buffer.byteLength(prefixPlaceholder, 'latin1');
  const o2 = l1 + reservedHexChars + 2; // inclui '<' e '>'
  const l2 = Buffer.byteLength(suffix, 'latin1');

  const formattedBr = `[0 ${String(l1).padStart(8, ' ')} ${String(o2).padStart(8, ' ')} ${String(l2).padStart(8, ' ')}]`;
  const realPrefix = prefixPlaceholder.replace(
    '[0 00000000 00000000 00000000]',
    formattedBr,
  );
  expect(Buffer.byteLength(realPrefix, 'latin1')).toBe(l1);

  const prefixBuf = Buffer.from(realPrefix, 'latin1'); // até imediatamente antes de '<'
  const suffixBuf = Buffer.from(suffix, 'latin1'); // imediatamente após '>'

  // Calcula hash SHA-256 sobre os intervalos assinados [0..l1] e [o2..o2+l2]
  const docDigest = createHash('sha256')
    .update(prefixBuf)
    .update(suffixBuf)
    .digest();

  // Monta SignedAttributes (SET OF 0x31 para assinatura, IMPLICIT [0] 0xA0 no SignerInfo)
  const attrContentType = derSequence([
    derOid('1.2.840.113549.1.9.3'),
    derSet([derOid('1.2.840.113549.1.7.1')]),
  ]);
  const attrSigningTime = derSequence([
    derOid('1.2.840.113549.1.9.5'),
    derSet([derUtcTime(options?.signingTimeUtc || '260615143000Z')]),
  ]);
  const attrMessageDigest = derSequence([
    derOid('1.2.840.113549.1.9.4'),
    derSet([derNode(0x04, docDigest)]),
  ]);

  const signedAttrsContent = Buffer.concat([
    attrContentType,
    attrSigningTime,
    attrMessageDigest,
  ]);
  const signedAttrsSetForSigning = derNode(0x31, signedAttrsContent);
  const signedAttrsImplicit = derNode(0xa0, signedAttrsContent);

  const rsaSig = cryptoSign('sha256', signedAttrsSetForSigning, privateKey);
  if (options?.tamperSignatureBytes) {
    rsaSig[0] ^= 0xff;
  }

  const algSha256 = derSequence([
    derOid('2.16.840.1.101.3.4.2.1'),
    Buffer.from([0x05, 0x00]),
  ]);
  const algRsa = derSequence([
    derOid('1.2.840.113549.1.1.11'),
    Buffer.from([0x05, 0x00]),
  ]);

  const issuerAndSerial = derSequence([
    derName(options?.issuerCn || 'AC VALID RFB v5', 'ICP-Brasil'),
    derInteger(serialBytes),
  ]);

  const signerInfo = derSequence([
    derInteger(1),
    issuerAndSerial,
    algSha256,
    signedAttrsImplicit,
    algRsa,
    derNode(0x04, rsaSig),
  ]);

  const signedData = derSequence([
    derInteger(1),
    derSet([algSha256]),
    derSequence([derOid('1.2.840.113549.1.7.1')]),
    derNode(0xa0, certDer),
    derSet([signerInfo]),
  ]);

  const contentInfo = derSequence([
    derOid('1.2.840.113549.1.7.2'),
    derNode(0xa0, signedData),
  ]);

  const hexCms = contentInfo.toString('hex').toUpperCase().padEnd(reservedHexChars, '0');
  expect(hexCms.length).toBe(reservedHexChars);

  const finalPdf = Buffer.concat([
    prefixBuf,
    Buffer.from('<' + hexCms + '>', 'latin1'),
    suffixBuf,
  ]);

  if (options?.tamperBodyAfterSigning) {
    // Altera um byte dentro da área assinada (fora do /Contents) após a assinatura
    const idx = finalPdf.indexOf('Catalog');
    finalPdf[idx] = 0x58; // 'Xatalog'
  }

  return finalPdf;
}

describe('Módulo de Auditoria Técnica de Assinaturas Digitais (PAdES/CMS)', () => {
  it('1. PDF sem assinatura digital: classifica como NENHUMA_ASSINATURA_DETECTADA e calcula hash SHA-256', () => {
    const unsignedPdf = Buffer.from(
      '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF\n',
      'latin1',
    );
    const result = auditPdfSignatures(unsignedPdf);

    expect(result.status_auditoria).toBe('NENHUMA_ASSINATURA_DETECTADA');
    expect(result.possui_assinatura_criptografica).toBe(false);
    expect(result.possui_indicio_visual_sem_criptografia).toBe(false);
    expect(result.hash_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.certificados_signatarios).toHaveLength(0);
    expect(result.autoridades_certificadoras).toHaveLength(0);
  });

  it('2. Assinatura apenas visual ou menção textual a ICP-Brasil: não considera texto/carimbo como prova criptográfica', () => {
    const visualOnlyPdf = Buffer.from(
      '%PDF-1.7\n1 0 obj\n<< /Type /Page >>\nstream\n' +
        'Documento assinado digitalmente por JOAO DA SILVA conforme padrão ICP-Brasil (AC VALID RFB v5). ' +
        'Verifique em https://validar.iti.gov.br Código de verificação: ABCD-1234.\n' +
        'endstream\nendobj\n%%EOF\n',
      'latin1',
    );
    const result = auditPdfSignatures(visualOnlyPdf);

    expect(result.status_auditoria).toBe('NENHUMA_ASSINATURA_DETECTADA');
    expect(result.possui_assinatura_criptografica).toBe(false);
    expect(result.possui_indicio_visual_sem_criptografia).toBe(true);
    expect(result.motivo_status).toContain('não constitui prova criptográfica');
  });

  it('3. Falha na análise do arquivo: diferencia arquivo vazio ou corrompido de documento sem assinatura', () => {
    const emptyResult = auditPdfSignatures(Buffer.alloc(0));
    expect(emptyResult.status_auditoria).toBe('FALHA_ANALISE_ARQUIVO');

    const nonPdfResult = auditPdfSignatures(Buffer.from('ARQUIVO_CORROMPIDO_SEM_CABECALHO', 'utf8'));
    expect(nonPdfResult.status_auditoria).toBe('FALHA_ANALISE_ARQUIVO');
    expect(nonPdfResult.motivo_status).toContain('%PDF-');
  });

  it('4. Validação inconclusiva: dicionário /Sig com /Contents vazio (zeros) é classificado como VALIDACAO_INCONCLUSIVA', () => {
    const emptyContentsPdf = Buffer.from(
      '%PDF-1.7\n1 0 obj\n<< /Type /Sig /SubFilter /adbe.pkcs7.detached /ByteRange [0 50 150 20] /Contents <0000000000000000> >>\nendobj\n%%EOF\n',
      'latin1',
    );
    const result = auditPdfSignatures(emptyContentsPdf);

    expect(result.status_auditoria).toBe('VALIDACAO_INCONCLUSIVA');
    expect(result.possui_assinatura_criptografica).toBe(true);
  });

  it('5. Assinatura criptograficamente VÁLIDA: comprova ByteRange integral + messageDigest SHA-256 + chave pública X.509 e separa Signatário de AC', () => {
    const validPdf = buildValidSignedPdfBuffer({
      subjectCn: 'FAIRGREISE ALOIZIO VASCONCELOS:13598188858',
      issuerCn: 'AC VALID RFB v5',
    });

    const result = auditPdfSignatures(validPdf);

    expect(result.status_auditoria).toBe('ASSINATURA_VALIDA');
    expect(result.verificacoes_executadas.verificacao_alinhamento_byterange).toBe(true);
    expect(result.verificacoes_executadas.verificacao_hash_message_digest).toBe(true);
    expect(result.verificacoes_executadas.verificacao_assinatura_chave_publica_x509).toBe(true);
    expect(result.verificacoes_executadas.validacao_cadeia_iti_online).toBe(false);

    // Signatário separado da Autoridade Certificadora e com CPF mascarado
    expect(result.certificados_signatarios).toHaveLength(1);
    expect(result.certificados_signatarios[0].nome_exibicao).toBe('FAIRGREISE ALOIZIO VASCONCELOS');
    expect(result.certificados_signatarios[0].documento_mascarado).toBe('***.981.888-**');
    expect(result.certificados_signatarios[0].emissor_ac).toBe('AC VALID RFB v5');

    expect(result.autoridades_certificadoras.some((ac) => ac.nome_exibicao === 'AC VALID RFB v5')).toBe(
      true,
    );
    expect(result.signatarios_detectados).toEqual(['FAIRGREISE ALOIZIO VASCONCELOS']);
    expect(result.signatarios_detectados).not.toContain('AC VALID RFB v5');
  });

  it('6. Assinatura INVÁLIDA por adulteração de bytes após a assinatura (divergência de messageDigest)', () => {
    const tamperedPdf = buildValidSignedPdfBuffer({
      tamperBodyAfterSigning: true,
    });

    const result = auditPdfSignatures(tamperedPdf);

    expect(result.status_auditoria).toBe('ASSINATURA_INVALIDA');
    expect(result.motivo_status).toContain('messageDigest');
    expect(result.detalhes_assinaturas[0].status_tecnico).toBe('INVALIDA');
  });

  it('7. Assinatura INVÁLIDA por corrupção da assinatura criptográfica RSA no SignerInfo', () => {
    const badSigPdf = buildValidSignedPdfBuffer({
      tamperSignatureBytes: true,
    });

    const result = auditPdfSignatures(badSigPdf);

    expect(result.status_auditoria).toBe('ASSINATURA_INVALIDA');
    expect(result.motivo_status).toContain('chave pública');
  });

  it('8. Assinatura INVÁLIDA quando a data da assinatura está fora da vigência do certificado X.509', () => {
    const expiredAtSigningPdf = buildValidSignedPdfBuffer({
      signingTimeUtc: '350101120000Z', // Ano 2035 > notAfter 2029
    });

    const result = auditPdfSignatures(expiredAtSigningPdf);

    expect(result.status_auditoria).toBe('ASSINATURA_INVALIDA');
    expect(result.motivo_status).toContain('período de validade');
  });

  it('9. Assinatura detectada em PDF mesclado (ByteRange parcial/deslocado): classifica como ASSINATURA_DETECTADA_VALIDACAO_PENDENTE', () => {
    const standaloneSigned = buildValidSignedPdfBuffer({
      subjectCn: 'MARIA ANTONIA:12345678909',
      issuerCn: 'AC Certisign RFB G5',
    });
    // Simula juntada/concatenação de capa antes do PDF assinado (deslocando o offset 0 do ByteRange)
    const coverPage = Buffer.from('%PDF-1.7\n% Capa juntada nos autos digitais\n', 'latin1');
    const mergedPdf = Buffer.concat([coverPage, standaloneSigned]);

    const result = auditPdfSignatures(mergedPdf);

    expect(result.status_auditoria).toBe('ASSINATURA_DETECTADA_VALIDACAO_PENDENTE');
    expect(result.detalhes_assinaturas[0].cobertura_byterange).toBe('DESALINHADO_PDF_MESCLADO');
    expect(result.certificados_signatarios[0].nome_exibicao).toBe('MARIA ANTONIA');
  });

  it('10. Higienização de payload legado: remove "Not specified", separa "AC VALID RFB v5" e "ICP-Brasil" dos signatários e nunca promove triagem para ASSINATURA_VALIDA', () => {
    const legacyPayload = {
      possui_assinatura_criptografica: true,
      status_validade: 'VALIDA_ICP_OU_HOMOLOGADA',
      padrao_detectado: 'ICP-Brasil (Assinatura Qualificada)',
      signatarios_detectados: [
        'Not specified',
        'AC VALID RFB v5',
        'FAHDPEDE ALOIZIO VASCONCELOS:13598188858',
        'Autoridade / Emissor: ICP-Brasil',
      ],
      possui_indicio_visual_sem_criptografia: false,
      titulo_exigencia: 'Conformidade Registral',
      texto_nota_devolucao: 'Sem nota de exigência',
      detalhes_assinaturas: [
        {
          signatario: 'FAHDPEDE ALOIZIO VASCONCELOS:13598188858',
          emissor: 'AC VALID RFB v5 (ICP-Brasil)',
          data_assinatura: 'Data registrada na assinatura digital',
          subfilter: 'adbe.pkcs7.detached (Padrão PAdES ICP-Brasil)',
          integridade: 'Documento íntegro (ByteRange válido)',
        },
      ],
    };

    const normalized = normalizeSignatureAuditResult(legacyPayload);

    expect(normalized.status_auditoria).toBe('ASSINATURA_DETECTADA_VALIDACAO_PENDENTE');
    expect(normalized.signatarios_detectados).toEqual(['FAHDPEDE ALOIZIO VASCONCELOS']);
    expect(normalized.signatarios_detectados).not.toContain('Not specified');
    expect(normalized.signatarios_detectados).not.toContain('AC VALID RFB v5');
    expect(normalized.signatarios_detectados).not.toContain('Autoridade / Emissor: ICP-Brasil');
    expect(normalized.autoridades_certificadoras.map((a) => a.nome_exibicao)).toContain(
      'AC VALID RFB v5',
    );
    expect(normalized.outros_componentes_cadeia.map((o) => o.nome_exibicao)).toContain(
      'Infraestrutura de Chaves Públicas Brasileira (ICP-Brasil)',
    );
    expect(normalized.detalhes_assinaturas[0].data_assinatura).toBe('Não informada no pacote CMS');
  });

  it('11. Conferência externa vinculada ao SHA-256 e invalidação automática quando os bytes do arquivo mudam', () => {
    const standaloneSigned = buildValidSignedPdfBuffer();
    const mergedPdfV1 = Buffer.concat([
      Buffer.from('%PDF-1.7\n% Versao 1\n', 'latin1'),
      standaloneSigned,
    ]);

    const auditV1 = auditPdfSignatures(mergedPdfV1);
    expect(auditV1.status_auditoria).toBe('ASSINATURA_DETECTADA_VALIDACAO_PENDENTE');
    expect(auditV1.hash_sha256).toBeTruthy();

    const confExterna: ConferenciaExternaAssinatura = {
      id: 'conf-001',
      hash_sha256: auditV1.hash_sha256!,
      resultado: 'VALIDA',
      responsavel_nome: 'Oficial Substituto',
      data_conferencia: '11/11/2026 18:30',
      orgao_verificador: 'ITI — Verificador de Conformidade (validar.iti.gov.br)',
      relatorio_conformidade: 'Aprovado conforme protocolo ITI 2026-XYZ',
      origem_registro: 'MANUAL_EXTERNO',
      hash_compativel_com_arquivo_atual: true,
    };

    const auditComConferencia = applyExternalConferenceToAudit(auditV1, confExterna);
    expect(auditComConferencia.status_auditoria).toBe('ASSINATURA_VALIDA');
    expect(auditComConferencia.origem_resultado).toBe('CONFERENCIA_EXTERNA_MANUAL');

    // Altera 1 byte do arquivo -> novo hash SHA-256 deve invalidar a conferência anterior
    const mergedPdfV2 = Buffer.concat([
      Buffer.from('%PDF-1.7\n% Versao 2 (alterada)\n', 'latin1'),
      standaloneSigned,
    ]);
    const auditV2 = auditPdfSignatures(mergedPdfV2);
    expect(auditV2.hash_sha256).not.toBe(auditV1.hash_sha256);

    const auditV2TentandoConfAntiga = applyExternalConferenceToAudit(auditV2, confExterna);
    expect(auditV2TentandoConfAntiga.status_auditoria).toBe('ASSINATURA_DETECTADA_VALIDACAO_PENDENTE');
    expect(auditV2TentandoConfAntiga.conferencia_externa).toBeNull();
    expect(auditV2TentandoConfAntiga.conferencia_externa_invalidada_por_alteracao).toBe(true);
  });

  it('12. Validação real sobre o PDF de autos 1162956-97.2024.8.26.0100.pdf (quando disponível localmente)', () => {
    const caminhoComAssinatura =
      'H:\\PROCESSOS - ENVIADOS POR E-MAIL\\PROCESSOS DIGITAIS 2024\\Enviados 1ª informação\\1162956-97.2024.8.26.0100.pdf';
    if (fs.existsSync(caminhoComAssinatura)) {
      const bytes = fs.readFileSync(caminhoComAssinatura);
      const res = auditPdfSignatures(bytes);
      expect(res.status_auditoria).toBe('ASSINATURA_DETECTADA_VALIDACAO_PENDENTE');
      expect(res.signatarios_detectados).toContain('FAIRGREISE ALOIZIO VASCONCELOS');
      expect(res.signatarios_detectados).not.toContain('Not specified');
      expect(res.signatarios_detectados).not.toContain('AC VALID RFB v5');
      expect(res.autoridades_certificadoras.some((ac) => ac.nome_exibicao === 'AC VALID RFB v5')).toBe(
        true,
      );
    }

    const caminhoSemAssinatura =
      'H:\\PROCESSOS - ENVIADOS POR E-MAIL\\PROCESSOS DIGITAIS 2024\\Respostas 2024\\1162956-97.2024.8.26.0100.pdf';
    if (fs.existsSync(caminhoSemAssinatura)) {
      const bytes = fs.readFileSync(caminhoSemAssinatura);
      const res = auditPdfSignatures(bytes);
      expect(res.status_auditoria).toBe('NENHUMA_ASSINATURA_DETECTADA');
      expect(res.possui_assinatura_criptografica).toBe(false);
    }
  });
});
