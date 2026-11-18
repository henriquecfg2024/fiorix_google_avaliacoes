import { describe, expect, it } from 'vitest';
import {
  documentJobInput,
  pesquisaRegistralCatalogosInput,
  pesquisaRegistralInput,
} from '@/lib/documental/contracts';
import { construirUrlVisualizadorMatriculaLv2 } from '@/lib/documental/janelasDocumento';
import { isAcessoExclusivoVisualizador } from '@/lib/documental/visualizadorHelpers';
import { ALL_NAV_CATALOG_ITEMS, ITEM_BY_HREF } from '@/lib/nav-permissions/catalog';
import { navigationGroups } from '@/components/fiorix/navigation';

describe('Pesquisa Registral — contratos, navegação e integração com Visualizador', () => {
  it('valida payload pesquisa_registral para aba imovel com filtros do WebRI e limite', () => {
    const parsed = pesquisaRegistralInput.safeParse({
      connectorId: 'auto',
      type: 'pesquisa_registral',
      aba: 'imovel',
      filtrosImovel: {
        logradouro: 'Jerônimo de Mendonça',
        numero: '165',
        contribuinte: '031.108.0184-1',
        unidade: '104',
        maiorArea: false,
      },
      limite: 80,
    });
    expect(parsed.success).toBe(true);

    const viaUnion = documentJobInput.safeParse({
      connectorId: 'conn-1',
      type: 'pesquisa_registral',
      aba: 'propriedade',
      filtrosPropriedade: {
        livroId: 2,
        numeroLivro: 40000,
        nome: 'Pedro Barranco',
        modoNome: 'primeiro_sobrenome',
        aplicarSubstituicao: true,
        somenteContraditorioIndisponibilidade: false,
      },
    });
    expect(viaUnion.success).toBe(true);
  });

  it('rejeita parâmetros desconhecidos, aba inválida ou limite fora da faixa', () => {
    const extraKey = pesquisaRegistralInput.safeParse({
      connectorId: 'auto',
      type: 'pesquisa_registral',
      aba: 'imovel',
      campoDesconhecido: 'xyz',
    });
    expect(extraKey.success).toBe(false);

    const limiteAlto = pesquisaRegistralInput.safeParse({
      connectorId: 'auto',
      type: 'pesquisa_registral',
      aba: 'propriedade',
      limite: 500,
    });
    expect(limiteAlto.success).toBe(false);
  });

  it('valida payload pesquisa_registral_catalogos via schema e union', () => {
    expect(
      pesquisaRegistralCatalogosInput.safeParse({
        connectorId: 'auto',
        type: 'pesquisa_registral_catalogos',
      }).success,
    ).toBe(true);

    expect(
      documentJobInput.safeParse({
        connectorId: 'auto',
        type: 'pesquisa_registral_catalogos',
        forceFresh: true,
      }).success,
    ).toBe(true);
  });

  it('constrói URL do Visualizador mantendo retrocompatibilidade e suportando LV3 + destaque + página', () => {
    expect(construirUrlVisualizadorMatriculaLv2(40000)).toBe(
      '/gestao-documental/visualizador?matricula=40000&sessao=LV2&janela=1',
    );

    const urlCompleta = construirUrlVisualizadorMatriculaLv2('00038931', {
      sessao: 'LV3',
      termoDestaque: 'Jerônimo de Mendonça 165',
      pagina: 5,
      janela: false,
    });
    expect(urlCompleta).toContain('/gestao-documental/visualizador?');
    expect(urlCompleta).toContain('matricula=00038931');
    expect(urlCompleta).toContain('sessao=LV3');
    expect(urlCompleta).toContain('pagina=5');
    expect(urlCompleta).not.toContain('janela=1');
    expect(urlCompleta).toContain('q=Jer');
  });

  it('registra pesquisa_registral_documental no catálogo oficial, navegação lateral e preserva acesso exclusivo do Visualizador', () => {
    const itemCatalogo = ALL_NAV_CATALOG_ITEMS.find(i => i.id === 'pesquisa_registral_documental');
    expect(itemCatalogo).toBeDefined();
    expect(itemCatalogo?.href).toBe('/gestao-documental/pesquisa');
    expect(ITEM_BY_HREF.get('/gestao-documental/pesquisa')?.id).toBe('pesquisa_registral_documental');

    const itemNav = navigationGroups.documental.items.find(
      i => i.id === 'pesquisa_registral_documental',
    );
    expect(itemNav?.href).toBe('/gestao-documental/pesquisa');

    expect(
      isAcessoExclusivoVisualizador({
        navPermissionsEnabled: true,
        userRole: 'USER',
        allowedItemIds: ['visualizador_documental'],
      }),
    ).toBe(true);

    expect(
      isAcessoExclusivoVisualizador({
        navPermissionsEnabled: true,
        userRole: 'USER',
        allowedItemIds: ['visualizador_documental', 'validacao_autenticidade_documental'],
      }),
    ).toBe(true);

    expect(
      isAcessoExclusivoVisualizador({
        navPermissionsEnabled: true,
        userRole: 'USER',
        allowedItemIds: ['visualizador_documental', 'pesquisa_registral_documental'],
      }),
    ).toBe(false);
  });
});
