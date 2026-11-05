'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  resetUserPassword,
  updateUserRole,
  updateUserName,
  updateUserCpf,
  toggleUserStatus,
  updateUserProfile,
  deleteInactiveUser,
  toggleUser2FA,
  resetUser2FA,
  bulkToggleUsers2FA,
} from '@/app/actions/admin';
import { isValidCPF } from '@/lib/cpf-validator';
import { matchesCollaboratorSearch } from '@/lib/usuarios/collaboratorSearch';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  RotateCcw,
  Loader2,
  Key,
  Edit3,
  X,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  UserX,
  UserCheck,
  Building,
  Trash2,
} from 'lucide-react';

export interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  cpf?: string | null;
  departamento?: string | null;
  cargo?: string | null;
  ramal?: string | null;
  podeSerTutor?: boolean;
  status?: string | null;
  totpRequired?: boolean;
  totpEnabled?: boolean;
  totpVerifiedAt?: Date | string | null;
}

export function UserListTable({
  usuarios,
  currentUserRole = 'USER',
  departamentosDisponiveis = [],
}: {
  usuarios: UserItem[];
  currentUserRole?: string;
  departamentosDisponiveis?: string[];
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepto, setSelectedDepto] = useState<string>('TODOS');
  const [selectedRole, setSelectedRole] = useState<string>('TODOS');
  const [selected2FAFilter, setSelected2FAFilter] = useState<'TODOS' | 'ATIVO' | 'DESATIVADO'>('TODOS');
  const [revealedCpfs, setRevealedCpfs] = useState<Record<string, boolean>>({});
  const [optimistic2FA, setOptimistic2FA] = useState<
    Record<string, { totpRequired: boolean; totpEnabled: boolean }>
  >({});
  const [toggling2FAId, setToggling2FAId] = useState<string | null>(null);
  const [bulk2FAModal, setBulk2FAModal] = useState<'enable' | 'disable' | null>(null);
  const [bulk2FALoading, setBulk2FALoading] = useState(false);

  // Modais
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editDepartamento, setEditDepartamento] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editCargo, setEditCargo] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editTotpRequired, setEditTotpRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserItem | null>(null);

  // Modal Confirmação de Função
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    user: UserItem;
    newRole: 'COLABORADOR' | 'USER' | 'RH' | 'SUBSTITUTO' | 'VISITANTE' | 'ADMIN';
    impact: string;
  } | null>(null);

  const formatCpfMask = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const maskCpfDisplay = (cpf: string | null | undefined, isRevealed: boolean) => {
    if (!cpf) return 'Não informado';
    if (isRevealed) return cpf;
    const clean = cpf.replace(/\D/g, '');
    if (clean.length === 11) {
      return `***.${clean.slice(3, 6)}.***-${clean.slice(9, 11)}`;
    }
    return '***.***.***-**';
  };

  const toggleRevealCpf = (userId: string) => {
    setRevealedCpfs((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'COLABORADOR':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25';
      case 'USER':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
      case 'RH':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/25';
      case 'SUBSTITUTO':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40 font-bold shadow-xs shadow-indigo-500/20';
      case 'VISITANTE':
        return 'bg-teal-500/15 text-teal-300 border-teal-400/35 font-semibold';
      case 'ADMIN':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25';
      case 'MASTER':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20';
      default:
        return 'bg-white/5 text-white/70 border-white/10';
    }
  };

  const getDeptoBadge = (depto?: string | null) => {
    switch (depto) {
      case 'Atendimento':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Registro':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'RH':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'TI':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'Administração':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Impressão/Arquivo':
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
      case 'Indisponibilidade':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Intimação':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'Ofício':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'VISITANTE':
        return 'bg-teal-500/10 text-teal-300 border-teal-500/25';
      default:
        return 'bg-white/5 text-white/70 border-white/10';
    }
  };

  const onSelectRole = (user: UserItem, newRole: 'COLABORADOR' | 'USER' | 'RH' | 'SUBSTITUTO' | 'VISITANTE' | 'ADMIN') => {
    if (user.role === newRole) return;
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') {
      alert('Usuário MASTER protegido - não pode ser alterado.');
      return;
    }

    if (newRole === 'ADMIN' && !user.name?.toLowerCase().includes('henrique cesar')) {
      alert('Apenas Henrique Cesar Ferreira Gama possui prerrogativa de ADMIN na organização.');
      return;
    }

    executeRoleChange(user.id, newRole);
  };

  const executeRoleChange = async (userId: string, newRole: 'COLABORADOR' | 'USER' | 'RH' | 'SUBSTITUTO' | 'VISITANTE' | 'ADMIN') => {
    setUpdatingRoleId(userId);
    try {
      const res = await updateUserRole(userId, newRole);
      if (res?.error) {
        alert(res.error);
      }
    } catch (err: any) {
      alert('Erro ao alterar a função do usuário: ' + (err?.message || 'Falha de comunicação com o servidor.'));
    } finally {
      setUpdatingRoleId(null);
      setPendingRoleChange(null);
    }
  };

  const getEffective2FA = (user: UserItem) => {
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') {
      return { required: true, enabled: true, isMaster: true };
    }
    const override = optimistic2FA[user.id];
    const required = override
      ? override.totpRequired
      : Boolean(user.totpRequired || user.totpEnabled);
    const enabled = override ? override.totpEnabled : Boolean(user.totpEnabled);
    return { required, enabled, isMaster: false };
  };

  const handleToggleUser2FA = async (user: UserItem) => {
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') {
      toast.error('Usuário MASTER protegido — o 2FA permanece sempre ativo.');
      return;
    }
    const current = getEffective2FA(user);
    const nextEnable = !current.required;

    setToggling2FAId(user.id);
    setOptimistic2FA((prev) => ({
      ...prev,
      [user.id]: {
        totpRequired: nextEnable,
        totpEnabled: nextEnable ? current.enabled : false,
      },
    }));

    try {
      const res = await toggleUser2FA(user.id, nextEnable);
      if (res?.error) {
        setOptimistic2FA((prev) => {
          const copy = { ...prev };
          delete copy[user.id];
          return copy;
        });
        toast.error(res.error);
        return;
      }
      toast.success(
        nextEnable
          ? `2FA ativado para ${user.name || user.email}. No próximo login será solicitado o vínculo/código.`
          : `2FA desativado para ${user.name || user.email}.`
      );
      router.refresh();
    } catch (err: any) {
      setOptimistic2FA((prev) => {
        const copy = { ...prev };
        delete copy[user.id];
        return copy;
      });
      toast.error(err?.message || 'Falha ao atualizar 2FA.');
    } finally {
      setToggling2FAId(null);
    }
  };

  const handleResetUser2FA = async (user: UserItem) => {
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') return;
    const ok = window.confirm(
      `Redefinir o QR Code do Google Authenticator de "${user.name || user.email}"?\n\nO 2FA continuará ativo, e um novo QR Code será apresentado no próximo login.`
    );
    if (!ok) return;

    setToggling2FAId(user.id);
    try {
      const res = await resetUser2FA(user.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setOptimistic2FA((prev) => ({
        ...prev,
        [user.id]: { totpRequired: true, totpEnabled: false },
      }));
      toast.success(`QR Code 2FA redefinido para ${user.name || user.email}.`);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao redefinir QR Code 2FA.');
    } finally {
      setToggling2FAId(null);
    }
  };

  const handleConfirmBulk2FA = async () => {
    if (!bulk2FAModal) return;
    const enable = bulk2FAModal === 'enable';
    setBulk2FALoading(true);
    try {
      const res = await bulkToggleUsers2FA(enable);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setOptimistic2FA({});
      setBulk2FAModal(null);
      toast.success(
        enable
          ? `2FA ativado para todos os usuários ativos (${res.affectedCount ?? 0} atualizados).`
          : `2FA desativado para os usuários do cartório (${res.affectedCount ?? 0} atualizados).`
      );
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao aplicar alteração de 2FA em massa.');
    } finally {
      setBulk2FALoading(false);
    }
  };

  const handleOpenEditModal = (user: UserItem) => {
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') {
      alert('Usuário MASTER protegido - não pode ser alterado.');
      return;
    }
    const effective2FA = getEffective2FA(user);
    setEditUser(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditCpf(user.cpf || '');
    setEditDepartamento(user.departamento || '');
    setEditRole(user.role || 'COLABORADOR');
    setEditCargo(user.cargo || '');
    setEditStatus(user.status || 'ativo');
    setEditTotpRequired(effective2FA.required);
    setModalMessage(null);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    // Validar CPF no frontend antes de enviar
    const cpfDigits = editCpf.replace(/\D/g, '');
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
      setModalMessage({ type: 'error', text: 'CPF deve ter exatamente 11 dígitos.' });
      return;
    }
    if (cpfDigits.length === 11 && !isValidCPF(cpfDigits)) {
      setModalMessage({ type: 'error', text: 'CPF inválido. Verifique os dígitos verificadores.' });
      return;
    }

    setLoading(true);
    setModalMessage(null);

    try {
      const res = await updateUserProfile(editUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        cpf: editCpf.trim(),
        departamento: editDepartamento.trim(),
        role: editRole,
        cargo: editCargo.trim(),
        status: editStatus,
        totpRequired: editTotpRequired,
      });

      if (res.error) {
        setModalMessage({ type: 'error', text: res.error });
      } else {
        setModalMessage({ type: 'success', text: 'Dados atualizados com sucesso!' });
        setTimeout(() => {
          setEditUser(null);
          window.location.reload();
        }, 800);
      }
    } catch (err: any) {
      setModalMessage({ type: 'error', text: err?.message || 'Falha ao atualizar dados.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPasswordModal = (user: UserItem) => {
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') {
      alert('Usuário MASTER protegido - não pode ter senha alterada por esta tela.');
      return;
    }
    setSelectedUser(user);
    setNewPassword('');
    setModalMessage(null);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    setModalMessage(null);

    try {
      const res = await resetUserPassword(selectedUser.id, newPassword);
      if (res.error) {
        setModalMessage({ type: 'error', text: res.error });
      } else {
        setModalMessage({ type: 'success', text: 'Senha redefinida com sucesso!' });
        setTimeout(() => setSelectedUser(null), 1000);
      }
    } catch {
      setModalMessage({ type: 'error', text: 'Erro ao resetar senha.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') {
      alert('Usuário MASTER protegido - não pode ser desativado.');
      return;
    }
    const confirm = window.confirm(`Deseja alterar o status do colaborador ${user.name}?`);
    if (!confirm) return;

    try {
      const res = await toggleUserStatus(user.id);
      if (!res.success) {
        alert('Falha ao alterar status.');
      }
    } catch {
      alert('Erro inesperado de rede.');
    }
  };

  const twoFactorStats = useMemo(() => {
    let activeCount = 0;
    let verifiedCount = 0;
    for (const u of usuarios) {
      const state =
        u.role === 'MASTER' || u.email === 'admin@fiorix.com.br'
          ? { required: true, enabled: true }
          : optimistic2FA[u.id]
          ? {
              required: optimistic2FA[u.id].totpRequired,
              enabled: optimistic2FA[u.id].totpEnabled,
            }
          : {
              required: Boolean(u.totpRequired || u.totpEnabled),
              enabled: Boolean(u.totpEnabled),
            };
      if (state.required) activeCount += 1;
      if (state.required && state.enabled) verifiedCount += 1;
    }
    return { activeCount, verifiedCount, total: usuarios.length };
  }, [usuarios, optimistic2FA]);

  const hasActiveUserFilters = Boolean(
    searchTerm.trim() ||
      selectedDepto !== 'TODOS' ||
      selectedRole !== 'TODOS' ||
      selected2FAFilter !== 'TODOS'
  );

  // Filtragem dos Usuários (acento-insensível, múltiplos termos e CPF somente quando há dígitos)
  const filteredUsers = useMemo(() => {
    return usuarios.filter((u) => {
      const matchesSearch = matchesCollaboratorSearch(u, searchTerm);
      const matchesDepto = selectedDepto === 'TODOS' || u.departamento === selectedDepto;
      const matchesRole = selectedRole === 'TODOS' || u.role === selectedRole;

      const is2FAActive =
        u.role === 'MASTER' || u.email === 'admin@fiorix.com.br'
          ? true
          : optimistic2FA[u.id]
          ? optimistic2FA[u.id].totpRequired
          : Boolean(u.totpRequired || u.totpEnabled);
      const matches2FA =
        selected2FAFilter === 'TODOS' ||
        (selected2FAFilter === 'ATIVO' && is2FAActive) ||
        (selected2FAFilter === 'DESATIVADO' && !is2FAActive);

      return matchesSearch && matchesDepto && matchesRole && matches2FA;
    });
  }, [usuarios, searchTerm, selectedDepto, selectedRole, selected2FAFilter, optimistic2FA]);

  const departamentos = [
    'TODOS',
    ...Array.from(
      new Set([
        ...departamentosDisponiveis,
        ...(usuarios.map((u) => u.departamento).filter(Boolean) as string[]),
      ])
    ).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
  ];

  return (
    <div className="space-y-4">
      {/* Barra de Controle Geral 2FA (Duplo Fator para Todos os Usuários) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/15 px-4 py-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2 text-emerald-300 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-white">
                Duplo Fator de Autenticação (2FA — Google Authenticator)
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                {twoFactorStats.activeCount} / {twoFactorStats.total} ativos ({twoFactorStats.verifiedCount} vinculados)
              </span>
            </div>
            <p className="text-[11px] text-white/55 mt-0.5">
              Ative ou desative o 2FA individualmente na coluna <strong className="text-white/80">2FA</strong> de cada usuário ou aplique para todos os usuários do cartório.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setBulk2FAModal('enable')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            Ativar 2FA para Todos
          </button>
          <button
            type="button"
            onClick={() => setBulk2FAModal('disable')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-rose-500/15 hover:text-rose-200 hover:border-rose-500/30 transition-colors cursor-pointer"
          >
            <ShieldOff className="w-3.5 h-3.5" />
            Desativar 2FA para Todos
          </button>
        </div>
      </div>

      {/* Barra de Pesquisa de Colaboradores e Filtros */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-white/[0.02] border border-white/10 rounded-2xl">
        <div className="relative flex-1 min-w-[240px]">
          <Search
            className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
              searchTerm.trim() ? 'text-amber-400' : 'text-white/45'
            }`}
          />
          <input
            type="text"
            aria-label="Pesquisar colaborador por nome, e-mail, CPF, cargo ou ramal"
            placeholder="Pesquisar nome do colaborador, e-mail, CPF, cargo ou ramal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#070A12] border border-white/12 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder:text-white/40 focus:outline-hidden focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              title="Limpar pesquisa por nome"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-white/45 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[11px] font-semibold ${
              hasActiveUserFilters
                ? 'border-amber-400/35 bg-amber-500/10 text-amber-300'
                : 'border-white/10 bg-[#070A12] text-white/60'
            }`}
          >
            {hasActiveUserFilters
              ? `Exibindo ${filteredUsers.length} de ${usuarios.length}`
              : `${usuarios.length} colaboradores`}
          </span>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-xs dark:bg-[#070A12] dark:border-white/10">
            <Building className="w-3.5 h-3.5 text-white/40" />
            <select
              value={selectedDepto}
              onChange={(e) => setSelectedDepto(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-hidden cursor-pointer"
            >
              {departamentos.map((d) => (
                <option key={d} value={d} className="bg-[#0A0F1E] text-white">
                  Depto: {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-xs dark:bg-[#070A12] dark:border-white/10">
            <Filter className="w-3.5 h-3.5 text-white/40" />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="TODOS" className="bg-[#0A0F1E]">Função: Todas</option>
              <option value="MASTER" className="bg-[#0A0F1E]">MASTER</option>
              <option value="ADMIN" className="bg-[#0A0F1E]">ADMIN</option>
              <option value="SUBSTITUTO" className="bg-[#0A0F1E]">SUBSTITUTO</option>
              <option value="VISITANTE" className="bg-[#0A0F1E]">VISITANTE</option>
              <option value="RH" className="bg-[#0A0F1E]">RH</option>
              <option value="USER" className="bg-[#0A0F1E]">USER</option>
              <option value="COLABORADOR" className="bg-[#0A0F1E]">COLABORADOR</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-xs dark:bg-[#070A12] dark:border-white/10">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80" />
            <select
              value={selected2FAFilter}
              onChange={(e) =>
                setSelected2FAFilter(e.target.value as 'TODOS' | 'ATIVO' | 'DESATIVADO')
              }
              className="bg-transparent text-white text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="TODOS" className="bg-[#0A0F1E]">2FA: Todos</option>
              <option value="ATIVO" className="bg-[#0A0F1E]">2FA: Ativo</option>
              <option value="DESATIVADO" className="bg-[#0A0F1E]">2FA: Desativado</option>
            </select>
          </div>

          {hasActiveUserFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedDepto('TODOS');
                setSelectedRole('TODOS');
                setSelected2FAFilter('TODOS');
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/12">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600 dark:border-white/12 dark:bg-[#0B1020] dark:text-white/58">
              <th className="p-3 pl-5 sm:p-4">Colaborador / Nome</th>
              <th className="p-3 sm:p-4">E-mail</th>
              <th className="p-3 sm:p-4">CPF (Validação RH)</th>
              <th className="p-3 sm:p-4">Departamento</th>
              <th className="p-3 sm:p-4">Função</th>
              <th className="p-3 sm:p-4">Cargo</th>
              <th className="p-3 sm:p-4">2FA (Duplo Fator)</th>
              <th className="p-3 sm:p-4">Status</th>
              <th className="p-3 pr-5 text-right sm:p-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/8 font-medium text-white/80">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 px-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-white/60">
                    <Search className="w-6 h-6 text-amber-400/60" />
                    <p className="text-xs font-semibold text-white/85">
                      Nenhum colaborador encontrado{searchTerm.trim() ? ` para "${searchTerm.trim()}"` : ''}.
                    </p>
                    <p className="text-[11px] text-white/45">
                      Verifique a grafia do nome ou limpe os filtros ativos para visualizar todo o quadro.
                    </p>
                    {hasActiveUserFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedDepto('TODOS');
                          setSelectedRole('TODOS');
                          setSelected2FAFilter('TODOS');
                        }}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/15 px-3.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restaurar quadro completo ({usuarios.length})
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : null}
            {filteredUsers.map((u) => {
              const isMaster = u.role === 'MASTER' || u.email === 'admin@fiorix.com.br';
              const isRevealed = Boolean(revealedCpfs[u.id]);
              const twoFactor = getEffective2FA(u);
              const isTogglingThis = toggling2FAId === u.id;

              return (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                  <td className="p-3 pl-5 sm:p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600/40 to-purple-600/40 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                        {u.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{u.name || 'Sem nome'}</span>
                          {isMaster && (
                            <span
                              title="Usuário MASTER protegido - não pode ser alterado"
                              className="cursor-help"
                            >
                              🔒
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-white/40 flex flex-wrap items-center gap-2 font-mono mt-0.5">
                          {u.ramal && <span>Ramal: {u.ramal}</span>}
                          {u.createdAt && (
                            <span>
                              {u.updatedAt && String(u.updatedAt) !== String(u.createdAt)
                                ? `✏️ Modificado em ${new Date(u.updatedAt).toLocaleDateString('pt-BR')}`
                                : `✨ Criado em ${new Date(u.createdAt).toLocaleDateString('pt-BR')}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3 sm:p-4 text-slate-600 dark:text-white/70 font-mono text-[11px]">
                    {u.email}
                  </td>

                  {/* CPF com Reveal Eye */}
                  <td className="p-3 sm:p-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-800 dark:text-white/90">
                        {maskCpfDisplay(u.cpf, isRevealed)}
                      </span>
                      {u.cpf && (
                        <button
                          type="button"
                          onClick={() => toggleRevealCpf(u.id)}
                          className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                          title={isRevealed ? 'Ocultar CPF' : 'Revelar CPF'}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Departamento Badge */}
                  <td className="p-3 sm:p-4">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${getDeptoBadge(u.departamento)}`}>
                      {u.departamento || 'Geral'}
                    </span>
                  </td>

                  {/* Função */}
                  <td className="p-3 sm:p-4">
                    {isMaster ? (
                      <span
                        title="Usuário MASTER protegido - não pode ser alterado"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300 font-extrabold text-[10px] font-mono tracking-wider shadow-xs shadow-amber-500/20"
                      >
                        <Lock className="w-3 h-3 text-amber-300" />
                        MASTER
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={updatingRoleId === u.id}
                        onChange={(e) =>
                          onSelectRole(
                            u,
                            e.target.value as 'COLABORADOR' | 'USER' | 'RH' | 'SUBSTITUTO' | 'VISITANTE' | 'ADMIN'
                          )
                        }
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-amber-400/50 cursor-pointer ${getRoleBadge(
                          u.role
                        )}`}
                      >
                        <option value="COLABORADOR" className="bg-[#121624] text-cyan-300 py-1 font-medium">Colaborador</option>
                        <option value="USER" className="bg-[#121624] text-blue-300 py-1 font-medium">Usuário</option>
                        <option value="RH" className="bg-[#121624] text-purple-300 py-1 font-medium">RH</option>
                        <option value="SUBSTITUTO" className="bg-[#121624] text-indigo-300 py-1 font-bold">Substituto</option>
                        <option value="VISITANTE" className="bg-[#121624] text-teal-300 py-1 font-semibold">Visitante</option>
                        <option value="ADMIN" className="bg-[#121624] text-amber-300 py-1 font-bold">Admin</option>
                      </select>
                    )}
                  </td>

                  {/* Cargo */}
                  <td className="p-3 sm:p-4 text-white/70 text-xs capitalize">
                    {u.cargo || 'auxiliar'}
                  </td>

                  {/* 2FA (Duplo Fator) */}
                  <td className="p-3 sm:p-4 whitespace-nowrap">
                    {isMaster ? (
                      <span
                        title="Conta MASTER protegida com 2FA obrigatório"
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-300"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                        Sempre Ativo
                      </span>
                    ) : (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isTogglingThis}
                          onClick={() => handleToggleUser2FA(u)}
                          title={
                            twoFactor.required
                              ? 'Clique para desativar o Duplo Fator (2FA) deste usuário'
                              : 'Clique para ativar o Duplo Fator (2FA) deste usuário'
                          }
                          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 ${
                            twoFactor.required
                              ? twoFactor.enabled
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                : 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                              : 'border-white/12 bg-white/[0.04] text-white/55 hover:border-emerald-500/35 hover:text-emerald-300'
                          }`}
                        >
                          <span
                            className={`inline-flex h-3.5 w-6 items-center rounded-full p-0.5 transition-colors ${
                              twoFactor.required
                                ? twoFactor.enabled
                                  ? 'bg-emerald-500/80 justify-end'
                                  : 'bg-amber-500/80 justify-end'
                                : 'bg-white/20 justify-start'
                            }`}
                          >
                            <span className="h-2.5 w-2.5 rounded-full bg-white shadow-xs" />
                          </span>
                          {isTogglingThis ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : twoFactor.required ? (
                            twoFactor.enabled ? (
                              <span>Ativo · Verificado</span>
                            ) : (
                              <span>Ativo · Pendente QR</span>
                            )
                          ) : (
                            <span>Desativado</span>
                          )}
                        </button>

                        {twoFactor.required && twoFactor.enabled && (
                          <button
                            type="button"
                            disabled={isTogglingThis}
                            onClick={() => handleResetUser2FA(u)}
                            title="Redefinir QR Code 2FA (ex: colaborador trocou de celular)"
                            className="rounded-lg border border-white/10 bg-white/[0.04] p-1 text-white/45 hover:text-amber-300 hover:border-amber-500/30 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="p-3 sm:p-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'inativo'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'inativo' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                      {u.status === 'inativo' ? 'Inativo' : 'Ativo'}
                    </span>
                  </td>

                  {/* Ações */}
                  <td className="p-3 pr-5 text-right sm:p-4 whitespace-nowrap">
                    {isMaster ? (
                      <span
                        title="Usuário MASTER protegido - não pode ser alterado - auth.users"
                        className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-300 inline-flex items-center gap-1.5 shadow-xs shadow-amber-500/20"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-300" /> Usuário MASTER protegido
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-xs text-white hover:bg-white/[0.08] transition-colors"
                          title="Editar Nome e CPF"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenPasswordModal(u)}
                          className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                          title="Resetar Senha"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`rounded-lg border p-1.5 text-xs transition-colors ${
                            u.status === 'inativo'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                          }`}
                          title={u.status === 'inativo' ? 'Ativar Colaborador' : 'Desativar Colaborador'}
                        >
                          {u.status === 'inativo' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        </button>
                        {u.status === 'inativo' && (
                          <button
                            onClick={() => setDeleteConfirmUser(u)}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/15 p-1.5 text-xs text-rose-400 hover:bg-rose-500/25 transition-colors"
                            title="Excluir Usuário Inativo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Editar Colaborador Completo */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-lg bg-[#0B1020] border border-white/12 rounded-[24px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                Editar Colaborador
              </h3>
              <button
                onClick={() => setEditUser(null)}
                className="p-1 rounded-lg text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  modalMessage.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                {modalMessage.text}
              </div>
            )}

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#070A12] border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-[#070A12] border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                  CPF (Validação 1-para-1 do RH)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={editCpf}
                    onChange={(e) => setEditCpf(formatCpfMask(e.target.value))}
                    className={`w-full bg-[#070A12] border rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden font-mono pr-10 ${
                      editCpf.replace(/\D/g, '').length === 11
                        ? isValidCPF(editCpf)
                          ? 'border-emerald-500/40 focus:border-emerald-400'
                          : 'border-red-500/40 focus:border-red-400'
                        : 'border-white/12 focus:border-amber-400/50'
                    }`}
                  />
                  {editCpf.replace(/\D/g, '').length === 11 && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${
                      isValidCPF(editCpf) ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {isValidCPF(editCpf) ? '✓ Válido' : '✗ Inválido'}
                    </span>
                  )}
                </div>
                {editCpf.replace(/\D/g, '').length === 11 && !isValidCPF(editCpf) && (
                  <p className="text-[10px] text-red-400/80 mt-1">Dígitos verificadores não conferem. Verifique o número.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                    Departamento
                  </label>
                  <select
                    value={editDepartamento}
                    onChange={(e) => setEditDepartamento(e.target.value)}
                    className="w-full bg-[#070A12] border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-amber-400/50"
                  >
                    <option value="">Selecionar...</option>
                    {departamentos.filter(d => d !== 'TODOS').map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                    Função (Nível de Acesso)
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-[#070A12] border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-amber-400/50"
                  >
                    <option value="COLABORADOR" className="bg-[#121624] text-cyan-300 py-1">Colaborador</option>
                    <option value="USER" className="bg-[#121624] text-blue-300 py-1">Usuário</option>
                    <option value="RH" className="bg-[#121624] text-purple-300 py-1">RH</option>
                    <option value="SUBSTITUTO" className="bg-[#121624] text-indigo-300 py-1 font-bold">Substituto</option>
                    <option value="VISITANTE" className="bg-[#121624] text-teal-300 py-1 font-semibold">Visitante</option>
                    <option value="ADMIN" className="bg-[#121624] text-amber-300 py-1 font-bold">Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={editCargo}
                    onChange={(e) => setEditCargo(e.target.value)}
                    placeholder="Ex: Escrevente, Auxiliar..."
                    className="w-full bg-[#070A12] border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-[#070A12] border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-amber-400/50"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              {/* Duplo Fator de Autenticação (2FA) no Modal de Edição */}
              <div className="rounded-2xl border border-white/10 bg-[#070A12] p-3.5 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <ShieldCheck className={`w-4 h-4 ${editTotpRequired ? 'text-emerald-400' : 'text-white/40'}`} />
                    <span>Duplo Fator de Autenticação (2FA)</span>
                  </div>
                  <p className="text-[11px] text-white/55">
                    {editTotpRequired
                      ? 'Ativado: exige código de 6 dígitos do Google Authenticator (gera QR Code no 1º acesso).'
                      : 'Desativado: login realizado apenas com e-mail e senha.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditTotpRequired((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                    editTotpRequired
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/15 bg-white/[0.04] text-white/60'
                  }`}
                >
                  <span
                    className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${
                      editTotpRequired ? 'bg-emerald-500 justify-end' : 'bg-white/20 justify-start'
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full bg-white" />
                  </span>
                  <span>{editTotpRequired ? 'Ativado' : 'Desativado'}</span>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold hover:bg-white/[0.08]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-amber-400 text-white text-xs font-bold shadow-md hover:brightness-105 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resetar Senha */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md bg-[#0B1020] border border-white/12 rounded-[24px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                Resetar Senha de Acesso
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-lg text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/70">
              Redefina a senha de acesso para o colaborador{' '}
              <strong className="text-white">{selectedUser.name}</strong> ({selectedUser.email}):
            </p>

            {modalMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  modalMessage.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                {modalMessage.text}
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                  Nova Senha (Mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#070A12] border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-cyan-400/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold hover:bg-white/[0.08]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || newPassword.length < 6}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Confirmar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md bg-[#0B1020] border border-rose-500/20 rounded-[24px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Excluir Usuário
              </h3>
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="p-1 rounded-lg text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
              <p className="text-sm text-white font-semibold">
                Tem certeza que deseja excluir permanentemente?
              </p>
              <p className="text-xs text-rose-300">
                <strong>{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})
              </p>
              <p className="text-[11px] text-rose-400/80">
                ⚠️ Esta ação é irreversível. Todos os dados deste usuário serão apagados.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold hover:bg-white/[0.08]"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await deleteInactiveUser(deleteConfirmUser.id);
                    if (res.error) {
                      alert(res.error);
                    } else {
                      setDeleteConfirmUser(null);
                      window.location.reload();
                    }
                  } catch (err: any) {
                    alert(err?.message || 'Erro ao excluir.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md disabled:opacity-50"
              >
                {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação 2FA em Massa */}
      {bulk2FAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md bg-[#0B1020] border border-white/12 rounded-[24px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {bulk2FAModal === 'enable' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ShieldOff className="w-4 h-4 text-rose-400" />
                )}
                {bulk2FAModal === 'enable'
                  ? 'Ativar 2FA para Todos os Usuários'
                  : 'Desativar 2FA para Todos os Usuários'}
              </h3>
              <button
                onClick={() => setBulk2FAModal(null)}
                className="p-1 rounded-lg text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-2 text-xs ${
                bulk2FAModal === 'enable'
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-100'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-100'
              }`}
            >
              {bulk2FAModal === 'enable' ? (
                <>
                  <p className="font-semibold text-white">
                    Deseja ativar o Duplo Fator de Autenticação (2FA) para todos os colaboradores e usuários ativos do cartório?
                  </p>
                  <p className="text-white/75">
                    • Quem já possui o Google Authenticator vinculado mantém o vínculo atual.
                  </p>
                  <p className="text-white/75">
                    • Quem ainda não configurou receberá automaticamente o QR Code na tela de login no próximo acesso.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-white">
                    Deseja desativar o Duplo Fator de Autenticação (2FA) para todos os usuários do cartório?
                  </p>
                  <p className="text-white/75">
                    • Todos os usuários (exceto a conta MASTER protegida) passarão a acessar apenas com e-mail e senha.
                  </p>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={bulk2FALoading}
                onClick={() => setBulk2FAModal(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold hover:bg-white/[0.08]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={bulk2FALoading}
                onClick={handleConfirmBulk2FA}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer ${
                  bulk2FAModal === 'enable'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {bulk2FALoading
                  ? 'Aplicando...'
                  : bulk2FAModal === 'enable'
                  ? 'Confirmar Ativação em Todos'
                  : 'Confirmar Desativação em Todos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
