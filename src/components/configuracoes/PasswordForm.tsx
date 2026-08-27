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
              ? 'border-red-500/25 bg-red-500/10 text-red-200'
              : 'border-emerald-500/25 bg-emerald-500/10 text-[#10d9a0]'
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-white/70">Senha Atual *</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white/70">Nova Senha *</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          placeholder="No mínimo 6 caracteres"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-[#3b82f6] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? 'Salvando...' : 'Salvar Nova Senha'}
      </button>
    </form>
  );
}
