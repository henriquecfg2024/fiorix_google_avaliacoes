'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  ShieldCheck,
  Search,
  Plus,
  Crown,
  ExternalLink,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  X,
  Loader2,
  Globe,
  Mail,
  MapPin,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getMasterTenants,
  createTenant,
  updateTenant,
  type MasterTenantItem,
  type MasterOverviewMetrics,
  type CreateTenantInput,
} from '@/app/actions/tenants';

export default function MasterTenantsPage() {
  const [tenants, setTenants] = useState<MasterTenantItem[]>([]);
  const [metrics, setMetrics] = useState<MasterOverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPlano, setFilterPlano] = useState<string>('todos');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateTenantInput>({
    name: '',
    slug: '',
    cnpj: '',
    dominio: '',
    cidade: '',
    estado: 'SP',
    plano: 'PRO',
    status: 'ativo',
    maxUsuarios: 100,
    responsavelNome: '',
    responsavelEmail: '',
    dpoEmail: '',
    adminNome: '',
    adminEmail: '',
    adminSenha: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await getMasterTenants();
      setTenants(res.tenants);
      setMetrics(res.metrics);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Falha ao carregar dados do painel Master.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.slug && t.slug.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.cnpj && t.cnpj.includes(searchTerm)) ||
        (t.cidade && t.cidade.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.dominio && t.dominio.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = filterStatus === 'todos' || t.status === filterStatus;
      const matchesPlano =
        filterPlano === 'todos' || t.plano.toUpperCase() === filterPlano.toUpperCase();

      return matchesSearch && matchesStatus && matchesPlano;
    });
  }, [tenants, searchTerm, filterStatus, filterPlano]);

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      name: '',
      slug: '',
      cnpj: '',
      dominio: '',
      cidade: '',
      estado: 'SP',
      plano: 'PRO',
      status: 'ativo',
      maxUsuarios: 100,
      responsavelNome: '',
      responsavelEmail: '',
      dpoEmail: '',
      adminNome: '',
      adminEmail: '',
      adminSenha: '',
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (t: MasterTenantItem) => {
    setIsEditing(true);
    setEditingId(t.id);
    setFormData({
      name: t.name,
      slug: t.slug || '',
      cnpj: t.cnpj || '',
      dominio: t.dominio || '',
      cidade: t.cidade || '',
      estado: t.estado || 'SP',
      plano: (t.plano as any) || 'PRO',
      status: (t.status as any) || 'ativo',
      maxUsuarios: t.maxUsuarios || 100,
      responsavelNome: t.responsavelNome || '',
      responsavelEmail: t.responsavelEmail || '',
      dpoEmail: t.dpoEmail || '',
    });
    setModalOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => {
      if (!isEditing && (!prev.slug || prev.slug === generateSlug(prev.name))) {
        return { ...prev, name, slug: generateSlug(name) };
      }
      return { ...prev, name };
    });
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isEditing && editingId) {
        await updateTenant(editingId, {
          name: formData.name,
          slug: formData.slug,
          cnpj: formData.cnpj,
          dominio: formData.dominio,
          cidade: formData.cidade,
          estado: formData.estado,
          plano: formData.plano,
          status: formData.status,
          maxUsuarios: formData.maxUsuarios,
          responsavelNome: formData.responsavelNome,
          responsavelEmail: formData.responsavelEmail,
          dpoEmail: formData.dpoEmail,
        });
        toast.success(`Cartório "${formData.name}" atualizado com sucesso!`);
      } else {
        await createTenant(formData);
        toast.success(`Cartório "${formData.name}" provisionado com sucesso!`);
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Ocorreu um erro ao salvar o cartório.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlanoBadgeClass = (plano: string) => {
    switch (plano?.toUpperCase()) {
      case 'OMEGA':
        return 'bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10';
      case 'PRO':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'BASIC':
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ativo':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'trial':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'suspenso':
      case 'inativo':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 text-white">
      {/* Header com estilo Dark Luxury */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">Painel Master — Cartórios</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  SaaS V4
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Gestão multi-tenant, provisionamento de novas serventias e isolamento de dados
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-purple-600/25 border border-purple-400/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cartório</span>
        </Button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#12141f] border border-zinc-800/80 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Cartórios Cadastrados</span>
            <Building2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics?.totalCartorios || 0}</span>
            <span className="text-xs text-zinc-500">serventias</span>
          </div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{metrics?.cartoriosAtivos || 0} em produção</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#12141f] border border-zinc-800/80 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Usuários Totais</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics?.totalUsuarios || 0}</span>
            <span className="text-xs text-zinc-500">contas ativas</span>
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            Isolamento estrito por <code className="text-purple-300 text-[11px]">tenantId</code>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#12141f] border border-zinc-800/80 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Em Período Trial</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics?.cartoriosTrial || 0}</span>
            <span className="text-xs text-zinc-500">em avaliação</span>
          </div>
          <div className="mt-2 text-xs text-amber-400/90 font-medium">
            {metrics?.cartoriosTrial ? 'Acompanhar conversão comercial' : 'Nenhum cartório em trial no momento'}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#12141f] border border-zinc-800/80 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-purple-500 to-indigo-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Distribuição de Planos</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-zinc-300">OMEGA: <strong>{metrics?.planos.omega || 0}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-zinc-300">PRO: <strong>{metrics?.planos.pro || 0}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              <span className="text-zinc-300">BASIC: <strong>{metrics?.planos.basic || 0}</strong></span>
            </div>
          </div>
          <div className="mt-3 w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${((metrics?.planos.omega || 0) / Math.max(metrics?.totalCartorios || 1, 1)) * 100}%` }}
              className="bg-amber-400 h-full"
            />
            <div
              style={{ width: `${((metrics?.planos.pro || 0) / Math.max(metrics?.totalCartorios || 1, 1)) * 100}%` }}
              className="bg-purple-500 h-full"
            />
            <div
              style={{ width: `${((metrics?.planos.basic || 0) / Math.max(metrics?.totalCartorios || 1, 1)) * 100}%` }}
              className="bg-zinc-500 h-full"
            />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#12141f] border border-zinc-800/80 p-3 rounded-2xl">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, slug, CNPJ ou cidade..."
            className="w-full bg-[#1a1d2d] border border-zinc-700/60 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1a1d2d] border border-zinc-700/60 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 focus:outline-none focus:border-purple-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativo</option>
            <option value="trial">Trial</option>
            <option value="suspenso">Suspenso</option>
          </select>

          <select
            value={filterPlano}
            onChange={(e) => setFilterPlano(e.target.value)}
            className="bg-[#1a1d2d] border border-zinc-700/60 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 focus:outline-none focus:border-purple-500"
          >
            <option value="todos">Todos os Planos</option>
            <option value="OMEGA">Plano OMEGA</option>
            <option value="PRO">Plano PRO</option>
            <option value="BASIC">Plano BASIC</option>
          </select>
        </div>
      </div>

      {/* Tabela de Cartórios */}
      <div className="bg-[#12141f] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            <span className="text-sm font-medium">Carregando infraestrutura multi-tenant...</span>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">
            <Building2 className="w-12 h-12 mx-auto text-zinc-600 mb-2" />
            <p className="text-base font-semibold text-white">Nenhum cartório encontrado</p>
            <p className="text-xs text-zinc-500 mt-1">Tente ajustar seus filtros ou cadastre um novo cartório.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#181b2a] text-zinc-400 text-xs uppercase tracking-wider border-b border-zinc-800 font-semibold">
                <tr>
                  <th className="py-3.5 px-6">Cartório & Identificação</th>
                  <th className="py-3.5 px-4">CNPJ & Domínio</th>
                  <th className="py-3.5 px-4">Localização</th>
                  <th className="py-3.5 px-4">Plano</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Usuários</th>
                  <th className="py-3.5 px-4">Responsável</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                        {t.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/80 font-mono text-[11px] text-purple-400">
                          {t.slug || 'sem-slug'}
                        </span>
                        {t.slug === '7ri-sp' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                            ORIGINAL
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-xs font-mono text-zinc-300">
                      <div>{t.cnpj || '—'}</div>
                      <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                        <Globe className="w-3 h-3 text-zinc-500" />
                        <span>{t.dominio || 'sem domínio'}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-xs text-zinc-300">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{t.cidade ? `${t.cidade} - ${t.estado || 'SP'}` : '—'}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold border ${getPlanoBadgeClass(t.plano)}`}>
                        {t.plano?.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${getStatusBadgeClass(t.status)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {t.status?.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-xs">
                      <div className="font-semibold text-white">
                        {t._count.users} / {t.maxUsuarios}
                      </div>
                      <div className="w-24 bg-zinc-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, (t._count.users / Math.max(t.maxUsuarios, 1)) * 100)}%` }}
                          className={`h-full ${t._count.users > t.maxUsuarios ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        />
                      </div>
                    </td>

                    <td className="py-4 px-4 text-xs text-zinc-400">
                      <div className="font-medium text-zinc-200">{t.responsavelNome || '—'}</div>
                      <div className="text-[11px] text-zinc-500">{t.responsavelEmail || t.dpoEmail || ''}</div>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Novo / Editar Cartório */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#141624] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-[#181b2e]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {isEditing ? 'Editar Dados do Cartório' : 'Provisionar Novo Cartório'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Configuração multi-tenant, domínio e limites operacionais
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 border-b border-zinc-800 pb-1">
                  1. Dados Oficiais da Serventia
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Nome Oficial do Cartório *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ex: 1º Cartório de Registro de Imóveis de Sorocaba"
                      className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Slug do Cartório (Identificador Único) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: generateSlug(e.target.value) })}
                      placeholder="ex: 1ri-sorocaba"
                      className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm font-mono text-purple-300 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      CNPJ Oficial
                    </label>
                    <input
                      type="text"
                      value={formData.cnpj || ''}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      placeholder="00.000.000/0001-00"
                      className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Domínio Corporativo
                    </label>
                    <input
                      type="text"
                      value={formData.dominio || ''}
                      onChange={(e) => setFormData({ ...formData, dominio: e.target.value })}
                      placeholder="cartoriosorocaba.com.br"
                      className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">Cidade</label>
                      <input
                        type="text"
                        value={formData.cidade || ''}
                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                        placeholder="Sorocaba"
                        className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">UF</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={formData.estado || 'SP'}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                        placeholder="SP"
                        className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm uppercase text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 border-b border-zinc-800 pb-1 pt-3">
                  2. Plano & Parâmetros de Uso
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Plano SaaS</label>
                    <select
                      value={formData.plano}
                      onChange={(e) => setFormData({ ...formData, plano: e.target.value as any })}
                      className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="BASIC">BASIC (Pequeno porte)</option>
                      <option value="PRO">PRO (Médio porte)</option>
                      <option value="OMEGA">OMEGA (Enterprise / Ilimitado)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="trial">Trial (Avaliação)</option>
                      <option value="suspenso">Suspenso</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Máx. Usuários</label>
                    <input
                      type="number"
                      min={5}
                      max={1000}
                      value={formData.maxUsuarios || 100}
                      onChange={(e) => setFormData({ ...formData, maxUsuarios: Number(e.target.value) })}
                      className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 border-b border-zinc-800 pb-1 pt-3">
                  3. Contatos Institucionais & LGPD
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Nome do Responsável</label>
                    <input
                      type="text"
                      value={formData.responsavelNome || ''}
                      onChange={(e) => setFormData({ ...formData, responsavelNome: e.target.value })}
                      placeholder="Oficial ou Substituto titular"
                      className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">E-mail do Responsável</label>
                    <input
                      type="email"
                      value={formData.responsavelEmail || ''}
                      onChange={(e) => setFormData({ ...formData, responsavelEmail: e.target.value })}
                      placeholder="oficial@cartorio.com.br"
                      className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">E-mail do DPO / Encarregado LGPD</label>
                    <input
                      type="email"
                      value={formData.dpoEmail || ''}
                      onChange={(e) => setFormData({ ...formData, dpoEmail: e.target.value })}
                      placeholder="dpo@cartorio.com.br"
                      className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {!isEditing && (
                  <>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 border-b border-zinc-800 pb-1 pt-3">
                      4. Administrador Inicial (Opcional)
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">E-mail do Administrador</label>
                        <input
                          type="email"
                          value={formData.adminEmail || ''}
                          onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                          placeholder="admin@cartorio.com.br"
                          className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">Nome do Administrador</label>
                        <input
                          type="text"
                          value={formData.adminNome || ''}
                          onChange={(e) => setFormData({ ...formData, adminNome: e.target.value })}
                          placeholder="Nome do gestor"
                          className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">Senha Inicial Provisória</label>
                        <input
                          type="password"
                          value={formData.adminSenha || ''}
                          onChange={(e) => setFormData({ ...formData, adminSenha: e.target.value })}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full bg-[#1a1d30] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  disabled={isSubmitting}
                  className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium px-6 py-2.5 rounded-xl shadow-lg shadow-purple-600/25 border border-purple-400/30"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>{isEditing ? 'Atualizar Cartório' : 'Concluir Provisionamento'}</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
