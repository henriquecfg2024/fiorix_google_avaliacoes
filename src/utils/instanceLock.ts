import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';
import { connectorEnv } from '../config/env.js';

export class SingleInstanceLock {
  private lockFilePath: string;
  private lockFd: number | null = null;

  constructor(lockDir: string = process.cwd()) {
    this.lockFilePath = path.join(lockDir, `fiorix-connector-${connectorEnv}.lock`);
  }

  public acquire(): boolean {
    try {
      if (fs.existsSync(this.lockFilePath)) {
        const pidContent = fs.readFileSync(this.lockFilePath, 'utf8').trim();
        const existingPid = parseInt(pidContent, 10);

        if (!isNaN(existingPid)) {
          // Check if existing process is actually running
          try {
            process.kill(existingPid, 0); // signal 0 tests process existence
            logger.error(`SINGLE_INSTANCE_ERROR: Já existe uma instância do FIORIX Connector [${connectorEnv}] em execução (PID: ${existingPid}).`);
            return false;
          } catch (e: any) {
            // Process doesn't exist (stale lock file)
            logger.warn(`Stale lock file detectado [${connectorEnv}] (PID: ${existingPid}). Removendo e adquirindo novo lock.`);
            fs.unlinkSync(this.lockFilePath);
          }
        }
      }

      this.lockFd = fs.openSync(this.lockFilePath, 'wx');
      fs.writeFileSync(this.lockFilePath, `${process.pid}`, 'utf8');
      return true;
    } catch (err: any) {
      logger.error(`SINGLE_INSTANCE_ERROR: Falha ao adquirir lock de instância única [${connectorEnv}]: ${err.message}`);
      return false;
    }
  }

  public release(): void {
    try {
      if (this.lockFd !== null) {
        try { fs.closeSync(this.lockFd); } catch {}
        this.lockFd = null;
      }
      if (fs.existsSync(this.lockFilePath)) {
        fs.unlinkSync(this.lockFilePath);
      }
    } catch (err: any) {
      logger.warn(`Falha ao liberar lock file [${connectorEnv}]: ${err.message}`);
    }
  }
}
