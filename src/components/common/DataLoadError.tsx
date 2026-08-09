import React from 'react';

export function DataLoadError({ title, message }: { title?: string; message: string }) {
  return (
    <div
      role="alert"
      style={{
        marginTop: '20px',
        padding: '16px 20px',
        background: '#fee2e2',
        border: '1px solid #fecaca',
        borderRadius: '12px',
        color: '#991b1b',
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '6px' }}>
        {title || 'Não foi possível carregar os dados.'}
      </div>
      <div style={{ fontSize: '13px', wordBreak: 'break-word' }}>{message}</div>
      <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
        Atualize a página para tentar novamente. Se o erro persistir, verifique a conexão com o banco de dados.
      </div>
    </div>
  );
}
