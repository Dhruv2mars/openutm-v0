use crate::Result;
use crate::error::Error;
use rusqlite::{Connection, params};
use std::path::PathBuf;
use serde_json::{json, Value};

pub struct ConfigStore {
    db_path: PathBuf,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VMRecord {
    pub id: String,
    pub name: String,
    pub status: String,
    pub memory_mb: u32,
    pub cpu_cores: u32,
    pub disk_size_gb: u32,
    pub os: String,
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS configs (
                vm_id TEXT PRIMARY KEY,
                boot_order TEXT,
                network_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(vm_id) REFERENCES vms(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS drives (
                id TEXT PRIMARY KEY,
                vm_id TEXT NOT NULL,
                path TEXT NOT NULL,
                interface TEXT,
                format TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(vm_id) REFERENCES vms(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS networks (
                id TEXT PRIMARY KEY,
                vm_id TEXT NOT NULL,
                type TEXT NOT NULL,
                config TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(vm_id) REFERENCES vms(id) ON DELETE CASCADE
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

    pub fn create_vm(&self, vm: &VMRecord) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;
        conn.execute(
            "INSERT INTO vms (id, name, status, memory_mb, cpu_cores, disk_size_gb, os) 
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![&vm.id, &vm.name, &vm.status, vm.memory_mb, vm.cpu_cores, vm.disk_size_gb, &vm.os],
        )?;
        Ok(())
    }

    pub fn get_vm(&self, id: &str) -> Result<Option<VMRecord>> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare(
            "SELECT id, name, status, memory_mb, cpu_cores, disk_size_gb, os FROM vms WHERE id = ?"
        )?;
        
        let result = stmt.query_row([id], |row| {
            Ok(VMRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                status: row.get(2)?,
                memory_mb: row.get(3)?,
                cpu_cores: row.get(4)?,
                disk_size_gb: row.get(5)?,
                os: row.get(6)?,
            })
        }).ok();
        
        Ok(result)
    }

    pub fn list_vms(&self) -> Result<Vec<VMRecord>> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare(
            "SELECT id, name, status, memory_mb, cpu_cores, disk_size_gb, os FROM vms ORDER BY created_at DESC"
        )?;
        
        let vms = stmt.query_map([], |row| {
            Ok(VMRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                status: row.get(2)?,
                memory_mb: row.get(3)?,
                cpu_cores: row.get(4)?,
                disk_size_gb: row.get(5)?,
                os: row.get(6)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
        
        Ok(vms)
    }

    pub fn update_vm(&self, vm: &VMRecord) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;
        let rows = conn.execute(
            "UPDATE vms SET name = ?, status = ?, memory_mb = ?, cpu_cores = ?, disk_size_gb = ?, os = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?",
            params![&vm.name, &vm.status, vm.memory_mb, vm.cpu_cores, vm.disk_size_gb, &vm.os, &vm.id],
        )?;
        
        if rows == 0 {
            return Err(Error::InvalidConfig(format!("VM {} not found", vm.id)));
        }
        
        Ok(())
    }

    pub fn delete_vm(&self, id: &str) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;
        conn.execute("DELETE FROM vms WHERE id = ?", [id])?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use uuid::Uuid;

    fn create_test_db() -> (ConfigStore, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");
        let store = ConfigStore::new(db_path).expect("Failed to create store");
        (store, temp_dir)
    }

    fn create_test_vm() -> VMRecord {
        VMRecord {
            id: Uuid::new_v4().to_string(),
            name: "Test VM".to_string(),
            status: "stopped".to_string(),
            memory_mb: 2048,
            cpu_cores: 2,
            disk_size_gb: 50,
            os: "linux".to_string(),
        }
    }

    #[test]
    fn test_config_store_new() {
        let (store, _temp) = create_test_db();
        assert!(store.db_path.exists());
    }

    #[test]
    fn test_create_vm() {
        let (store, _temp) = create_test_db();
        let vm = create_test_vm();
        
        let result = store.create_vm(&vm);
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_vm_existing() {
        let (store, _temp) = create_test_db();
        let vm = create_test_vm();
        
        store.create_vm(&vm).expect("Failed to create VM");
        let retrieved = store.get_vm(&vm.id).expect("Failed to get VM");
        
        assert!(retrieved.is_some());
        let retrieved_vm = retrieved.unwrap();
        assert_eq!(retrieved_vm.id, vm.id);
        assert_eq!(retrieved_vm.name, vm.name);
        assert_eq!(retrieved_vm.memory_mb, vm.memory_mb);
    }

    #[test]
    fn test_get_vm_nonexistent() {
        let (store, _temp) = create_test_db();
        let result = store.get_vm("nonexistent-id").expect("Should not error");
        assert!(result.is_none());
    }

    #[test]
    fn test_list_vms_empty() {
        let (store, _temp) = create_test_db();
        let vms = store.list_vms().expect("Failed to list VMs");
        assert_eq!(vms.len(), 0);
    }

    #[test]
    fn test_list_vms_multiple() {
        let (store, _temp) = create_test_db();
        let vm1 = create_test_vm();
        let mut vm2 = create_test_vm();
        vm2.name = "VM 2".to_string();
        
        store.create_vm(&vm1).expect("Failed to create VM1");
        store.create_vm(&vm2).expect("Failed to create VM2");
        
        let vms = store.list_vms().expect("Failed to list VMs");
        assert_eq!(vms.len(), 2);
    }

    #[test]
    fn test_update_vm() {
        let (store, _temp) = create_test_db();
        let mut vm = create_test_vm();
        
        store.create_vm(&vm).expect("Failed to create VM");
        
        vm.name = "Updated VM".to_string();
        vm.memory_mb = 4096;
        
        let result = store.update_vm(&vm);
        assert!(result.is_ok());
        
        let retrieved = store.get_vm(&vm.id).expect("Failed to get VM");
        assert!(retrieved.is_some());
        let retrieved_vm = retrieved.unwrap();
        assert_eq!(retrieved_vm.name, "Updated VM");
        assert_eq!(retrieved_vm.memory_mb, 4096);
    }

    #[test]
    fn test_update_vm_nonexistent() {
        let (store, _temp) = create_test_db();
        let vm = create_test_vm();
        
        let result = store.update_vm(&vm);
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_vm() {
        let (store, _temp) = create_test_db();
        let vm = create_test_vm();
        
        store.create_vm(&vm).expect("Failed to create VM");
        assert!(store.get_vm(&vm.id).expect("Failed to get VM").is_some());
        
        store.delete_vm(&vm.id).expect("Failed to delete VM");
        assert!(store.get_vm(&vm.id).expect("Failed to get VM").is_none());
    }

    #[test]
    fn test_save_and_get_setting() {
        let (store, _temp) = create_test_db();
        
        store.save_setting("test_key", "test_value").expect("Failed to save setting");
        let result = store.get_setting("test_key").expect("Failed to get setting");
        
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "test_value");
    }

    #[test]
    fn test_get_setting_nonexistent() {
        let (store, _temp) = create_test_db();
        let result = store.get_setting("nonexistent").expect("Failed to get setting");
        assert!(result.is_none());
    }

    #[test]
    fn test_save_setting_overwrites() {
        let (store, _temp) = create_test_db();
        
        store.save_setting("key", "value1").expect("Failed to save");
        store.save_setting("key", "value2").expect("Failed to overwrite");
        
        let result = store.get_setting("key").expect("Failed to get");
        assert_eq!(result.unwrap(), "value2");
    }

    #[test]
    fn test_vm_validation_required_fields() {
        let (store, _temp) = create_test_db();
        let vm = VMRecord {
            id: "".to_string(),
            name: "Test".to_string(),
            status: "stopped".to_string(),
            memory_mb: 2048,
            cpu_cores: 2,
            disk_size_gb: 50,
            os: "linux".to_string(),
        };
        
        let result = store.create_vm(&vm);
        assert!(result.is_ok());
    }
}
