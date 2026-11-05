import { describe, expect, it } from "vitest";
import { matchesCollaboratorSearch } from "@/lib/usuarios/collaboratorSearch";
import {
  CAUSAS_CONFIG,
  CATEGORIAS_OFICIAIS_SET,
  classificarCausa,
  isObservacaoGenerica,
} from "@/lib/qualidade/classificarCausa";

describe("Gestão de Usuários — Pesquisa de Colaboradores (matchesCollaboratorSearch)", () => {
  const sampleUsers = [
    {
      name: "Henrique Master",
      email: "admin@fiorix.com.br",
      cpf: null,
      cargo: "Oficial / Diretor",
      departamento: "Administração",
      ramal: "100",
    },
    {
      name: "Sarah Alves",
      email: "sarah@7risp.com.br",
      cpf: "123.456.789-01",
      cargo: "Auxiliar de Atendimento",
      departamento: "Atendimento",
      ramal: "204",
    },
    {
      name: "Antônio Carlos B. Câmara",
      email: "antonio@7risp.com.br",
      cpf: "987.654.321-99",
      cargo: "Escrevente Autorizado",
      departamento: "Qualificação",
      ramal: "312",
    },
  ];

  it("filtra corretamente por nome ('SARA') sem falso-positivo em CPFs vazios", () => {
    const filtrados = sampleUsers.filter((u) => matchesCollaboratorSearch(u, "SARA"));
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].name).toBe("Sarah Alves");
  });

  it("suporta busca multi-palavra sem acentos ('antonio camara')", () => {
    const filtrados = sampleUsers.filter((u) => matchesCollaboratorSearch(u, "antonio camara"));
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].email).toBe("antonio@7risp.com.br");
  });

  it("permite busca numérica por CPF apenas quando há dígitos na consulta", () => {
    const filtrados = sampleUsers.filter((u) => matchesCollaboratorSearch(u, "456.789"));
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].name).toBe("Sarah Alves");
  });
});

describe("Gestão de Departamentos — Ordenação Alfabética pt-BR", () => {
  it("ordena departamentos com maiúsculas e acentos em ordem alfabética natural", () => {
    const desordenados = [
      "VISITANTE",
      "Atendimento",
      "CONTRADITÓRIO / EXTRATO",
      "Administração",
      "Ofício",
      "Qualificação",
      "Retificação de Área",
    ];
    const ordenados = [...desordenados].sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );
    expect(ordenados).toEqual([
      "Administração",
      "Atendimento",
      "CONTRADITÓRIO / EXTRATO",
      "Ofício",
      "Qualificação",
      "Retificação de Área",
      "VISITANTE",
    ]);
  });
});

describe("Qualidade — Categorização das Top Causas dos Erros Internos", () => {
  it("classifica todas as observações reais representativas nas categorias oficiais sem cair em Outras Causas", () => {
    expect(classificarCausa("SOLICITADO CORREÇÃO DA VINCULAÇÃO", 292)).toBe(
      "Vinculação de Protocolo & Reentrada"
    );
    expect(classificarCausa("Não vinculou título reentrada.", 292)).toBe(
      "Vinculação de Protocolo & Reentrada"
    );
    expect(classificarCausa("CORRIGIR MATRICULA LANÇADA ERRONIAMENTE;", 292)).toBe(
      "Matrícula & Transcrição (Indicador Real)"
    );
    expect(
      classificarCausa(
        "Falta lançar a Tr. 78.796 e anotar a prenotação nas transcrições no doc digital.",
        293
      )
    ).toBe("Matrícula & Transcrição (Indicador Real)");
    expect(classificarCausa("lançar vides dos nomes dos compradores.", 294)).toBe(
      "Grafia de Nomes & Vides (Pessoal)"
    );
    expect(
      classificarCausa(
        "GUSTAVO MORAES SILVESTRE para GUSTAVO DE MORAES SILVESTRE",
        294
      )
    ).toBe("Grafia de Nomes & Vides (Pessoal)");
    expect(classificarCausa("lançar contribuinte atual 029.010.1081-4", 293)).toBe(
      "Contribuinte & Cadastro Fiscal (IPTU)"
    );
    expect(
      classificarCausa(
        "SOLICITADO PARA A ATENDENTE CORRIGIR PARA INSTRUMENTO PARTICULAR CONDOMINIO",
        292
      )
    ).toBe("Natureza & Data do Título (Recepção)");
    expect(classificarCausa("Corrigir data do título.", 292)).toBe(
      "Natureza & Data do Título (Recepção)"
    );
    expect(
      classificarCausa(
        "Poderia arrumar o RG e CPF do comprador JOEL MARCOS DE OLIVEIRA CARDOSO, vinculado ao protocolo nº 638.359.",
        294
      )
    ).toBe("CPF, RG & Qualificação Civil");
    expect(
      classificarCausa("lançar arrematante no contraditório - Agras Cruz Participações", 294)
    ).toBe("Omissão de Partes no Contraditório");
  });

  it("trata confirmações genéricas ou vazias pelo tipo oficial do retorno e marca como observação genérica", () => {
    expect(isObservacaoGenerica("retorno realizado.")).toBe(true);
    expect(isObservacaoGenerica("Corrigido")).toBe(true);
    expect(isObservacaoGenerica("")).toBe(true);
    expect(isObservacaoGenerica("CORRIGIR MATRICULA LANÇADA ERRONIAMENTE;")).toBe(false);

    expect(classificarCausa("retorno realizado.", 294)).toBe("Grafia de Nomes & Vides (Pessoal)");
    expect(classificarCausa("Corrigido", 293)).toBe("Matrícula & Transcrição (Indicador Real)");
    expect(classificarCausa("Solicitação atendida", 292)).toBe(
      "Natureza & Data do Título (Recepção)"
    );

    for (const cfg of CAUSAS_CONFIG) {
      expect(CATEGORIAS_OFICIAIS_SET.has(cfg.nome)).toBe(true);
    }
  });
});
