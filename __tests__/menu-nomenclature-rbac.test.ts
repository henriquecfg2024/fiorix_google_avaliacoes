import { describe, it, expect } from 'vitest';
import { navigationGroups } from '@/components/fiorix/navigation';
import { filterNavigationByRole } from '@/lib/navigation/permissions';

describe('FIORIX — Padronização da Nomenclatura do Menu Principal', () => {
  it('apresenta exatamente a nova nomenclatura padronizada em todos os grupos (sem GESTÃO DE PESSOAS duplicado)', () => {
    expect(navigationGroups.documental.label).toBe('GESTÃO DOCUMENTAL');
    expect(navigationGroups.gestao.label).toBe('PRESENÇA NO GOOGLE');
    expect(navigationGroups.operacional.label).toBe('GESTÃO DE PRAZOS');
    expect((navigationGroups as any).rhGestao).toBeUndefined();
    expect(navigationGroups.governancaIts.label).toBe('INSTRUÇÕES DE TRABALHO');
    expect(navigationGroups.comunicacaoInterna.label).toBe('COMUNICAÇÃO INTERNA');
    expect(navigationGroups.trabalho.label).toBe('RECURSOS HUMANOS');
    expect(navigationGroups.pessoas.label).toBe('MEU ESPAÇO');
    expect(navigationGroups.sistema.label).toBe('SISTEMA & TECNOLOGIA');
  });

  it('não contém nenhuma das nomenclaturas legadas ou duplicadas', () => {
    const labels = Object.values(navigationGroups).map((g) => g.label);
    expect(labels).not.toContain('GESTÃO & ANÁLISES');
    expect(labels).not.toContain('OPERACIONAL & BI');
    expect(labels).not.toContain('GESTÃO DE RH');
    expect(labels).not.toContain('GESTÃO DE PESSOAS');
    expect(labels).not.toContain('GOVERNANÇA DE ITS');
    expect(labels).not.toContain('TRABALHO');
    expect(labels).not.toContain('ROTINA DE TRABALHO');
    expect(labels).not.toContain('PESSOAL');
    expect(labels).not.toContain('SISTEMA & INFRA');
  });

  it('preserva a ordem e as chaves canônicas de navegação (COMUNICAÇÃO INTERNA acima de RECURSOS HUMANOS)', () => {
    const keys = Object.keys(navigationGroups);
    expect(keys).toEqual([
      'documental',
      'gestao',
      'operacional',
      'governancaIts',
      'comunicacaoInterna',
      'trabalho',
      'pessoas',
      'sistema',
      'master',
    ]);
  });

  it('organiza RECURSOS HUMANOS com Comunicados, Férias e Holerites em rotas próprias e MEU ESPAÇO com os 4 itens pessoais', () => {
    expect(navigationGroups.gestao.items.map((i) => i.href)).toEqual([
      '/avaliacoes',
      '/estatisticas',
      '/relatorios',
    ]);

    expect(navigationGroups.operacional.items.map((i) => i.href)).toEqual([
      '/espera',
      '/bi/produtividade',
      '/bi',
      '/bi/tarefas',
      '/bi/metas',
      '/bi/retornos',
      '/bi/qualidade',
      '/controle-impressoes',
      '/trajetoria-titulo',
    ]);

    expect(navigationGroups.governancaIts.items.map((i) => i.href)).toEqual([
      '/administracao/its',
    ]);

    expect(navigationGroups.comunicacaoInterna.items.map((i) => i.href)).toEqual([
      '/mensagens',
    ]);

    expect(navigationGroups.trabalho.items.map((i) => ({ id: i.id, label: i.label, href: i.href }))).toEqual([
      { id: 'gestao_comunicados', label: 'Comunicados', href: '/sistema/pessoas/comunicados' },
      { id: 'rh_ferias', label: 'Férias', href: '/sistema/pessoas/ferias' },
      { id: 'rh_holerites', label: 'Holerites', href: '/sistema/pessoas/holerites' },
    ]);

    expect(navigationGroups.pessoas.items.map((i) => i.href)).toEqual([
      '/pessoas/comunicados',
      '/minha-it',
      '/pessoas/ferias',
      '/pessoas/holerites',
    ]);

    expect(navigationGroups.sistema.items.map((i) => i.href)).toEqual([
      '/sistema/operacoes',
      '/bi/importacoes',
      '/configuracoes',
      '/administracao/mensagens',
    ]);

    expect(navigationGroups.master.items.map((i) => i.href)).toEqual([
      '/master/tenants',
      '/master/mensagens',
    ]);
  });
});

describe('FIORIX — Validação de RBAC e Permissões por Perfil', () => {
  it('valida o menu para o perfil COLABORADOR', () => {
    const groups = filterNavigationByRole('COLABORADOR');
    const groupKeys = Object.keys(groups);

    expect(groupKeys).toEqual(['operacional', 'comunicacaoInterna', 'pessoas']);
    expect(groups.comunicacaoInterna.label).toBe('COMUNICAÇÃO INTERNA');
    expect(groups.pessoas.label).toBe('MEU ESPAÇO');

    expect(groups.pessoas.items.map((i) => i.href)).toEqual([
      '/pessoas/comunicados',
      '/minha-it',
      '/pessoas/ferias',
      '/pessoas/holerites',
    ]);

    expect(groups.operacional.items.map((i) => i.href)).toContain('/espera');
  });

  it('valida o menu para o perfil USER', () => {
    const groups = filterNavigationByRole('USER');
    const groupKeys = Object.keys(groups);

    expect(groupKeys).toEqual(['gestao', 'operacional', 'comunicacaoInterna', 'pessoas']);
    expect(groups.gestao.label).toBe('PRESENÇA NO GOOGLE');
    expect(groups.operacional.label).toBe('GESTÃO DE PRAZOS');
    expect(groups.comunicacaoInterna.label).toBe('COMUNICAÇÃO INTERNA');
    expect(groups.pessoas.label).toBe('MEU ESPAÇO');

    const operHrefs = groups.operacional.items.map((i) => i.href);
    expect(operHrefs).not.toContain('/bi/auditoria');
    expect(operHrefs).not.toContain('/espera');
  });

  it('valida o menu para o perfil RH com os 3 submenus em RECURSOS HUMANOS', () => {
    const groups = filterNavigationByRole('RH');
    const groupKeys = Object.keys(groups);

    expect(groupKeys).toEqual(['comunicacaoInterna', 'trabalho', 'pessoas']);
    expect(groups.comunicacaoInterna.label).toBe('COMUNICAÇÃO INTERNA');
    expect(groups.trabalho.label).toBe('RECURSOS HUMANOS');
    expect(groups.trabalho.items.map((i) => i.href)).toEqual([
      '/sistema/pessoas/comunicados',
      '/sistema/pessoas/ferias',
      '/sistema/pessoas/holerites',
    ]);
    expect(groups.pessoas.label).toBe('MEU ESPAÇO');
    expect(groups.pessoas.items.map((i) => i.href)).toContain('/minha-it');
  });

  it('valida o menu para o perfil SUBSTITUTO com acesso padrão a Comunicados em RECURSOS HUMANOS', () => {
    const groups = filterNavigationByRole('SUBSTITUTO');
    const groupKeys = Object.keys(groups);

    expect(groupKeys).toEqual([
      'documental',
      'gestao',
      'operacional',
      'governancaIts',
      'comunicacaoInterna',
      'trabalho',
      'pessoas',
    ]);
    expect(groups.trabalho.items.map((i) => i.href)).toEqual(['/sistema/pessoas/comunicados']);
    const rhMenuItem = groups.trabalho.items.find((i) => i.id === 'gestao_comunicados');
    expect(rhMenuItem?.label).toBe('Comunicados');
  });

  it('valida o menu para o perfil ADMIN', () => {
    const groups = filterNavigationByRole('ADMIN');
    const groupKeys = Object.keys(groups);

    expect(groupKeys).toEqual([
      'documental',
      'gestao',
      'operacional',
      'governancaIts',
      'comunicacaoInterna',
      'trabalho',
      'pessoas',
      'sistema',
    ]);
    expect(groups.trabalho.items.map((i) => i.id)).toEqual([
      'gestao_comunicados',
      'rh_ferias',
      'rh_holerites',
    ]);
    expect(groupKeys).not.toContain('master');
  });

  it('valida o menu para o perfil MASTER', () => {
    const groups = filterNavigationByRole('MASTER');
    const groupKeys = Object.keys(groups);

    expect(groupKeys).toEqual([
      'documental',
      'gestao',
      'operacional',
      'governancaIts',
      'comunicacaoInterna',
      'trabalho',
      'pessoas',
      'sistema',
      'master',
    ]);
    expect(groups.master.label).toBe('MASTER SAAS');
  });
});
