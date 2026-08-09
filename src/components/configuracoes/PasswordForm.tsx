'use client';

import React, { useState } from 'react';
import { updatePassword } from '@/app/actions/auth';
import { logError } from '@/lib/errors';

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
    } catch (err) {
      logError('passwordForm:updatePassword', err);
      setMessage({ type: 'error', text: 'Erro ao alterar a senha. Tente novamente em instantes.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
      {message && (
        <div style={{
          gridColumn: '1 / -1',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '500',
          background: message.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: message.type === 'error' ? '#991b1b' : '#166534',
        }}>
          {message.text}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
          Senha Atual *
        </label>
        <input 
          type="password" 
          value={currentPassword} 
          onChange={(e) => setCurrentPassword(e.target.value)} 
          required 
          placeholder="••••••••"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '14px',
            outline: 'none'
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
          Nova Senha *
        </label>
        <input 
          type="password" 
          value={newPassword} 
          onChange={(e) => setNewPassword(e.target.value)} 
          required 
          placeholder="No mínimo 6 caracteres"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '14px',
            outline: 'none'
          }}
        />
      </div>

      <button 
        type="submit"
        disabled={loading}
        style={{
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          padding: '9px 18px',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: '14px',
          cursor: loading ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? 'Salvando...' : 'Salvar Nova Senha'}
      </button>
    </form>
  );
}
