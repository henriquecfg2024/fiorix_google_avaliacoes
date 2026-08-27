'use client';

import React from 'react';

export function GoogleAuthButton({ label, className }: { label: string; className?: string }) {
  const handleClick = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <button onClick={handleClick} className={className} style={{
      background: label.includes('Reconectar') ? '#f1f5f9' : '#3b82f6',
      color: label.includes('Reconectar') ? '#475569' : 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      border: label.includes('Reconectar') ? '1px solid #cbd5e1' : 'none',
      cursor: 'pointer'
    }}>
      {label}
    </button>
  );
}
