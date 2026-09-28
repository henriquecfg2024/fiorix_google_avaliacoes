'use client';

import React, { useState } from 'react';
import { updatePassword } from '@/app/actions/auth';

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('currentPassword', currentPassword);
    formData.append('newPassword', newPassword);

    try {
      const res = await updatePassword(formData);
      if (res?.error) {
        setMessage({ type: 'error', text: res.error });
      } else {
        setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao alterar a senha.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
    >
      {message && (
        <div
          className={`md:col-span-3 rounded-xl border px-4 py-3 text-sm font-medium ${
            message.type === 'error'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">Senha Atual *</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">Nova Senha *</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          placeholder="No mínimo 6 caracteres"
          className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-all shadow-md shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Salvando...' : 'Salvar Nova Senha'}
      </button>
    </form>
  );
}
