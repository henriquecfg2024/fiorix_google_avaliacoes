import React from 'react';

export function InsightCard() {
  return (
    <div className="insight-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="insight-header">
        <span className="insight-icon">🤖</span>
        <span className="insight-label">INSIGHTS DA IA</span>
      </div>
      
      <div className="insight-text" style={{ fontSize: '13.5px', lineHeight: '1.6', marginBottom: '4px', background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
        📢 <strong>Alerta de Atendimento:</strong> As <strong>reclamações sobre tempo de espera na fila</strong> subiram <strong style={{ color: '#ef4444', fontWeight: '700' }}>+40%</strong> este mês. Recomendamos otimizar a triagem inicial na recepção.
      </div>
      
      <div className="insight-list" style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
        <div className="insight-item">
          <div className="dot" style={{ background: '#10b981' }}></div>
          <span>👏 <strong>Elogio em Destaque:</strong> O escrevente <strong>Lucas</strong> foi citado com <strong>elogios em 47 avaliações positivas</strong> este mês.</span>
        </div>

        <div className="insight-item">
          <div className="dot" style={{ background: '#f59e0b' }}></div>
          <span>📅 <strong>Padrão Semanal:</strong> As notas dadas pelos clientes às <strong>segundas-feiras</strong> são em média <strong>0,4★ menores</strong> que nos outros dias.</span>
        </div>

        <div className="insight-item">
          <div className="dot" style={{ background: '#ef4444' }}></div>
          <span>⚠️ <strong>Motivo de Insatisfação:</strong> Reclamações sobre o <strong>sistema de agendamento online</strong> foram a causa apontada em <strong>70% das avaliações de 3★</strong>.</span>
        </div>

        <div className="insight-item">
          <div className="dot" style={{ background: '#3b82f6' }}></div>
          <span>💡 <strong>Impacto do SLA de Resposta:</strong> Respostas enviadas aos clientes em menos de 24 horas elevam a satisfação percebida em <strong>+35%</strong>.</span>
        </div>
      </div>
    </div>
  );
}
