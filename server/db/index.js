import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;
let dbPath = null;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function initDatabase() {
  // Initialize SQL.js
  const SQL = await initSqlJs();
  
  // Ensure data directory exists
  dbPath = config.database.url;
  const dbDir = dirname(dbPath);
  
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Load existing database or create new one
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Run schema
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.run(schema);

  // Save to disk
  saveDatabase();

  console.log(`[DB] Connected to ${dbPath}`);
  return db;
}

export function saveDatabase() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }
}

export function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

// Wrapper class to provide better-sqlite3-like API
class PreparedStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
  }

  get(params = []) {
    try {
      const stmt = this.database.prepare(this.sql);
      stmt.bind(Array.isArray(params) ? params : [params]);
      if (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    } catch (e) {
      console.error('[DB] get error:', e.message);
      return undefined;
    }
  }

  all(...params) {
    try {
      const flatParams = params.flat();
      const results = [];
      const stmt = this.database.prepare(this.sql);
      if (flatParams.length > 0) {
        stmt.bind(flatParams);
      }
      while (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        results.push(row);
      }
      stmt.free();
      return results;
    } catch (e) {
      console.error('[DB] all error:', e.message);
      return [];
    }
  }

  run(...params) {
    try {
      const flatParams = params.flat();
      this.database.run(this.sql, flatParams);
      saveDatabase();
      return {
        changes: this.database.getRowsModified(),
        lastInsertRowid: 0, // sql.js doesn't provide this easily
      };
    } catch (e) {
      console.error('[DB] run error:', e.message, 'SQL:', this.sql);
      return { changes: 0, lastInsertRowid: 0 };
    }
  }
}

// Database wrapper to provide better-sqlite3-like API
export const dbWrapper = {
  prepare(sql) {
    return new PreparedStatement(db, sql);
  },

  exec(sql) {
    db.run(sql);
    saveDatabase();
  },

  pragma(setting) {
    // sql.js doesn't support all pragmas, just log
    console.log(`[DB] pragma: ${setting}`);
  },
};

// Helper functions for common operations
export const dbHelpers = {
  // Get single row by ID
  getById(table, id) {
    return dbWrapper.prepare(`SELECT * FROM ${table} WHERE id = ?`).get([id]);
  },

  // Get all rows from table
  getAll(table, limit = 100, offset = 0) {
    return dbWrapper.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
  },

  // Insert row and return it
  insert(table, data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    dbWrapper.prepare(sql).run(...Object.values(data));
    return data;
  },

  // Update row by ID
  update(table, id, data) {
    const keys = Object.keys(data);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const sql = `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    dbWrapper.prepare(sql).run(...Object.values(data), id);
    return { id, ...data };
  },

  // Delete row by ID
  delete(table, id) {
    return dbWrapper.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  },

  // Run custom query
  query(sql, params = []) {
    return dbWrapper.prepare(sql).all(...params);
  },

  // Run custom statement (INSERT/UPDATE/DELETE)
  run(sql, params = []) {
    return dbWrapper.prepare(sql).run(...params);
  },
};

// Override getDb to return the wrapper
const originalGetDb = getDb;
export { dbWrapper as getDbWrapper };

// Export a getDb that returns the wrapper with prepare method
export function getDbWithPrepare() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbWrapper;
}

// Replace the default getDb export
export default { 
  getDb: getDbWithPrepare, 
  initDatabase, 
  closeDatabase, 
  dbHelpers,
  saveDatabase,
};
