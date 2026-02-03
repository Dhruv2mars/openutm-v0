import sqlite3 from 'sqlite3';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

interface VMConfigData {
  id: string;
  name: string;
  memory: number;
  cores: number;
  disk: string;
  qmpSocket?: string;
  accelerator?: string;
  createdAt: number;
  updatedAt: number;
}

const CONFIG_DIR = path.join(process.env.HOME || '/tmp', '.openutm');
const DB_PATH = path.join(CONFIG_DIR, 'config.db');

let db: sqlite3.Database | null = null;

function initializeDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db!.exec(`
        CREATE TABLE IF NOT EXISTS vms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          memory INTEGER NOT NULL,
          cores INTEGER NOT NULL,
          disk TEXT NOT NULL,
          qmp_socket TEXT,
          accelerator TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else resolve(db!);
      });
    });
  });
}

function runAsync(stmt: sqlite3.Statement, params: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    stmt.run(params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getAsync(stmt: sqlite3.Statement, params: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    stmt.get(params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(stmt: sqlite3.Statement, params: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    stmt.all(params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

export async function createVMConfig(config: Omit<VMConfigData, 'createdAt' | 'updatedAt'>): Promise<VMConfigData> {
  try {
    const database = await initializeDatabase();
    const now = Date.now();

    const stmt = database.prepare(`
      INSERT INTO vms (id, name, memory, cores, disk, qmp_socket, accelerator, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await runAsync(stmt, [
      config.id,
      config.name,
      config.memory,
      config.cores,
      config.disk,
      config.qmpSocket || null,
      config.accelerator || null,
      now,
      now
    ]);

    return {
      ...config,
      createdAt: now,
      updatedAt: now
    };
  } catch (err) {
    throw new Error(`Failed to create VM config: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function getVMConfig(vmId: string): Promise<VMConfigData | null> {
  try {
    const database = await initializeDatabase();
    const stmt = database.prepare('SELECT * FROM vms WHERE id = ?');
    const row = await getAsync(stmt, [vmId]);

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      memory: row.memory,
      cores: row.cores,
      disk: row.disk,
      qmpSocket: row.qmp_socket,
      accelerator: row.accelerator,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (err) {
    throw new Error(`Failed to get VM config: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function listVMs(): Promise<VMConfigData[]> {
  try {
    const database = await initializeDatabase();
    const stmt = database.prepare('SELECT * FROM vms ORDER BY created_at DESC');
    const rows = await allAsync(stmt, []);

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      memory: row.memory,
      cores: row.cores,
      disk: row.disk,
      qmpSocket: row.qmp_socket,
      accelerator: row.accelerator,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (err) {
    throw new Error(`Failed to list VMs: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function updateVMConfig(vmId: string, updates: Partial<Omit<VMConfigData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<VMConfigData> {
  try {
    const database = await initializeDatabase();
    const now = Date.now();

    const current = await getVMConfig(vmId);
    if (!current) {
      throw new Error(`VM ${vmId} not found`);
    }

    const updated = { ...current, ...updates, updatedAt: now };

    const stmt = database.prepare(`
      UPDATE vms 
      SET name = ?, memory = ?, cores = ?, disk = ?, qmp_socket = ?, accelerator = ?, updated_at = ?
      WHERE id = ?
    `);

    await runAsync(stmt, [
      updated.name,
      updated.memory,
      updated.cores,
      updated.disk,
      updated.qmpSocket || null,
      updated.accelerator || null,
      now,
      vmId
    ]);

    return updated;
  } catch (err) {
    throw new Error(`Failed to update VM config: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function deleteVMConfig(vmId: string): Promise<{ success: boolean }> {
  try {
    const database = await initializeDatabase();
    const stmt = database.prepare('DELETE FROM vms WHERE id = ?');
    await runAsync(stmt, [vmId]);

    return { success: true };
  } catch (err) {
    throw new Error(`Failed to delete VM config: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}
