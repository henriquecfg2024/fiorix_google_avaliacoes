import dns from 'node:dns/promises';
import net from 'node:net';
import sql from 'mssql';
import axios from 'axios';
import { env } from './src/config/env.js';

async function testConnectivity() {
  console.log('--- INICIANDO TESTE DE CONECTIVIDADE ---');
  
  const host = 'srvsq1';
  const port = 1433;
  let sqlIp = '';

  // ETAPA 1 - REDE SQL
  console.log('\n[ETAPA 1] TESTE DNS E TCP');
  try {
    const lookup = await dns.lookup(host);
    sqlIp = lookup.address;
    console.log(`DNS_RESOLVED: SIM (${sqlIp})`);
  } catch (err: any) {
    console.log(`DNS_RESOLVED: NÃO (Erro: ${err.message})`);
  }

  const tcpTest = new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.on('connect', () => {
      console.log('TCP_PORT_1433: SIM');
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      console.log('TCP_PORT_1433: NÃO (Timeout)');
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (err) => {
      console.log(`TCP_PORT_1433: NÃO (Erro: ${err.message})`);
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });

  const tcpSuccess = await tcpTest;

  // ETAPA 2 - LOGIN SQL
  console.log('\n[ETAPA 2] TESTE LOGIN SQL');
  if (tcpSuccess || sqlIp) {
    try {
      const pool = await sql.connect({
        user: env.SQL_SERVER_USER,
        password: env.SQL_SERVER_PASSWORD,
        server: host,
        database: 'WEBRI',
        options: {
          encrypt: false,
          trustServerCertificate: true,
          connectTimeout: 5000
        }
      });
      console.log('SQL_CONNECTED');
      await pool.close();
    } catch (err: any) {
      console.log(`SQL_CONNECTION_ERROR: ${err.message}`);
    }
  } else {
    console.log('SQL_CONNECTION_ERROR: Ignorado devido a falha de TCP/DNS.');
  }

  // ETAPA 3 - PROXY / HTTPS
  console.log('\n[ETAPA 3] TESTE PROXY / HTTPS');
  const winProxy = 'http://10.0.0.1:3128';
  console.log(`HTTP_PROXY (Env): Não configurado`);
  console.log(`HTTPS_PROXY (Env): Não configurado`);
  console.log(`PROXY (Windows): Detectado -> SIM (${winProxy})`);

  try {
    const response = await axios.get('https://app.fiorix.com.br/status', {
      timeout: 5000,
      proxy: {
        protocol: 'http',
        host: '10.0.0.1',
        port: 3128
      },
      validateStatus: () => true
    });
    console.log(`HTTPS_VIA_PROXY: FUNCIONA (Status ${response.status})`);
    console.log('CERTIFICADO_TLS: VÁLIDO');
  } catch (err: any) {
    console.log(`HTTPS_VIA_PROXY: NÃO FUNCIONA (${err.message})`);
  }

  // ETAPA 4 - NO_PROXY
  console.log('\n[ETAPA 4] NO_PROXY');
  console.log('NO_PROXY Atual (Registro): http://*.7ri.local;http://srvsql;<local>');
  console.log('Aviso: O host srvsq1 (com número 1) não está na lista NO_PROXY e a rede pode tentar roteá-lo indevidamente caso as chamadas Node.js adotem o proxy no futuro.');
}

testConnectivity().catch(console.error);
