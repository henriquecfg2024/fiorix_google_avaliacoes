import axios from 'axios';
import http from 'http';
import https from 'https';

async function testProxyAuth() {
  console.log('--- INICIANDO DIAGNÓSTICO DO PROXY ---');
  
  let proxyAccessible = 'NÃO';
  let httpStatus = 'Desconhecido';
  let proxyAuthenticate = 'Não recebido';
  let authMethod = 'Indeterminado';
  let winIntegrated = 'NÃO';

  try {
    const response = await axios.get('https://app.fiorix.com.br', {
      timeout: 5000,
      proxy: {
        protocol: 'http',
        host: '10.0.0.1',
        port: 3128
      },
      validateStatus: () => true
    });

    proxyAccessible = 'SIM';
    httpStatus = response.status.toString();
    
    // axios retorna headers em lowercase
    const authHeader = response.headers['proxy-authenticate'];
    
    if (authHeader) {
      proxyAuthenticate = Array.isArray(authHeader) ? authHeader.join(', ') : authHeader;
      
      const headerUpper = proxyAuthenticate.toUpperCase();
      
      if (headerUpper.includes('NTLM') && headerUpper.includes('NEGOTIATE')) {
        authMethod = 'Negotiate / NTLM';
        winIntegrated = 'SIM';
      } else if (headerUpper.includes('NEGOTIATE')) {
        authMethod = 'Negotiate (Kerberos/NTLM)';
        winIntegrated = 'SIM';
      } else if (headerUpper.includes('NTLM')) {
        authMethod = 'NTLM';
        winIntegrated = 'SIM';
      } else if (headerUpper.includes('BASIC')) {
        authMethod = 'Basic';
      } else if (headerUpper.includes('DIGEST')) {
        authMethod = 'Digest';
      } else {
        authMethod = 'Outro: ' + proxyAuthenticate;
      }
    } else {
      proxyAuthenticate = 'Ausente';
      if (httpStatus !== '407') {
        authMethod = 'Nenhuma (ou passou direto)';
      }
    }

  } catch (err: any) {
    if (err.response) {
      proxyAccessible = 'SIM';
      httpStatus = err.response.status.toString();
      
      const authHeader = err.response.headers['proxy-authenticate'];
      if (authHeader) {
        proxyAuthenticate = Array.isArray(authHeader) ? authHeader.join(', ') : authHeader;
        const headerUpper = proxyAuthenticate.toUpperCase();
        if (headerUpper.includes('NTLM') && headerUpper.includes('NEGOTIATE')) {
          authMethod = 'Negotiate / NTLM';
          winIntegrated = 'SIM';
        } else if (headerUpper.includes('NEGOTIATE')) {
          authMethod = 'Negotiate (Kerberos/NTLM)';
          winIntegrated = 'SIM';
        } else if (headerUpper.includes('NTLM')) {
          authMethod = 'NTLM';
          winIntegrated = 'SIM';
        } else if (headerUpper.includes('BASIC')) {
          authMethod = 'Basic';
        } else if (headerUpper.includes('DIGEST')) {
          authMethod = 'Digest';
        } else {
          authMethod = 'Outro: ' + proxyAuthenticate;
        }
      }
    } else {
      proxyAccessible = `FALHA (${err.message})`;
    }
  }

  console.log('\n--- RESULTADO DA ENTREGA ---');
  console.log(`PROXY_ACESSIVEL: ${proxyAccessible}`);
  console.log(`HTTP_STATUS: ${httpStatus}`);
  console.log(`PROXY_AUTHENTICATE: ${proxyAuthenticate}`);
  console.log(`METODO_DE_AUTENTICACAO: ${authMethod}`);
  console.log(`AUTENTICACAO_WINDOWS_INTEGRADA_POSSIVEL: ${winIntegrated}`);
  console.log(`CREDENCIAIS_UTILIZADAS: NÃO`);
  console.log(`ALTERACOES_REALIZADAS: NENHUMA`);
  console.log(`PRODUCAO_ALTERADA: NÃO`);
}

testProxyAuth().catch(console.error);
