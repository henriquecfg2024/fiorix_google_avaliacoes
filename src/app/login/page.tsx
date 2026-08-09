'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNextControlFlowError, logError } from '@/lib/errors';

export default function LoginPage() {
  const router = useRouter();
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
      // In Next.js Server Actions with NextAuth, signIn handles the redirect.
      // We need to import our authenticate action. Let's use it.
      const { authenticate } = await import('@/app/actions/auth');
      const errorMessage = await authenticate(undefined, formData);
      if (errorMessage) {
        setError(errorMessage);
      }
    } catch (err) {
      // `signIn` redirects by throwing; turning that into an error message
      // would block the navigation to the dashboard.
      if (isNextControlFlowError(err)) throw err;
      logError('login:authenticate', err);
      setError('Ocorreu um erro ao tentar fazer login.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
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

          <div className="form-group">
            <label htmlFor="password">Senha</label>
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
            {isLoading ? 'Entrando...' : 'Entrar no Painel'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%);
          padding: 20px;
        }

        .login-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
        }

        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .login-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .logo-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          color: white;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 20px;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
        }

        .logo-text {
          font-size: 24px;
          font-weight: 800;
          background: linear-gradient(135deg, #1e293b 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.5px;
        }

        .login-title {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
        }

        .login-subtitle {
          font-size: 14px;
          color: #64748b;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }

        .form-group input {
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(255, 255, 255, 0.8);
          font-size: 15px;
          outline: none;
          transition: all 0.2s;
        }

        .form-group input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          cursor: pointer;
          user-select: none;
        }

        .remember-me input {
          width: 16px;
          height: 16px;
          accent-color: #3b82f6;
          cursor: pointer;
        }

        .forgot-password {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .forgot-password:hover {
          text-decoration: underline;
          color: #2563eb;
        }

        .login-button {
          margin-top: 5px;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          color: white;
          border: none;
          padding: 14px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }

        .login-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .login-error {
          padding: 12px;
          background: #fee2e2;
          color: #ef4444;
          border-radius: 10px;
          font-size: 14px;
          text-align: center;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

