'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield,
  Building2,
  Users,
  UserCheck,
  Search,
  Check,
  X,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  Lock,
  Layers,
  Sparkles,
  Link2,
} from 'lucide-react';
import {
  TenantContextItem,
  EligibleUserItem,
  UiTargetMode,
  ItemEffectiveState,
  NavPermissionsTreeResponse,
  NavPermissionsGroupView,
} from '@/lib/nav-permissions/types';
import { EDITABLE_ROLES } from '@/lib/nav-permissions/catalog';
import {
  getEligibleUsersForTenantAction,
  getPermissionsForTargetAction,
  savePermissionsBatchAction,
} from '@/app/actions/nav-permissions';

interface PermissoesMenuClientProps {
  initialTenants: TenantContextItem[];
  featureEnabled: boolean;
}

export function PermissoesMenuClient({
  initialTenants,
  featureEnabled,
}: PermissoesMenuClientProps) {
  // 1. Organização alvo local
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    initialTenants[0]?.id || ''
  );

  // 2. Modo: COLABORADOR ou PERFIL (Regra inegociável: apenas esses dois modos)
  const [targetType, setTargetType] = useState<UiTargetMode>('PERFIL');

  // 3. Alvo selecionado
  const [selectedRole, setSelectedRole] = useState<string>('ADMIN');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // 4. Lista de colaboradores carregada para a organização
  const [usersList, setUsersList] = useState<EligibleUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');

  // 5. Estado carregado do servidor
  const [treeData, setTreeData] = useState<NavPermissionsTreeResponse | null>(null);
  const [loadingTree, setLoadingTree] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 6. Rascunho de edições locais (item_id -> ação pretendida)
  const [draftChanges, setDraftChanges] = useState<
    Record<string, 'HERDAR' | 'ALLOW' | 'DENY'>
  >({});

  // 7. Controle de feedback e salvamento
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // 8. Busca de itens de menu
  const [menuSearchTerm, setMenuSearchTerm] = useState<string>('');

  // 9. Agrupadores colapsados
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // 10. Diálogo de confirmação para troca com pendências
  const [pendingTargetSwitch, setPendingTargetSwitch] = useState<{
    type: 'TENANT' | 'TARGET_TYPE' | 'ROLE' | 'USER';
    newTenantId?: string;
    newTargetType?: UiTargetMode;
    newRole?: string;
    newUserId?: string;
  } | null>(null);

  const hasUnsavedChanges = Object.keys(draftChanges).length > 0;

  // Organização selecionada completa
  const currentTenant = useMemo(() => {
    return initialTenants.find((t) => t.id === selectedTenantId) || initialTenants[0];
  }, [initialTenants, selectedTenantId]);

  // Colaborador selecionado completo
  const currentSelectedUser = useMemo(() => {
    return usersList.find((u) => u.id === selectedUserId);
  }, [usersList, selectedUserId]);

  // Carrega lista de usuários ao trocar de tenant
  useEffect(() => {
    if (!selectedTenantId) return;

    let isMounted = true;
    setLoadingUsers(true);
    getEligibleUsersForTenantAction(selectedTenantId)
      .then((users) => {
        if (!isMounted) return;
        setUsersList(users);
        if (users.length > 0 && !selectedUserId) {
          setSelectedUserId(users[0].id);
        } else if (users.length === 0) {
          setSelectedUserId('');
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar colaboradores do tenant:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingUsers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTenantId]);

  // Carrega permissões do alvo atual
  const fetchTree = useCallback(async () => {
    if (!selectedTenantId) return;
    if (targetType === 'COLABORADOR' && !selectedUserId) {
      setTreeData(null);
      return;
    }

    setLoadingTree(true);
    setLoadError(null);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const data = await getPermissionsForTargetAction({
        tenantId: selectedTenantId,
        targetType: targetType === 'PERFIL' ? 'ROLE' : 'USER',
        targetId: targetType === 'PERFIL' ? selectedRole : selectedUserId,
        userRole: currentSelectedUser?.role,
      });

      setTreeData(data);
      setDraftChanges({});
    } catch (err: any) {
      console.error('Erro ao carregar permissões:', err);
      setLoadError(err?.message || 'Erro ao carregar permissões do alvo.');
      setTreeData(null);
    } finally {
      setLoadingTree(false);
    }
  }, [selectedTenantId, targetType, selectedRole, selectedUserId, currentSelectedUser]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Alternância segura com proteção de pendências
  const handleTenantChange = (newTenantId: string) => {
    if (newTenantId === selectedTenantId) return;
    if (hasUnsavedChanges) {
      setPendingTargetSwitch({ type: 'TENANT', newTenantId });
    } else {
      setSelectedTenantId(newTenantId);
      setDraftChanges({});
    }
  };

  const handleTargetTypeChange = (newType: UiTargetMode) => {
    if (newType === targetType) return;
    if (hasUnsavedChanges) {
      setPendingTargetSwitch({ type: 'TARGET_TYPE', newTargetType: newType });
    } else {
      setTargetType(newType);
      setDraftChanges({});
    }
  };

  const handleRoleChange = (newRole: string) => {
    if (newRole === selectedRole) return;
    if (hasUnsavedChanges) {
      setPendingTargetSwitch({ type: 'ROLE', newRole });
    } else {
      setSelectedRole(newRole);
      setDraftChanges({});
    }
  };

  const handleUserChange = (newUserId: string) => {
    if (newUserId === selectedUserId) return;
    if (hasUnsavedChanges) {
      setPendingTargetSwitch({ type: 'USER', newUserId });
    } else {
      setSelectedUserId(newUserId);
      setDraftChanges({});
    }
  };

  // Aplicação da troca após confirmação no diálogo
  const applyPendingSwitch = () => {
    if (!pendingTargetSwitch) return;
    if (pendingTargetSwitch.type === 'TENANT' && pendingTargetSwitch.newTenantId) {
      setSelectedTenantId(pendingTargetSwitch.newTenantId);
    } else if (
      pendingTargetSwitch.type === 'TARGET_TYPE' &&
      pendingTargetSwitch.newTargetType
    ) {
      setTargetType(pendingTargetSwitch.newTargetType);
    } else if (pendingTargetSwitch.type === 'ROLE' && pendingTargetSwitch.newRole) {
      setSelectedRole(pendingTargetSwitch.newRole);
    } else if (pendingTargetSwitch.type === 'USER' && pendingTargetSwitch.newUserId) {
      setSelectedUserId(pendingTargetSwitch.newUserId);
    }
    setDraftChanges({});
    setPendingTargetSwitch(null);
  };

  // Alteração de um item no rascunho (com sincronização de rotas compartilhadas)
  const setItemDraftAction = (
    itemId: string,
    action: 'HERDAR' | 'ALLOW' | 'DENY'
  ) => {
    setDraftChanges((prev) => {
      const next = { ...prev };
      next[itemId] = action;

      // Sincronização automática para rotas compartilhadas
      if (itemId === 'gestao_comunicados') {
        next['gestao_pessoas'] = action;
      } else if (itemId === 'gestao_pessoas') {
        next['gestao_comunicados'] = action;
      }

      return next;
    });
  };

  // Ações em lote para um grupo
  const handleBatchGroupAction = (
    items: ItemEffectiveState[],
    action: 'HERDAR' | 'ALLOW' | 'DENY'
  ) => {
    setDraftChanges((prev) => {
      const next = { ...prev };
      for (const itemState of items) {
        const item = itemState.item;
        if (!itemState.isBlockedBySystem && !item.isMasterOnly && !item.isProtected) {
          next[item.id] = action;
          if (item.sharedWithId) {
            next[item.sharedWithId] = action;
          }
        }
      }
      return next;
    });
  };

  // Descartar rascunho
  const handleCancelDraft = () => {
    setDraftChanges({});
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);
  };

  // Salvar no servidor
  const handleSave = async (switchTargetAfterSave = false) => {
    if (!selectedTenantId || !treeData) return;

    setSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    const changes = Object.entries(draftChanges).map(([itemId, action]) => ({
      itemId,
      action,
    }));

    try {
      const result = await savePermissionsBatchAction({
        tenantId: selectedTenantId,
        targetType: targetType === 'PERFIL' ? 'ROLE' : 'USER',
        targetId: targetType === 'PERFIL' ? selectedRole : selectedUserId,
        targetRoleForUser: currentSelectedUser?.role,
        changes,
      });

      if (!result.success) {
        setSaveErrorMsg(result.message || 'Falha ao salvar permissões.');
        return;
      }

      setSaveSuccessMsg(result.message);
      setDraftChanges({});

      if (switchTargetAfterSave && pendingTargetSwitch) {
        applyPendingSwitch();
      } else {
        await fetchTree();
      }
    } catch (err: any) {
      console.error('Erro ao salvar permissões:', err);
      setSaveErrorMsg(err?.message || 'Erro inesperado ao salvar no servidor.');
    } finally {
      setSaving(false);
    }
  };

  // Filtragem dos itens de acordo com a busca de menus
  const filteredGroups = useMemo(() => {
    if (!treeData) return [];
    if (!menuSearchTerm.trim()) return treeData.groups;

    const term = menuSearchTerm.toLowerCase().trim();
    return treeData.groups
      .map((g: NavPermissionsGroupView) => {
        const matchingItems = g.items.filter(
          (itemState: ItemEffectiveState) =>
            itemState.item.label.toLowerCase().includes(term) ||
            itemState.item.href.toLowerCase().includes(term) ||
            (itemState.item.description &&
              itemState.item.description.toLowerCase().includes(term))
        );
        return {
          ...g,
          items: matchingItems,
        };
      })
      .filter((g: NavPermissionsGroupView) => g.items.length > 0);
  }, [treeData, menuSearchTerm]);

  // Filtragem dos colaboradores na busca
  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) return usersList;
    const term = userSearchTerm.toLowerCase().trim();
    return usersList.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.departamento && u.departamento.toLowerCase().includes(term)) ||
        u.role.toLowerCase().includes(term)
    );
  }, [usersList, userSearchTerm]);

  // Função para derivar a visualização do item considerando o rascunho
  const resolveDraftItemState = (itemState: ItemEffectiveState) => {
    const draft = draftChanges[itemState.item.id];
    if (draft === undefined) {
      let badge = 'Desativado';
      if (itemState.isBlockedBySystem) {
        badge = 'Bloqueado pelo sistema';
      } else if (targetType === 'PERFIL') {
        badge = itemState.effectiveAllowed ? 'Ativado' : 'Desativado';
      } else {
        // COLABORADOR
        if (itemState.effectiveStatus === 'ALLOWED_INDIVIDUAL') {
          badge = 'Ativado · individual';
        } else if (itemState.effectiveStatus === 'DENIED_INDIVIDUAL') {
          badge = 'Desativado · individual';
        } else if (itemState.effectiveStatus === 'ALLOWED_INHERITED') {
          badge = 'Ativado · herdado';
        } else {
          badge = 'Desativado · herdado';
        }
      }

      return {
        ...itemState,
        stateBadge: badge,
        isEffectiveVisible: itemState.effectiveAllowed,
      };
    }

    if (targetType === 'PERFIL') {
      const willBeVisible = draft === 'ALLOW';
      return {
        ...itemState,
        effectiveAllowed: willBeVisible,
        isEffectiveVisible: willBeVisible,
        stateBadge: willBeVisible ? 'Ativado' : 'Desativado',
      };
    } else {
      // Modo COLABORADOR
      if (draft === 'HERDAR') {
        const isInheritedAllowed =
          itemState.roleRule !== null
            ? itemState.roleRule
            : itemState.effectiveAllowed;
        return {
          ...itemState,
          userOverride: null,
          effectiveAllowed: isInheritedAllowed,
          isEffectiveVisible: isInheritedAllowed,
          stateBadge: isInheritedAllowed
            ? 'Ativado · herdado'
            : 'Desativado · herdado',
        };
      } else if (draft === 'ALLOW') {
        return {
          ...itemState,
          userOverride: 'ALLOW' as const,
          effectiveAllowed: true,
          isEffectiveVisible: true,
          stateBadge: 'Ativado · individual',
        };
      } else {
        return {
          ...itemState,
          userOverride: 'DENY' as const,
          effectiveAllowed: false,
          isEffectiveVisible: false,
          stateBadge: 'Desativado · individual',
        };
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Link
              href="/configuracoes"
              className="hover:text-amber-300 transition-colors"
            >
              Configurações
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-amber-400 font-semibold">Permissões de Menu</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Shield className="w-7 h-7 text-amber-400" />
              Permissões de Menu
            </h1>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-xs font-semibold text-amber-300">
              EXCLUSIVO MASTER
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl">
            Configure regras personalizadas de visualização e acesso a menus e rotas
            por colaborador ou papel do sistema.
          </p>
        </div>

        {/* Status da Feature Flag */}
        <div className="flex items-center">
          {featureEnabled ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Navegação Ativa em Produção
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Regras salvas como rascunho administrativo.
                <strong className="block text-[11px] text-amber-300/80">
                  Regras ainda não aplicadas à navegação (Flag desativada no servidor).
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SEÇÃO DE CONTROLES: ORGANIZAÇÃO, MODO E ALVO */}
      <section className="rounded-2xl border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-lg space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* 1. SELETOR DE ORGANIZAÇÃO LOCAL */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold tracking-wider text-slate-300 flex items-center gap-1.5 uppercase">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              Organização (Cartório)
            </label>
            <select
              value={selectedTenantId}
              onChange={(e) => handleTenantChange(e.target.value)}
              className="w-full bg-[#131B31] border border-white/15 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors"
            >
              {initialTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({(t.plano || 'STANDARD').toUpperCase()}) — {t.status}
                </option>
              ))}
            </select>
          </div>

          {/* 2. CONFIGURAR POR: COLABORADOR OU PERFIL */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold tracking-wider text-slate-300 flex items-center gap-1.5 uppercase">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Configurar Por
            </label>
            <div className="grid grid-cols-2 p-1 bg-[#131B31] rounded-xl border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleTargetTypeChange('PERFIL')}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                  targetType === 'PERFIL'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                PERFIL
              </button>
              <button
                type="button"
                onClick={() => handleTargetTypeChange('COLABORADOR')}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                  targetType === 'COLABORADOR'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                COLABORADOR
              </button>
            </div>
          </div>

          {/* 3. ALVO ESPECÍFICO (ROLE OU COLABORADOR) */}
          <div className="md:col-span-4 space-y-1.5">
            {targetType === 'PERFIL' ? (
              <>
                <label className="text-xs font-semibold tracking-wider text-slate-300 flex items-center gap-1.5 uppercase">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  Perfil do Sistema
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full bg-[#131B31] border border-white/15 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors"
                >
                  {EDITABLE_ROLES.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="text-xs font-semibold tracking-wider text-slate-300 flex items-center gap-1.5 uppercase">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  Conta do Colaborador ({usersList.length} elegíveis)
                </label>
                {loadingUsers ? (
                  <div className="flex items-center gap-2 h-[42px] px-3.5 bg-[#131B31] rounded-xl border border-white/10 text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    Carregando contas...
                  </div>
                ) : usersList.length === 0 ? (
                  <div className="h-[42px] flex items-center px-3.5 bg-[#131B31] rounded-xl border border-red-500/20 text-xs text-red-300">
                    Nenhuma conta encontrada neste cartório.
                  </div>
                ) : (
                  <select
                    value={selectedUserId}
                    onChange={(e) => handleUserChange(e.target.value)}
                    className="w-full bg-[#131B31] border border-white/15 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors"
                  >
                    {filteredUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.email} ({u.role}
                        {u.departamento ? ` • ${u.departamento}` : ''})
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
        </div>

        {/* DETALHES DO COLABORADOR SELECIONADO (MODO INDIVIDUAL) */}
        {targetType === 'COLABORADOR' && currentSelectedUser && (
          <div className="p-3.5 rounded-xl border border-white/10 bg-[#10172A] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300">
                {currentSelectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <span>{currentSelectedUser.name}</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-white/20 bg-white/5 text-slate-300">
                    {currentSelectedUser.email}
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Perfil:{' '}
                  <strong className="text-amber-300">
                    {currentSelectedUser.role}
                  </strong>{' '}
                  {currentSelectedUser.departamento && (
                    <span>• Depto: {currentSelectedUser.departamento}</span>
                  )}{' '}
                  {currentSelectedUser.cargo && (
                    <span>• Cargo: {currentSelectedUser.cargo}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  currentSelectedUser.status === 'ativo'
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border border-red-500/30 bg-red-500/10 text-red-400'
                }`}
              >
                {currentSelectedUser.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        )}

        {/* BARRA DE BUSCA DE MENUS */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar menu, submenu ou rota (ex: avaliacoes, mensagens, pessoas)..."
            value={menuSearchTerm}
            onChange={(e) => setMenuSearchTerm(e.target.value)}
            className="w-full bg-[#131B31] border border-white/10 pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          {menuSearchTerm && (
            <button
              onClick={() => setMenuSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Limpar
            </button>
          )}
        </div>
      </section>

      {/* FEEDBACK DE SUCESSO OU ERRO */}
      {saveSuccessMsg && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMsg(null)}
            className="text-xs text-emerald-400/80 hover:text-emerald-300"
          >
            ✕
          </button>
        </div>
      )}

      {saveErrorMsg && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{saveErrorMsg}</span>
          </div>
          <button
            onClick={() => setSaveErrorMsg(null)}
            className="text-xs text-red-400/80 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* ÁREA CENTRAL: ÁRVORE EXPANSÍVEL DE MENUS */}
      {loadingTree ? (
        <div className="p-16 rounded-2xl border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <span className="text-sm font-medium">
            Carregando catálogo de navegação e regras...
          </span>
        </div>
      ) : loadError ? (
        <div className="p-8 rounded-2xl border border-red-500/30 bg-red-950/20 text-red-300 space-y-3">
          <div className="flex items-center gap-2 font-bold text-red-200">
            <AlertTriangle className="w-5 h-5" />
            Erro ao carregar permissões
          </div>
          <p className="text-sm">{loadError}</p>
          <button
            onClick={fetchTree}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-12 rounded-2xl border border-white/10 bg-[#0B1020]/90 text-center text-slate-400">
          Nenhum menu ou submenu corresponde aos termos da pesquisa.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group: NavPermissionsGroupView) => {
            const isCollapsed = collapsedGroups[group.id] || false;

            // Calcula contadores do grupo considerando o rascunho
            const itemsWithDraft = group.items.map(resolveDraftItemState);
            const activeCount = itemsWithDraft.filter(
              (i) => i.isEffectiveVisible
            ).length;
            const totalCount = itemsWithDraft.length;
            const isPartial = activeCount > 0 && activeCount < totalCount;

            return (
              <div
                key={group.id}
                className="rounded-2xl border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl overflow-hidden shadow-sm"
              >
                {/* CABEÇALHO DO GRUPO */}
                <div className="p-4 bg-[#10172A] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() =>
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [group.id]: !isCollapsed,
                      }))
                    }
                  >
                    <button
                      type="button"
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-wide text-white">
                          {group.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                            activeCount === totalCount
                              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : activeCount === 0
                              ? 'border border-slate-700 bg-slate-800 text-slate-400'
                              : 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          {activeCount}/{totalCount} ativos
                          {isPartial && ' · parcial'}
                        </span>
                      </div>
                      {group.href && (
                        <span className="text-[11px] font-mono text-slate-400">
                          {group.href}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AÇÕES EM LOTE DO GRUPO */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {targetType === 'COLABORADOR' ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleBatchGroupAction(group.items, 'HERDAR')
                          }
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                          title="Restaurar herança de todos os itens gerenciáveis deste grupo"
                        >
                          Restaurar Herança
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleBatchGroupAction(group.items, 'ALLOW')
                          }
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors"
                        >
                          Ativar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleBatchGroupAction(group.items, 'DENY')
                          }
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-colors"
                        >
                          Desativar Todos
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleBatchGroupAction(group.items, 'ALLOW')
                          }
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors"
                        >
                          Ativar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleBatchGroupAction(group.items, 'DENY')
                          }
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-colors"
                        >
                          Desativar Todos
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ITENS DO GRUPO */}
                {!isCollapsed && (
                  <div className="divide-y divide-white/5">
                    {itemsWithDraft.map((itemState) => {
                      const item = itemState.item;
                      const hasPending = draftChanges[item.id] !== undefined;

                      return (
                        <div
                          key={item.id}
                          className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                            hasPending
                              ? 'bg-amber-500/[0.04]'
                              : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          {/* INFORMAÇÕES DO ITEM */}
                          <div className="space-y-1 max-w-xl">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-semibold text-white text-sm">
                                {item.label}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                                {item.href}
                              </span>
                              {hasPending && (
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Pendente
                                </span>
                              )}
                            </div>

                            {item.description && (
                              <p className="text-xs text-slate-400">
                                {item.description}
                              </p>
                            )}

                            {/* NOTA DE ROTA COMPARTILHADA */}
                            {item.sharedWithId && (
                              <div className="flex items-center gap-1.5 text-[11px] text-indigo-300/90 pt-0.5">
                                <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                                <span>{item.sharedNote}</span>
                              </div>
                            )}

                            {/* MOTIVO DE BLOQUEIO ESTRUTURAL */}
                            {itemState.isBlockedBySystem && (
                              <div className="flex items-center gap-1.5 text-[11px] text-red-300/90 pt-0.5">
                                <Lock className="w-3.5 h-3.5 text-red-400" />
                                <span>{itemState.blockedReason}</span>
                              </div>
                            )}
                          </div>

                          {/* CONTROLES E BADGE DE STATUS */}
                          <div className="flex flex-wrap items-center gap-3 shrink-0">
                            {/* BADGE DE STATUS ATUAL */}
                            <div
                              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                                itemState.isBlockedBySystem
                                  ? 'border border-red-500/30 bg-red-500/10 text-red-300'
                                  : itemState.isEffectiveVisible
                                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                  : 'border border-slate-700 bg-slate-800 text-slate-400'
                              }`}
                            >
                              {itemState.isBlockedBySystem ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  Bloqueado pelo sistema
                                </>
                              ) : (
                                <>
                                  {itemState.isEffectiveVisible ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <X className="w-3 h-3 text-slate-400" />
                                  )}
                                  <span>{itemState.stateBadge}</span>
                                </>
                              )}
                            </div>

                            {/* BOTÕES DE CONTROLE SE NÃO FOR BLOQUEADO PELO SISTEMA */}
                            {!itemState.isBlockedBySystem &&
                              !item.isMasterOnly &&
                              !item.isProtected && (
                                <div className="flex items-center gap-1.5">
                                  {targetType === 'COLABORADOR' ? (
                                    <div className="flex items-center p-1 bg-[#131B31] rounded-xl border border-white/10 text-xs">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setItemDraftAction(item.id, 'HERDAR')
                                        }
                                        className={`px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
                                          itemState.userOverride === null &&
                                          draftChanges[item.id] === undefined
                                            ? 'bg-white/10 text-white font-bold'
                                            : draftChanges[item.id] === 'HERDAR'
                                            ? 'bg-amber-500 text-slate-950 font-bold'
                                            : 'text-slate-400 hover:text-white'
                                        }`}
                                      >
                                        Herdar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setItemDraftAction(item.id, 'ALLOW')
                                        }
                                        className={`px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
                                          itemState.userOverride === 'ALLOW' &&
                                          draftChanges[item.id] === undefined
                                            ? 'bg-emerald-600 text-white font-bold'
                                            : draftChanges[item.id] === 'ALLOW'
                                            ? 'bg-emerald-500 text-slate-950 font-bold'
                                            : 'text-slate-400 hover:text-emerald-300'
                                        }`}
                                      >
                                        Ativar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setItemDraftAction(item.id, 'DENY')
                                        }
                                        className={`px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
                                          itemState.userOverride === 'DENY' &&
                                          draftChanges[item.id] === undefined
                                            ? 'bg-red-600 text-white font-bold'
                                            : draftChanges[item.id] === 'DENY'
                                            ? 'bg-red-500 text-slate-950 font-bold'
                                            : 'text-slate-400 hover:text-red-300'
                                        }`}
                                      >
                                        Desativar
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center p-1 bg-[#131B31] rounded-xl border border-white/10 text-xs">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setItemDraftAction(item.id, 'ALLOW')
                                        }
                                        className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                                          itemState.isEffectiveVisible &&
                                          draftChanges[item.id] === undefined
                                            ? 'bg-emerald-600 text-white font-bold'
                                            : draftChanges[item.id] === 'ALLOW'
                                            ? 'bg-emerald-500 text-slate-950 font-bold'
                                            : 'text-slate-400 hover:text-emerald-300'
                                        }`}
                                      >
                                        Ativado
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setItemDraftAction(item.id, 'DENY')
                                        }
                                        className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                                          !itemState.isEffectiveVisible &&
                                          draftChanges[item.id] === undefined
                                            ? 'bg-red-600 text-white font-bold'
                                            : draftChanges[item.id] === 'DENY'
                                            ? 'bg-red-500 text-slate-950 font-bold'
                                            : 'text-slate-400 hover:text-red-300'
                                        }`}
                                      >
                                        Desativado
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* BARRA FIXA DE AÇÃO INFERIOR QUANDO HOUVER ALTERAÇÕES PENDENTES */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:max-w-xl z-50">
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-[#0B1020]/95 backdrop-blur-xl shadow-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
              <div className="text-xs">
                <span className="font-bold text-white block">
                  {Object.keys(draftChanges).length} alterações pendentes
                </span>
                <span className="text-slate-400">
                  Salve para aplicar ou cancele para descartar o rascunho.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelDraft}
                disabled={saving}
                className="px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Salvar permissões
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO MODAL DE CONFIRMAÇÃO AO TROCAR ALVO COM PENDÊNCIAS */}
      {pendingTargetSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0B1020] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Alterações não salvas</h3>
                <p className="text-xs text-slate-400">
                  Você possui {Object.keys(draftChanges).length} modificações pendentes no rascunho atual.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Deseja salvar as permissões antes de alternar o alvo ou prefere descartar as alterações?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingTargetSwitch(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors"
              >
                Permanecer
              </button>
              <button
                type="button"
                onClick={() => applyPendingSwitch()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-300 transition-colors"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Salvar e Prosseguir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
