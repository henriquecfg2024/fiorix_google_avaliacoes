'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('fiorix_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (rememberMe) {
      localStorage.setItem('fiorix_remember_email', email);
    } else {
      localStorage.removeItem('fiorix_remember_email');
    }

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('redirectTo', '/dashboard');

    try {
      const { authenticate } = await import('@/app/actions/auth');
      const errorMessage = await authenticate(undefined, formData);
      if (errorMessage) {
        setError(errorMessage);
      }
    } catch {
      setError('Ocorreu um erro ao tentar fazer login.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-shell">
      {/* Luz ambiente / Ambient Glows */}
      <div className="login-ambient-purple" />
      <div className="login-ambient-amber" />

      <div className="login-card">
        {/* Badge de Segurança */}
        <div className="login-badge">
          <ShieldCheck className="badge-icon" />
          <span>Acesso seguro ao painel do cartório</span>
        </div>

        {/* Logo e Cabeçalho */}
        <div className="login-header">
          <div className="login-brand">
            <div className="brand-icon">F</div>
            <span className="brand-text">FIORIX</span>
          </div>
          <h1 className="login-title">Bem-vindo de volta</h1>
          <p className="login-subtitle">Faça login para acessar o painel do seu cartório.</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">E-mail Corporativo</label>
            <div className="input-wrap">
              <Mail className="input-icon" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.nome@7risp.com.br"
                autoComplete="username"
                inputMode="email"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <div className="input-wrap">
              <Lock className="input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="eye-icon" /> : <Eye className="eye-icon" />}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
              <span>Lembrar-me</span>
            </label>
            <a
              href="#"
              className="forgot-password"
              onClick={(e) => {
                e.preventDefault();
                alert('Entre em contato com o administrador do cartório para redefinir sua senha.');
              }}
            >
              Esqueceu a senha?
            </a>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="button-icon animate-spin" />
                <span>Autenticando com segurança...</span>
              </>
            ) : (
              <>
                <LogIn className="button-icon" />
                <span>Entrar no Painel</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Rodapé Institucional Seguro */}
      <footer className="login-footer">
        © 2026 FIORIX • Sistema de Gestão Cartorária
      </footer>

      <style jsx>{`
        .login-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background-color: #0a0a0f;
          padding: 24px;
        }

        /* Ambient Glows */
        .login-ambient-purple {
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 999px;
          filter: blur(120px);
          opacity: 0.18;
          background: radial-gradient(circle, #7c3aed 0%, transparent 70%);
          left: -120px;
          top: -80px;
          pointer-events: none;
        }

        .login-ambient-amber {
          position: absolute;
          width: 480px;
          height: 480px;
          border-radius: 999px;
          filter: blur(130px);
          opacity: 0.12;
          background: radial-gradient(circle, #f59e0b 0%, transparent 70%);
          right: -100px;
          bottom: -80px;
          pointer-events: none;
        }

        /* Card Central Dark Premium */
        .login-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          padding: 36px 32px;
          border-radius: 24px;
          background: #16161f;
          border: 1px solid #2a2a3a;
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.55),
            0 0 1px 1px rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Badge Superior */
        .login-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.25);
          color: #10b981;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .badge-icon {
          width: 14px;
          height: 14px;
          color: #10b981;
          flex-shrink: 0;
        }

        /* Header e Marca */
        .login-header {
          text-align: center;
          margin-bottom: 26px;
          width: 100%;
        }

        .login-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .brand-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
          color: #ffffff;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 22px;
          box-shadow: 0 8px 20px rgba(124, 58, 237, 0.35);
        }

        .brand-text {
          font-size: 26px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.03em;
        }

        .login-title {
          font-size: 26px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 8px;
          letter-spacing: -0.03em;
        }

        .login-subtitle {
          font-size: 14px;
          color: #9ca3af;
          line-height: 1.45;
        }

        /* Formulário */
        .login-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #e5e7eb;
        }

        .input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          width: 18px;
          height: 18px;
          color: #6b7280;
          pointer-events: none;
          transition: color 0.2s ease;
        }

        .form-group input {
          width: 100%;
          padding: 13px 44px 13px 44px;
          border-radius: 12px;
          border: 1px solid #2a2a3a;
          background: #1e1e2a;
          font-size: 14px;
          color: #ffffff;
          caret-color: #ffffff;
          outline: none;
          transition: all 0.2s ease;
        }

        .form-group input::placeholder {
          color: #64748b;
        }

        .form-group input:hover {
          border-color: #3b3b4f;
        }

        .form-group input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
          background: #232332;
        }

        .input-wrap:focus-within .input-icon {
          color: #a78bfa;
        }

        .toggle-password {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: color 0.2s;
        }

        .toggle-password:hover {
          color: #e5e7eb;
        }

        .eye-icon {
          width: 18px;
          height: 18px;
        }

        /* Opções (Lembrar-me e Esqueceu Senha) */
        .form-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
          margin-top: -2px;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #9ca3af;
          cursor: pointer;
          user-select: none;
          font-weight: 500;
        }

        .remember-me input {
          width: 16px;
          height: 16px;
          accent-color: #7c3aed;
          cursor: pointer;
          border-radius: 4px;
        }

        .forgot-password {
          color: #a78bfa;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .forgot-password:hover {
          color: #c4b5fd;
          text-decoration: underline;
        }

        /* Botão de Login Gradiente Roxo -> Âmbar */
        .login-button {
          margin-top: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #f59e0b 100%);
          color: #ffffff;
          border: none;
          padding: 14px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.22s ease;
          box-shadow: 0 10px 24px rgba(124, 58, 237, 0.3);
        }

        .button-icon {
          width: 18px;
          height: 18px;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(124, 58, 237, 0.4);
          filter: brightness(1.05);
        }

        .login-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        /* Mensagem de Erro */
        .login-error {
          padding: 12px 14px;
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          font-size: 13px;
          text-align: center;
          font-weight: 500;
        }

        /* Rodapé Institucional */
        .login-footer {
          margin-top: 28px;
          color: #6b7280;
          font-size: 12px;
          text-align: center;
          z-index: 10;
        }

        @media (max-width: 640px) {
          .login-shell {
            padding: 16px;
          }

          .login-card {
            padding: 28px 20px;
            border-radius: 20px;
          }

          .login-title {
            font-size: 22px;
          }

          .form-options {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .forgot-password {
            margin-left: 24px;
          }
        }
      `}</style>
    </div>
  );
}
