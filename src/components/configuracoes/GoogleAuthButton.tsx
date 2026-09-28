'use client';

import React from 'react';

export function GoogleAuthButton({ label, className }: { label: string; className?: string }) {
  const handleClick = () => {
    window.location.href = '/api/auth/google';
  };

  const isReconnect = label.includes('Reconectar');

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className || `rounded-xl px-4 py-2 text-sm font-semibold transition-all inline-flex items-center gap-2 ${
        isReconnect
          ? 'border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] text-white'
          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
      }`}
    >
      {label}
    </button>
  );
}
