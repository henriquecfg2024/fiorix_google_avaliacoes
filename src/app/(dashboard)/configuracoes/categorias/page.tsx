'use client';

export default function CategoriasConfigPage() {
  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr' }}>
      <div className="center-col">
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title">Categorias Operacionais</div>
            <div className="chart-sub">Gerencie as categorias de saúde operacional (ex: Fila, Site, Pagamento).</div>
          </div>
          
          <div style={{ marginTop: '20px' }}>
            <button className="period-tab active" style={{ marginBottom: '16px' }}>+ Nova Categoria</button>
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Nenhuma categoria cadastrada.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
