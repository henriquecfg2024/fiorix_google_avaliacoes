'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Lock,
  LogIn,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  Smartphone,
  ArrowLeft,
  Building2,
  Crown,
} from 'lucide-react';
import { getActiveTenants, type ActiveTenantItem } from '@/app/actions/tenants';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Multi-Tenant State
  const [tenants, setTenants] = useState<ActiveTenantItem[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  // 2FA State
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [totpCode, setTotpCode] = useState(['', '', '', '', '', '']);
  const totpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Carrega cartórios ativos para a tela de login
    getActiveTenants().then((items) => {
      setTenants(items);
      const savedTenantId = localStorage.getItem('fiorix_selected_tenant');
      if (savedTenantId && items.some((t) => t.id === savedTenantId)) {
        setSelectedTenantId(savedTenantId);
      } else if (items.length > 0) {
        const defaultTenant = items.find((t) => t.slug === '7ri-sp') || items[0];
        setSelectedTenantId(defaultTenant.id);
      }
    });

    const savedEmail = localStorage.getItem('fiorix_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Foca no primeiro input TOTP quando entra no step 2FA
  useEffect(() => {
    if (step === 'totp') {
      setTimeout(() => totpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  function handleTotpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return; // Aceita só dígitos
    const newCode = [...totpCode];
    newCode[index] = value.slice(-1);
    setTotpCode(newCode);

    // Auto-avança para próximo input
    if (value && index < 5) {
      totpRefs.current[index + 1]?.focus();
    }
  }

  function handleTotpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !totpCode[index] && index > 0) {
      totpRefs.current[index - 1]?.focus();
    }
  }

  function handleTotpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...totpCode];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setTotpCode(newCode);
    const nextEmpty = pasted.length < 6 ? pasted.length : 5;
    totpRefs.current[nextEmpty]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (rememberMe) {
      localStorage.setItem('fiorix_remember_email', email);
    } else {
      localStorage.removeItem('fiorix_remember_email');
    }

    try {
      if (step === 'credentials') {
        // Passo 1: Verifica credenciais e se precisa de 2FA
        const { checkCredentials } = await import('@/app/actions/auth');
        const result = await checkCredentials(email, password);

        if (!result.valid) {
          setError(result.error || 'Credenciais inválidas.');
          setIsLoading(false);
          return;
        }

        if (result.requires2FA) {
          setStep('totp');
          setError('');
          setIsLoading(false);
          return;
        }

        // Não precisa de 2FA → login direto
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);
        formData.append('redirectTo', '/dashboard');

        const { authenticate } = await import('@/app/actions/auth');
        const errorMessage = await authenticate(undefined, formData);
        if (errorMessage) {
          setError(errorMessage);
        }
      } else {
        // Passo 2: Verifica código TOTP
        const code = totpCode.join('');
        if (code.length !== 6) {
          setError('Digite o código completo de 6 dígitos.');
          setIsLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);
        formData.append('totpCode', code);
        formData.append('redirectTo', '/dashboard');

        const { authenticate } = await import('@/app/actions/auth');
        const errorMessage = await authenticate(undefined, formData);
        if (errorMessage) {
          if (errorMessage === 'INVALID_2FA_CODE') {
            setError('Código inválido. Verifique seu Google Authenticator.');
            setTotpCode(['', '', '', '', '', '']);
            totpRefs.current[0]?.focus();
          } else if (errorMessage === 'REQUIRES_2FA') {
            setError('Código de autenticação é obrigatório.');
          } else {
            setError(errorMessage);
          }
        }
      }
    } catch {
      setError('Ocorreu um erro ao tentar fazer login.');
    } finally {
      setIsLoading(false);
    }
  }

  const isMaster = email.trim().toLowerCase() === 'admin@fiorix.com.br';
  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];
  const emailPlaceholder = isMaster
    ? 'admin@fiorix.com.br'
    : selectedTenant?.dominio
    ? `seu.nome@${selectedTenant.dominio}`
    : 'seu.nome@7risp.com.br';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#0a0a0f] relative overflow-hidden select-none">
      {/* Luz ambiente / Ambient Glows */}
      <div className="absolute -left-32 -top-24 w-[520px] h-[520px] rounded-full bg-purple-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute -right-32 -bottom-24 w-[480px] h-[480px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[460px] bg-[#141624]/90 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-7 sm:p-9 shadow-2xl shadow-black/80 relative z-10 flex flex-col gap-6">
        {/* Badge de Segurança */}
        <div className="inline-flex items-center gap-2 self-center px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Acesso seguro ao painel do cartório</span>
        </div>

        {/* Logo e Cabeçalho */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-3 justify-center mb-1">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-purple-600/35 border border-purple-400/30">
              F
            </div>
            <span className="text-2xl font-black tracking-tight text-white">FIORIX</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Bem-vindo de volta</h1>
          <p className="text-xs text-zinc-400">
            Faça login para acessar o painel do seu cartório.
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}

          {step === 'credentials' ? (
            <>
              {/* Identificação do Cartório / Master */}
              {isMaster ? (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-transparent border border-amber-500/40 shadow-lg shadow-amber-500/5">
                  <div className="flex items-center gap-3">
                    <Crown className="w-5 h-5 text-amber-400 filter drop-shadow" />
                    <div>
                      <div className="text-xs font-bold text-amber-200">Acesso MASTER Plataforma</div>
                      <div className="text-[11px] text-amber-400/80 font-medium">Gestão global multi-tenant</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    MASTER
                  </span>
                </div>
              ) : tenants.length > 1 ? (
                /* Seletor dinâmico caso haja mais de 1 cartório cadastrado */
                <div className="space-y-1.5">
                  <label htmlFor="tenant" className="block text-xs font-semibold text-zinc-300">
                    Selecione seu Cartório
                  </label>
                  <div className="relative flex items-center">
                    <Building2 className="w-4 h-4 absolute left-3.5 text-zinc-400 pointer-events-none" />
                    <select
                      id="tenant"
                      value={selectedTenantId}
                      onChange={(e) => {
                        setSelectedTenantId(e.target.value);
                        localStorage.setItem('fiorix_selected_tenant', e.target.value);
                      }}
                      disabled={isLoading}
                      className="w-full bg-[#1c1f33] border border-zinc-700/80 hover:border-zinc-600 focus:border-purple-500 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none transition-colors cursor-pointer"
                    >
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id} className="bg-[#1c1f33] text-white">
                          {t.name} {t.cnpj ? `(${t.cnpj})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                /* Exibição Oficial do 7º Cartório (Único Cliente Ativo) */
                <div className="p-3.5 rounded-2xl bg-[#1c1f33]/80 border border-zinc-700/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">
                        {selectedTenant?.name || '7º Cartório de Registro de Imóveis de São Paulo'}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        {selectedTenant?.cnpj ? `CNPJ ${selectedTenant.cnpj}` : '11.111.111/0001-07'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    7º RI
                  </span>
                </div>
              )}

              {/* E-mail */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-semibold text-zinc-300">
                  E-mail Corporativo
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 absolute left-3.5 text-zinc-400 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={emailPlaceholder}
                    autoComplete="username"
                    inputMode="email"
                    required
                    disabled={isLoading}
                    className="w-full bg-[#1c1f33] border border-zinc-700/80 hover:border-zinc-600 focus:border-purple-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-zinc-300">
                  Senha
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3.5 text-zinc-400 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                    className="w-full bg-[#1c1f33] border border-zinc-700/80 hover:border-zinc-600 focus:border-purple-500 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Lembrar-me e Esqueci Senha */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-zinc-400 hover:text-zinc-300 cursor-pointer font-medium select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span>Lembrar-me</span>
                </label>
                <button
                  type="button"
                  onClick={() => alert('Entre em contato com o administrador do cartório para redefinir sua senha.')}
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>

              {/* Botão de Entrar */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/25 border border-purple-400/30 transition-all flex items-center justify-center gap-2 mt-3 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando credenciais...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Entrar no Painel</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* ── Tela 2FA TOTP ──────────────────────────────────── */
            <div className="space-y-6 text-center py-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/10">
                <Smartphone className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Verificação em duas etapas</h2>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Abra o <strong>Google Authenticator</strong> e digite o código de 6 dígitos gerado para <strong>{email}</strong>
                </p>
              </div>

              <div className="flex justify-center gap-2.5">
                {totpCode.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      totpRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleTotpChange(i, e.target.value)}
                    onKeyDown={(e) => handleTotpKeyDown(i, e)}
                    onPaste={i === 0 ? handleTotpPaste : undefined}
                    disabled={isLoading}
                    autoComplete="one-time-code"
                    className="w-11 h-13 text-center text-xl font-bold rounded-xl bg-[#1c1f33] border border-zinc-700/90 text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading || totpCode.join('').length !== 6}
                className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/25 border border-purple-400/30 transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validando código...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verificar e Entrar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setError('');
                  setTotpCode(['', '', '', '', '', '']);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para credenciais</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Rodapé Institucional Seguro */}
      <footer className="mt-8 text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-center gap-1.5 relative z-10">
        <span>© 2026 FIORIX • Sistema de Gestão Cartorária</span>
        <span className="text-purple-400/90 font-medium">
          • 7º Cartório de Registro de Imóveis de São Paulo
        </span>
      </footer>
    </div>
  );
}
