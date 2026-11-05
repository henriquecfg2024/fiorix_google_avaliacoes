export interface CollaboratorSearchFields {
  name?: string | null;
  email?: string | null;
  cpf?: string | null;
  cargo?: string | null;
  departamento?: string | null;
  ramal?: string | null;
}

export function normalizeCollaboratorSearch(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function matchesCollaboratorSearch(
  u: CollaboratorSearchFields,
  rawSearchTerm: string
): boolean {
  const trimmed = rawSearchTerm.trim();
  if (!trimmed) return true;

  const normalizedQuery = normalizeCollaboratorSearch(trimmed);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const searchableText = normalizeCollaboratorSearch(
    [u.name, u.email, u.cargo, u.departamento, u.ramal].filter(Boolean).join(" ")
  );
  const matchText = tokens.length > 0 && tokens.every((token) => searchableText.includes(token));

  const termDigits = trimmed.replace(/\D/g, "");
  const userCpfDigits = (u.cpf || "").replace(/\D/g, "");
  const matchCpf = termDigits.length > 0 && userCpfDigits.includes(termDigits);

  return matchText || matchCpf;
}
