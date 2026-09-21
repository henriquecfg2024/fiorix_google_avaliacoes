import { describe, it, expect } from 'vitest';
import { navigationGroups } from '@/components/fiorix/navigation';
import { filterNavigationByRole } from '@/lib/navigation/permissions';

describe('FIORIX — Padronização da Nomenclatura do Menu Principal', () => {
  it('apresenta exatamente a nova nomenclatura padronizada em todos os grupos', () => {
    expect(navigationGroups.gestao.label).toBe('PRESENÇA NO GOOGLE');
    expect(navigationGroups.operacional.label).toBe('OPERAÇÃO & BI');
    expect(navigationGroups.rhGestao.label).toBe('GESTÃO DE PESSOAS');
    expect(navigationGroups.governancaIts.label).toBe('INSTRUÇÕES DE TRABALHO');
    expect(navigationGroups.trabalho.label).toBe('ROTINA DE TRABALHO');
    expect(navigationGroups.pessoas.label).toBe('MEU ESPAÇO');
    expect(navigationGroups.sistema.label).toBe('SISTEMA & TECNOLOGIA');
  });

  it('não contém nenhuma das nomenclaturas legadas', () => {
    const labels = Object.values(navigationGroups).map((g) => g.label);
    expect(labels).not.toContain('GESTÃO & ANÁLISES');
    expect(labels).not.toContain('OPERACIONAL & BI');
    expect(labels).not.toContain('GESTÃO DE RH');
    expect(labels).not.toContain('GOVERNANÇA DE ITS');
    expect(labels).not.toContain('TRABALHO');
    expect(labels).not.toContain('PESSOAL');
    expect(labels).not.toContain('SISTEMA & INFRA');
  });

  it('preserva a ordem e as chaves canônicas de navegação', () => {
    const keys = Object.keys(navigationGroups);
    expect(keys).toEqual([
      'gestao',
      'operacional',
      'rhGestao',
      'governancaIts',
      'trabalho',
      'pessoas',
      'sistema',
      'master',
    ]);
  });

  it('preserva todas as rotas originais dos itens sem qualquer alteração', () => {
    expect(navigationGroups.gestao.items.map((i) => i.href)).toEqual([
      '/avaliacoes',
      '/estatisticas',
      '/relatorios',
    ]);

    expect(navigationGroups.operacional.items.map((i) => i.href)).toEqual([
      '/controle-impressoes',
      '/bi',
      '/bi/metas',
      '/bi/tarefas',
      '/bi/produtividade',
      '/bi/auditoria',
    ]);

    expect(navigationGroups.rhGestao.items.map((i) => i.href)).toEqual([
      '/sistema/pessoas?tab=ferias',
      '/sistema/pessoas?tab=holerites',
      '/sistema/pessoas?tab=comunicados',
      '/sistema/pessoas',
    ]);

    expect(navigationGroups.governancaIts.items.map((i) => i.href)).toEqual([
      '/administracao/its',
    ]);

    expect(navigationGroups.trabalho.items.map((i) => i.href)).toEqual([
      '/mensagens',
      '/pessoas/comunicados',
      '/minha-it',
      '/trajetoria-titulo',
    ]);

    expect(navigationGroups.pessoas.items.map((i) => i.href)).toEqual([
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

    expect(groupKeys).toEqual(['trabalho', 'pessoas']);
    expect(groups.trabalho.label).toBe('ROTINA DE TRABALHO');
    expect(groups.pessoas.label).toBe('MEU ESPAÇO');

    // Itens de 'pessoas' limitados a férias e holerites
    expect(groups.pessoas.items.map((i) => i.href)).toEqual([
      '/pessoas/ferias',
      '/pessoas/holerites',
    ]);
  });

  it('valida o menu para o perfil USER', () => {
    const groups = filterNavigationByRole('USER');
    const groupKeys = Object.keys(groups);

    expect(groupKeys).toEqual(['gestao', 'operacional', 'trabalho', 'pessoas']);
    expect(groups.gestao.label).toBe('PRESENÇA NO GOOGLE');
    expect(groups.operacional.label).toBe('OPERAÇÃO & BI');
    expect(groups.trabalho.label).toBe('ROTINA DE TRABALHO');
    expect(groups.pessoas.label).toBe('MEU ESPAÇO');

    const operHrefs = groups.operacional.items.map((i) => i.href);
    expect(operHrefs).not.toContain('/bi/auditoria');
  });

  it('valida o menu para o perfil RH', () => {
    const groups = filterNavigationByRole('RH');
    const groupKeys = Object.keys(groups);

    expect(groupKeys).toEqual(['rhGestao', 'trabalho', 'pessoas']);
    expect(groups.rhGestao.label).toBe('GESTÃO DE PESSOAS');
    expect(groups.trabalho.label).toBe('ROTINA DE TRABALHO');
    expect(groups.pessoas.label).toBe('MEU ESPAÇO');
  });

  it('valida o menu para o perfil ADMIN', () => {
    const groups = filterNavigationByRole('ADMIN');
    const groupKeys = Object.keys(groups);

    expect(groupKeys).toEqual([
      'gestao',
      'operacional',
      'rhGestao',
      'governancaIts',
      'trabalho',
      'pessoas',
      'sistema',
    ]);
    expect(groupKeys).not.toContain('master');
  });

  it('valida o menu para o perfil MASTER', () => {
    const groups = filterNavigationByRole('MASTER');
    const groupKeys = Object.keys(groups);

    expect(groupKeys).toEqual([
      'gestao',
      'operacional',
      'rhGestao',
      'governancaIts',
      'trabalho',
      'pessoas',
      'sistema',
      'master',
    ]);
    expect(groups.master.label).toBe('MASTER SAAS');
  });
});
