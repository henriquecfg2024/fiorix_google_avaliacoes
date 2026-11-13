/**
 * FIORIX Security — Sanitizador determinístico de HTML documental (Allowlist estrita)
 * Previne Stored/DOM XSS em documentos extraídos de .doc, .docx, .txt e .rtf sem
 * depender de DOM do navegador (funciona identicamente em Node.js e Client React).
 */

const BLOCK_STRIP_TAGS = [
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'svg',
  'math',
  'form',
  'button',
  'textarea',
  'select',
  'option',
  'noscript',
  'template',
];

const VOID_STRIP_TAGS = ['input', 'meta', 'link', 'base', 'source', 'track', 'param'];

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'hr',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'blockquote',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'a',
  'img',
]);

const VOID_ALLOWED_TAGS = new Set(['br', 'hr', 'img']);

export function escapeHtmlEntities(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function plainTextToSafeHtml(rawText: string): string {
  const safe = escapeHtmlEntities(rawText || '');
  if (!safe.trim()) {
    return '<p>Sem texto detectável.</p>';
  }
  return safe
    .split(/\r?\n\s*\r?\n/)
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => `<p>${chunk.replace(/\r?\n/g, '<br/>')}</p>`)
    .join('\n');
}

function sanitizeSafeHref(value: string): string | null {
  const trimmed = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, '');
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return escapeHtmlEntities(trimmed);
  }
  return null;
}

function sanitizeSafeImgSrc(value: string): string | null {
  const trimmed = value.trim();
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
    return escapeHtmlEntities(trimmed.replace(/\s+/g, ''));
  }
  return null;
}

function sanitizeAllowedAttributes(tagName: string, rawAttrs: string): string {
  if (!rawAttrs || !rawAttrs.trim()) {
    return '';
  }

  const kept: string[] = [];
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    const attrName = match[1].toLowerCase();
    const attrVal = match[2] ?? match[3] ?? match[4] ?? '';

    // Bloqueia todos os event handlers (onclick, onerror, onload...) e atributos ativos
    if (attrName.startsWith('on') || attrName === 'srcdoc' || attrName === 'formaction') {
      continue;
    }

    if ((tagName === 'td' || tagName === 'th') && (attrName === 'colspan' || attrName === 'rowspan')) {
      const n = parseInt(attrVal, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 50) {
        kept.push(`${attrName}="${n}"`);
      }
      continue;
    }

    if (tagName === 'a' && attrName === 'href') {
      const safeHref = sanitizeSafeHref(attrVal);
      if (safeHref) {
        kept.push(`href="${safeHref}"`, 'rel="noopener noreferrer"', 'target="_blank"');
      }
      continue;
    }

    if (tagName === 'img') {
      if (attrName === 'src') {
        const safeSrc = sanitizeSafeImgSrc(attrVal);
        if (safeSrc) {
          kept.push(`src="${safeSrc}"`);
        }
      } else if (attrName === 'alt') {
        kept.push(`alt="${escapeHtmlEntities(attrVal.slice(0, 200))}"`);
      }
      continue;
    }

    if (attrName === 'class') {
      const safeClass = attrVal.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
      if (safeClass) {
        kept.push(`class="${safeClass}"`);
      }
    }
  }

  if (tagName === 'img' && !kept.some((a) => a.startsWith('src="'))) {
    return '__DROP_TAG__';
  }

  return kept.length > 0 ? ' ' + kept.join(' ') : '';
}

export function sanitizeDocumentHtml(
  dirtyHtml?: string | null,
  fallbackPlainText?: string | null
): string {
  const rawHtml = typeof dirtyHtml === 'string' ? dirtyHtml.trim() : '';
  if (!rawHtml) {
    return plainTextToSafeHtml(fallbackPlainText || '');
  }

  let cleaned = rawHtml
    // Remove comentários HTML e declarações CDATA/DOCTYPE
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');

  // Remove blocos perigosos completos com seu conteúdo interno
  for (const tag of BLOCK_STRIP_TAGS) {
    const blockRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    const unclosedRe = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    cleaned = cleaned.replace(blockRe, '').replace(unclosedRe, '');
  }

  for (const tag of VOID_STRIP_TAGS) {
    const voidRe = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
    cleaned = cleaned.replace(voidRe, '');
  }

  // Filtra tags restantes contra allowlist estrita
  cleaned = cleaned.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g, (full, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase();
    const isClosing = full.startsWith('</');

    if (!ALLOWED_TAGS.has(tag)) {
      return '';
    }

    if (isClosing) {
      return VOID_ALLOWED_TAGS.has(tag) ? '' : `</${tag}>`;
    }

    const safeAttrs = sanitizeAllowedAttributes(tag, rawAttrs || '');
    if (safeAttrs === '__DROP_TAG__') {
      return '';
    }

    return VOID_ALLOWED_TAGS.has(tag) ? `<${tag}${safeAttrs} />` : `<${tag}${safeAttrs}>`;
  });

  // Neutraliza qualquer "<tag" truncada remanescente sem fechamento ">"
  cleaned = cleaned.replace(/<(?![/a-zA-Z])/g, '&lt;').replace(/<([/a-zA-Z][^>]*)$/g, '&lt;$1');

  return cleaned.trim() || plainTextToSafeHtml(fallbackPlainText || '');
}
