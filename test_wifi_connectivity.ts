import dns from 'node:dns/promises';
import axios from 'axios';

async function testWifiConnectivity() {
  console.log('--- INICIANDO TESTE HTTPS (WI-FI) ---');
  
  const host = 'app.fiorix.com.br';
  let resolvedIp = '';
  let dnsSuccess = false;

  console.log('\n[DNS EXTERNO]');
  try {
    const lookup = await dns.lookup(host);
    resolvedIp = lookup.address;
    dnsSuccess = true;
    console.log(`DNS_RESOLVED: SIM`);
    console.log(`IP_RESOLVIDO: ${resolvedIp}`);
  } catch (err: any) {
    console.log(`DNS_RESOLVED: NÃO`);
    console.log(`ERRO: ${err.message}`);
  }

  console.log('\n[HTTPS DIRETO]');
  try {
    // Acesso direto, forçando sem proxy
    const response = await axios.get(`https://${host}/status`, {
      timeout: 5000,
      proxy: false, // Explicitamente desativa o proxy no Axios
      validateStatus: () => true
    });
    console.log(`HTTPS_DIRETO_FUNCIONA: SIM`);
    console.log(`STATUS_HTTP: ${response.status}`);
    console.log(`CERTIFICADO_TLS: VÁLIDO`);
  } catch (err: any) {
    console.log(`HTTPS_DIRETO_FUNCIONA: NÃO`);
    console.log(`ERRO: ${err.message}`);
  }
}

testWifiConnectivity().catch(console.error);
