import React from 'react';

interface KpiRowProps {
  notaMedia: number;
  totalAvaliacoes: number;
  pendentes: number;
  respondidasHoje: number;
  isDemo?: boolean;
}

export function KpiRow({ notaMedia, totalAvaliacoes, pendentes, respondidasHoje, isDemo }: KpiRowProps) {
  return (
    <div className="kpi-row">
      <div className="kpi-card blue">
        <div className="kpi-label">Nota Média</div>
        <div className="kpi-value blue">{notaMedia.toFixed(1).replace('.', ',')}</div>
        <div className="kpi-trend green">↑ 0,1 vs mês anterior</div>
      </div>
      <div className="kpi-card green">
        <div className="kpi-label">Total de Avaliações</div>
        <div className="kpi-value green">{totalAvaliacoes}</div>
        <div className="kpi-delta up">↑ +23 este mês</div>
      </div>
      <div className="kpi-card purple">
        <div className="kpi-label">Pendentes de Resposta</div>
        <div className="kpi-value purple">{pendentes}</div>
        <div className="kpi-delta down">↓ 3 vs ontem</div>
      </div>
      <div className="kpi-card orange">
        <div className="kpi-label">Respondidas Hoje</div>
        <div className="kpi-value orange">{respondidasHoje}</div>
        <div className="kpi-delta neutral">→ 8 automáticas</div>
      </div>
    </div>
  );
}
