const Papa = require('papaparse');
const fs = require('fs');

const csv = `"Protocolo";"FlagRecepcao";"TipoSolicitacao";"IdAndamento";"DtProtocolo";"DtPrevisaoEntrega";"DtAndamento";"DataProtocolo";"CodProcessamento";"DescAndamento";"Natureza";"TipoPrenotacao";"DiasPrometidos";"DiasCorridos";"DiasAtraso";"SituacaoPrazo";"IsDevolucao";"IsRegistrado";"TextoNotaDevolucao"
"391484";"1";"Prenotação";"3759328";"2026-08-05 08:35:59.207";"2026-08-05 08:35:59.207";"2026-08-05 10:46:17.073";"2026-08-05";"2";"Distribuido(a)";"Penhora";"Prenotação";"0";"0";"0";"No Prazo";"0";"0";"NULL"`;

// Prepend BOM
const csvWithBom = '\uFEFF' + csv;

Papa.parse(csvWithBom, {
  header: true,
  delimiter: ';',
  skipEmptyLines: true,
  encoding: 'UTF-8',
  quoteChar: '"',
  escapeChar: '"',
  complete: function(results) {
    console.log('Results data length:', results.data.length);
    console.log('First row keys:', Object.keys(results.data[0]));
    console.log('First row value of Protocolo:', results.data[0]['Protocolo']);
    console.log('First row value of first key:', results.data[0][Object.keys(results.data[0])[0]]);

    const rawRows = results.data;
    const dbRows = rawRows
      .filter((row) => row && (row.Protocolo || row[Object.keys(row)[0]]))
      .map((row) => {
        const getVal = (col) => {
          if (row[col] !== undefined && row[col] !== null) return String(row[col]).trim();
          const key = Object.keys(row).find(
            (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === col.toLowerCase().replace(/[^a-z0-9]/g, '')
          );
          return key ? String(row[key]).trim() : '';
        };

        const getInt = (val) => {
          if (!val) return null;
          const p = parseInt(val.replace(/\D/g, ''), 10);
          return isNaN(p) ? null : p;
        };

        const getBool = (val) => {
          const lower = val.toLowerCase();
          return lower === '1' || lower === 'true' || lower === 'sim';
        };

        return {
          Protocolo: getVal('Protocolo'),
          IdAndamento: getVal('IdAndamento'),
          FlagRecepcao: getInt(getVal('FlagRecepcao')),
        };
      })
      .filter((r) => r.Protocolo && r.Protocolo !== '0' && r.Protocolo.toLowerCase() !== 'protocolo');

    console.log('Final dbRows:', dbRows);
  }
});
