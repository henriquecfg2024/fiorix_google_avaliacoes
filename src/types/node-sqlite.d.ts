declare module 'node:sqlite' {
  export interface StatementSync {
    run(...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: any[]): any;
    all(...params: any[]): any[];
  }

  export class DatabaseSync {
    constructor(location: string, options?: Record<string, any>);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
