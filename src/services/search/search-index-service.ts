import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';

interface DocumentRow {
  id: number;
}

interface TokenCountsByLine {
  lineTokenCounts: Map<number, Map<string, number>>;
  docTokenCounts: Map<string, number>;
  totalTokens: number;
}

export class SearchIndexService {
  private static instances = new Map<string, SearchIndexService>();

  private readonly workspaceRoot: string;
  private readonly workspaceId: string;
  private readonly db: Database.Database;

  private readonly selectDocStmt: Database.Statement;
  private readonly insertDocStmt: Database.Statement;
  private readonly updateDocStmt: Database.Statement;
  private readonly deleteContentStmt: Database.Statement;
  private readonly deletePathStmt: Database.Statement;
  private readonly insertContentStmt: Database.Statement;
  private readonly insertPathStmt: Database.Statement;

  private constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.workspaceId = SearchIndexService.generateWorkspaceId(this.workspaceRoot);
    const storageDir = path.join(os.homedir(), '.echode', 'search');

    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const dbPath = path.join(storageDir, 'search-index.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL,
        path TEXT NOT NULL,
        hash TEXT NOT NULL,
        token_count INTEGER NOT NULL,
        size_bytes INTEGER NOT NULL,
        indexed_at INTEGER NOT NULL,
        UNIQUE(workspace_id, path)
      );

      CREATE INDEX IF NOT EXISTS idx_documents_workspace_path
        ON documents(workspace_id, path);

      CREATE TABLE IF NOT EXISTS content_postings (
        token TEXT NOT NULL,
        doc_id INTEGER NOT NULL,
        line INTEGER NOT NULL,
        tf INTEGER NOT NULL,
        PRIMARY KEY(token, doc_id, line),
        FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_content_token_doc
        ON content_postings(token, doc_id);

      CREATE TABLE IF NOT EXISTS path_postings (
        token TEXT NOT NULL,
        doc_id INTEGER NOT NULL,
        tf INTEGER NOT NULL,
        PRIMARY KEY(token, doc_id),
        FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_path_token_doc
        ON path_postings(token, doc_id);
    `);

    this.selectDocStmt = this.db.prepare(
      'SELECT id FROM documents WHERE workspace_id = ? AND path = ?'
    );
    this.insertDocStmt = this.db.prepare(
      'INSERT INTO documents (workspace_id, path, hash, token_count, size_bytes, indexed_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    this.updateDocStmt = this.db.prepare(
      'UPDATE documents SET hash = ?, token_count = ?, size_bytes = ?, indexed_at = ? WHERE id = ?'
    );
    this.deleteContentStmt = this.db.prepare(
      'DELETE FROM content_postings WHERE doc_id = ?'
    );
    this.deletePathStmt = this.db.prepare(
      'DELETE FROM path_postings WHERE doc_id = ?'
    );
    this.insertContentStmt = this.db.prepare(
      'INSERT INTO content_postings (token, doc_id, line, tf) VALUES (?, ?, ?, ?)'
    );
    this.insertPathStmt = this.db.prepare(
      'INSERT INTO path_postings (token, doc_id, tf) VALUES (?, ?, ?)'
    );
  }

  public static getInstance(workspaceRoot: string): SearchIndexService {
    const normalizedRoot = path.resolve(workspaceRoot);
    const existing = this.instances.get(normalizedRoot);
    if (existing) {
      return existing;
    }

    const created = new SearchIndexService(normalizedRoot);
    this.instances.set(normalizedRoot, created);
    return created;
  }

  public indexDocument(relativePath: string, content: string): void {
    const datetimeNow = Date.now();
    const sizeBytes = Buffer.byteLength(content, 'utf8');
    const hash = this.computeHash(content, sizeBytes);
    const tokens = this.tokenizeContent(content);
    const pathTokens = this.tokenizePath(relativePath);

    const transaction = this.db.transaction(() => {
      const docId = this.upsertDocument(relativePath, hash, tokens.totalTokens, sizeBytes, datetimeNow);

      this.deleteContentStmt.run(docId);
      this.deletePathStmt.run(docId);

      tokens.lineTokenCounts.forEach((tokenCounts, lineNumber) => {
        tokenCounts.forEach((count, token) => {
          this.insertContentStmt.run(token, docId, lineNumber, count);
        });
      });

      pathTokens.forEach((count, token) => {
        this.insertPathStmt.run(token, docId, count);
      });
    });

    transaction();
  }

  public indexPathOnly(relativePath: string): void {
    const datetimeNow = Date.now();
    const pathTokens = this.tokenizePath(relativePath);

    const transaction = this.db.transaction(() => {
      const existing = this.selectDocStmt.get(this.workspaceId, relativePath) as DocumentRow | undefined;
      const existingId = existing?.id ?? null;

      let docId: number;

      if (existingId !== null) {
        // Preserve existing document metadata when only updating path tokens
        this.updateDocStmt.run('', 0, 0, datetimeNow, existingId);
        docId = existingId;
      } else {
        docId = this.upsertDocument(relativePath, '', 0, 0, datetimeNow);
      }

      this.deletePathStmt.run(docId);

      pathTokens.forEach((count, token) => {
        this.insertPathStmt.run(token, docId, count);
      });
    });

    transaction();
  }

  private upsertDocument(
    relativePath: string,
    hash: string,
    tokenCount: number,
    sizeBytes: number,
    indexedAt: number
  ): number {
    const existing = this.selectDocStmt.get(this.workspaceId, relativePath) as DocumentRow | undefined;

    if (existing) {
      this.updateDocStmt.run(hash, tokenCount, sizeBytes, indexedAt, existing.id);
      return existing.id;
    }

    const info = this.insertDocStmt.run(
      this.workspaceId,
      relativePath,
      hash,
      tokenCount,
      sizeBytes,
      indexedAt
    );

    return Number(info.lastInsertRowid);
  }

  private tokenizeContent(content: string): TokenCountsByLine {
    const lineTokenCounts = new Map<number, Map<string, number>>();
    const docTokenCounts = new Map<string, number>();
    let totalTokens = 0;

    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const lineNumber = lineIndex + 1;
      const line = lines[lineIndex];
      const tokens = this.splitTokens(line.toLowerCase());
      if (tokens.length === 0) {
        continue;
      }

      let lineMap = lineTokenCounts.get(lineNumber);
      if (!lineMap) {
        lineMap = new Map<string, number>();
        lineTokenCounts.set(lineNumber, lineMap);
      }

      for (const token of tokens) {
        const previousLine = lineMap.get(token) ?? 0;
        lineMap.set(token, previousLine + 1);

        const previousDoc = docTokenCounts.get(token) ?? 0;
        docTokenCounts.set(token, previousDoc + 1);

        totalTokens += 1;
      }
    }

    return {
      lineTokenCounts,
      docTokenCounts,
      totalTokens,
    };
  }

  private tokenizePath(relativePath: string): Map<string, number> {
    const tokens = new Map<string, number>();
    const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
    const parts = normalized.split(/[\/._-]+/);

    for (const part of parts) {
      if (!part) {
        continue;
      }

      const previous = tokens.get(part) ?? 0;
      tokens.set(part, previous + 1);
    }

    return tokens;
  }

  private splitTokens(text: string): string[] {
    const rawTokens = text.split(/[^a-z0-9]+/i);
    const tokens: string[] = [];

    for (const raw of rawTokens) {
      if (raw.length === 0) {
        continue;
      }
      tokens.push(raw);
    }

    return tokens;
  }

  private computeHash(content: string, sizeBytes: number): string {
    let hash = 0;

    for (let index = 0; index < content.length; index += 1) {
      const charCode = content.charCodeAt(index);
      hash = (hash << 5) - hash + charCode;
      hash |= 0;
    }

    const normalizedHash = Math.abs(hash).toString(36);
    return `${sizeBytes}:${normalizedHash}`;
  }

  private static generateWorkspaceId(workspaceRoot: string): string {
    let hash = 0;

    for (let index = 0; index < workspaceRoot.length; index += 1) {
      const charCode = workspaceRoot.charCodeAt(index);
      hash = (hash << 5) - hash + charCode;
      hash |= 0;
    }

    return `ws_${Math.abs(hash).toString(36)}`;
  }
}
