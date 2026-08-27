'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Avaliacoes error:', error);
  }, [error]);

  return (
    <div style={{ padding: '20px', margin: '20px', background: '#fee2e2', borderRadius: '8px', color: '#991b1b' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Algo deu errado!</h2>
      <p style={{ marginTop: '10px' }}>{error.message || JSON.stringify(error)}</p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: '15px',
          padding: '8px 16px',
          background: '#dc2626',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
