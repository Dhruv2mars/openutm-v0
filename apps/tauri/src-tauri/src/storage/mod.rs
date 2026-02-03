use crate::Result;
use std::path::Path;

pub struct DiskManager {
    storage_dir: String,
}

impl DiskManager {
    pub fn new(storage_dir: String) -> Self {
        Self { storage_dir }
    }

    pub async fn create_disk(&self, vm_id: &str, size_gb: u32) -> Result<String> {
        let disk_path = format!("{}/{}.qcow2", self.storage_dir, vm_id);
        Ok(disk_path)
    }

    pub async fn delete_disk(&self, vm_id: &str) -> Result<()> {
        let disk_path = format!("{}/{}.qcow2", self.storage_dir, vm_id);
        if Path::new(&disk_path).exists() {
            std::fs::remove_file(&disk_path)?;
        }
        Ok(())
    }

    pub async fn get_disk_size(&self, vm_id: &str) -> Result<u64> {
        let disk_path = format!("{}/{}.qcow2", self.storage_dir, vm_id);
        let metadata = std::fs::metadata(&disk_path)?;
        Ok(metadata.len())
    }
}
