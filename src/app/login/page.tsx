'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <div className="login-glow login-glow-left" />
      <div className="login-glow login-glow-right" />

      <div className="login-card">
        <div className="login-topline">
          <ShieldCheck className="topline-icon" />
          <span>Acesso seguro ao painel do cartório</span>
        </div>

        <div className="login-header">
          <div className="login-logo">
            <div className="logo-icon">F</div>
            <span className="logo-text">FIORIX</span>
          </div>
          <h1 className="login-title">Bem-vindo de volta</h1>
          <p className="login-subtitle">Faça login para acessar o painel do seu cartório.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <div className="input-wrap">
              <Mail className="input-icon" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
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
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
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
            <LogIn className="button-icon" />
            <span>{isLoading ? 'Entrando...' : 'Entrar no Painel'}</span>
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 32%),
            radial-gradient(circle at bottom right, rgba(139, 92, 246, 0.14), transparent 34%),
            linear-gradient(135deg, #eff6ff 0%, #ecfeff 45%, #dbeafe 100%);
          padding: 24px;
        }

        .login-glow {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 999px;
          filter: blur(72px);
          opacity: 0.28;
          pointer-events: none;
        }

        .login-glow-left {
          left: -120px;
          top: -80px;
          background: #60a5fa;
        }

        .login-glow-right {
          right: -140px;
          bottom: -100px;
          background: #8b5cf6;
        }

        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 448px;
          padding: 32px;
          border-radius: 28px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0.78));
          border: 1px solid rgba(255, 255, 255, 0.72);
          box-shadow:
            0 24px 70px rgba(15, 23, 42, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .login-topline {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 22px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.14);
          color: #335c9f;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .topline-icon {
          width: 14px;
          height: 14px;
          color: #3b82f6;
        }

        .login-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .login-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 18px;
        }

        .logo-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          color: white;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 22px;
          box-shadow: 0 10px 24px rgba(59, 130, 246, 0.24);
        }

        .logo-text {
          font-size: 28px;
          font-weight: 900;
          background: linear-gradient(135deg, #1e293b 0%, #3b82f6 65%, #6366f1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.04em;
        }

        .login-title {
          font-size: 34px;
          line-height: 1.05;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 10px;
          letter-spacing: -0.04em;
        }

        .login-subtitle {
          font-size: 15px;
          color: #64748b;
          line-height: 1.5;
        }

        .login-form {
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
          font-weight: 700;
          color: #334155;
        }

        .input-wrap {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 17px;
          height: 17px;
          color: #94a3b8;
          pointer-events: none;
          transition: color 0.2s ease;
        }

        .form-group input {
          width: 100%;
          padding: 13px 16px 13px 44px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.26);
          background: rgba(255, 255, 255, 0.88);
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
          font-size: 15px;
          color: #0f172a;
          caret-color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
        }

        .form-group input::placeholder {
          color: #94a3b8;
        }

        .form-group input:hover {
          border-color: rgba(96, 165, 250, 0.4);
        }

        .form-group input:focus {
          border-color: #3b82f6;
          box-shadow:
            0 0 0 4px rgba(59, 130, 246, 0.12),
            inset 0 1px 2px rgba(15, 23, 42, 0.02);
          background: rgba(255, 255, 255, 0.96);
        }

        .form-group input:focus + .input-icon {
          color: #3b82f6;
        }

        .input-wrap:focus-within .input-icon {
          color: #3b82f6;
        }

        .form-group input:-webkit-autofill,
        .form-group input:-webkit-autofill:hover,
        .form-group input:-webkit-autofill:focus,
        .form-group input:-webkit-autofill:active {
          -webkit-text-fill-color: #0f172a;
          -webkit-box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.94) inset;
          box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.94) inset;
          transition: background-color 9999s ease-in-out 0s;
        }

        .form-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          cursor: pointer;
          user-select: none;
          font-weight: 500;
        }

        .remember-me input {
          width: 16px;
          height: 16px;
          accent-color: #3b82f6;
          cursor: pointer;
        }

        .forgot-password {
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .forgot-password:hover {
          text-decoration: underline;
          color: #1d4ed8;
        }

        .login-button {
          margin-top: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          color: white;
          border: none;
          padding: 15px;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.22s ease;
          box-shadow: 0 10px 26px rgba(79, 70, 229, 0.24);
        }

        .button-icon {
          width: 18px;
          height: 18px;
        }

        .login-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(79, 70, 229, 0.28);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .login-error {
          padding: 12px 14px;
          background: rgba(254, 226, 226, 0.88);
          color: #dc2626;
          border: 1px solid rgba(248, 113, 113, 0.28);
          border-radius: 12px;
          font-size: 14px;
          text-align: center;
          font-weight: 600;
        }

        @media (max-width: 640px) {
          .login-shell {
            padding: 16px;
          }

          .login-card {
            padding: 24px 20px;
            border-radius: 22px;
          }

          .login-title {
            font-size: 28px;
          }

          .logo-text {
            font-size: 24px;
          }

          .form-options {
            flex-direction: column;
            align-items: flex-start;
          }

          .forgot-password {
            margin-left: 24px;
          }
        }
      `}</style>
    </div>
  );
}
