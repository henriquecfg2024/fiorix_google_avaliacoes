# FIORIX Connector (Local Agent)

Agente local responsável pela extração segura (somente leitura) do banco SQL Server do cliente e transmissão ao FIORIX SaaS. Opera de forma 100% isolada e idempotente, sem exigir portas abertas no cliente.

## 🏗 Arquitetura e Segurança
- **Node.js** operando via daemon local / Windows Service.
- **SQLite (`node:sqlite`)**: Mecanismo de fila persistente em disco para retries em caso de queda de internet, isolado por ambiente (`queue.db` para homologação, `queue_production.db` para produção).
- **MSSQL**: Driver somente leitura para rodar as procedures de extração.
- **Axios**: Cliente HTTPS disparando pacotes assinados em JSON para o SaaS.
- **Scheduler Interno**: Ciclos com offsets inteligentes (BI=0s, Metas=10s, Prod=20s, Tarefas=40s).
- **Trilha de Logs Segura**: Arquivos diários `logs/connector-[env]-YYYY-MM-DD.log` com mascaramento automático de credenciais.

---

## 🧭 Seleção de Ambientes (HOMOLOGAÇÃO vs PRODUÇÃO)

O Connector suporta dois modos de operação completamente segregados:

| Ambiente | Variável | Arquivo `.env` | Banco SQLite | Lock File |
| :--- | :--- | :--- | :--- | :--- |
| **Homologação** (Default) | `FIORIX_CONNECTOR_ENV=homolog` | `.env.homolog` ou `.env` | `queue.db` | `fiorix-connector-homolog.lock` |
| **Produção** | `FIORIX_CONNECTOR_ENV=production` | `.env.production` | `queue_production.db` | `fiorix-connector-production.lock` |

> 🛡️ **Fail-Safe**: Se a variável não for informada, o sistema assume automaticamente `homolog`.

---

## 📋 Arquivos de Configuração

1. **Homologação (`.env.homolog`)**: Já configurado com o ambiente de testes/NEON.
2. **Produção (`.env.production`)**: Template com os campos necessários para o apontamento oficial do FIORIX.
3. **Template Base (`.env.example`)**: Exemplo documentado de todas as variáveis suportadas.

---

## ▶️ Como Executar Manualmente

### Modo Homologação:
```powershell
npm run start:homolog
# ou
$env:FIORIX_CONNECTOR_ENV="homolog"; node dist/index.js
```

### Modo Produção:
```powershell
$env:FIORIX_CONNECTOR_ENV="production"; node dist/index.js
# ou
npm run start:production
```

---

## ⚙️ Configuração como Serviço do Windows (NSSM)

Para configurar o serviço do Windows com seleção explícita de ambiente via NSSM:

### 1. Instalar / Atualizar o Serviço:
```powershell
# Exemplo com NSSM definindo a variável de ambiente:
.\tools\nssm\nssm.exe set FiorixConnector AppDirectory "C:\FiorixConnector"
.\tools\nssm\nssm.exe set FiorixConnector Application "C:\Program Files\nodejs\node.exe"
.\tools\nssm\nssm.exe set FiorixConnector AppParameters "dist\index.js"

# Para definir o ambiente de Produção:
.\tools\nssm\nssm.exe set FiorixConnector AppEnvironmentExtra FIORIX_CONNECTOR_ENV=production

# Para definir o ambiente de Homologação:
.\tools\nssm\nssm.exe set FiorixConnector AppEnvironmentExtra FIORIX_CONNECTOR_ENV=homolog
```

### 2. Reiniciar o Serviço:
```powershell
Restart-Service -Name FiorixConnector
```

---

## 🔍 Logs e Troubleshooting
Todos os logs diários são gravados com isolamento de ambiente:
- `logs/connector-homolog-YYYY-MM-DD.log`
- `logs/connector-production-YYYY-MM-DD.log`

- **Verificação de Inicialização:** Ao subir, o serviço imprime um banner de inicialização limpo:
  ```text
  [FIORIX Connector] Environment: PRODUCTION | (Shadow Mode: false)
  [FIORIX Connector] Target Host: https://fiorix-omega.vercel.app/api/v1/connector/sync
  [FIORIX Connector] Source DB: srvsql\WEBRI
  [FIORIX Connector] Storage: queue_production.db
  ```
- **Problema de Conectividade:** A tag `NETWORK_OFFLINE` é registrada e o lote aguarda na fila SQLite correspondente.
