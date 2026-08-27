const rawRows = [
  { '\uFEFFProtocolo': '12345', 'FlagRecepcao': '1', 'IsRegistrado': '1' },
  { 'Protocolo': '12346', 'FlagRecepcao': '1', 'IsRegistrado': '0' },
  { '\uFEFFProtocolo': 'Protocolo', 'FlagRecepcao': 'Flag', 'IsRegistrado': 'IsRegistrado' } // header duplicate
];

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
      FlagRecepcao: getInt(getVal('FlagRecepcao')),
      IsRegistrado: getBool(getVal('IsRegistrado')),
    };
  })
  .filter((r) => r.Protocolo && r.Protocolo !== '0' && r.Protocolo.toLowerCase() !== 'protocolo');

console.log('dbRows:', dbRows);
