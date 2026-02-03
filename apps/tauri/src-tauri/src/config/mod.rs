use crate::Result;
use rusqlite::Connection;
use std::path::PathBuf;

pub struct ConfigStore {
    db_path: PathBuf,
}

impl ConfigStore {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let config = Self { db_path };
        config.init_db()?;
        Ok(config)
    }

    fn init_db(&self) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS vms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                memory_mb INTEGER NOT NULL,
                cpu_cores INTEGER NOT NULL,
                disk_size_gb INTEGER NOT NULL,
                os TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        Ok(())
    }

    pub fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            [key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?")?;
        let result = stmt.query_row([key], |row| row.get(0)).ok();
        Ok(result)
    }
}
