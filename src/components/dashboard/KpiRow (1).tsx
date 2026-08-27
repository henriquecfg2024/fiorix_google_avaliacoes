import React from 'react';

export function KpiRow() {
  return (
    <div className="kpi-row">
      <div className="kpi-card blue">
        <div className="kpi-label">Nota Média</div>
        <div className="kpi-value blue">4,4</div>
        <div className="kpi-delta up">↑ 0,1 vs mês anterior</div>
      </div>
      <div className="kpi-card green">
        <div className="kpi-label">Total de Avaliações</div>
        <div className="kpi-value green">536</div>
        <div className="kpi-delta up">↑ +23 este mês</div>
      </div>
      <div className="kpi-card purple">
        <div className="kpi-label">Pendentes de Resposta</div>
        <div className="kpi-value purple">7</div>
        <div className="kpi-delta down">↑ 3 vs ontem</div>
      </div>
      <div className="kpi-card amber">
        <div className="kpi-label">Respondidas Hoje</div>
        <div className="kpi-value amber">12</div>
        <div className="kpi-delta neutral">→ 8 automáticas</div>
      </div>
    </div>
  );
}
