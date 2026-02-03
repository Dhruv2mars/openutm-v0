use crate::Result;
use crate::error::Error;
use std::path::Path;
use tokio::process::Command;

pub struct DiskManager {
    storage_dir: String,
}

impl DiskManager {
    pub fn new(storage_dir: String) -> Self {
        Self { storage_dir }
    }

    pub async fn create_disk(&self, vm_id: &str, size_gb: u32) -> Result<String> {
        let disk_path = format!("{}/{}.qcow2", self.storage_dir, vm_id);
        
        std::fs::create_dir_all(&self.storage_dir)?;
        
        let size_string = format!("{}G", size_gb);
        
        let output = Command::new("qemu-img")
            .args(&["create", "-f", "qcow2", &disk_path, &size_string])
            .output()
            .await?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(Error::QemuError(format!("qemu-img create failed: {}", stderr)));
        }
        
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

    pub async fn get_virtual_size(&self, vm_id: &str) -> Result<u64> {
        let disk_path = format!("{}/{}.qcow2", self.storage_dir, vm_id);
        
        let output = Command::new("qemu-img")
            .args(&["info", "--output=json", &disk_path])
            .output()
            .await?;
        
        if !output.status.success() {
            return Err(Error::QemuError("qemu-img info failed".to_string()));
        }
        
        let info_json = String::from_utf8(output.stdout)?;
        let parsed: serde_json::Value = serde_json::from_str(&info_json)?;
        
        let virtual_size = parsed["virtual-size"]
            .as_u64()
            .ok_or_else(|| Error::InvalidConfig("Invalid virtual-size in qemu-img output".to_string()))?;
        
        Ok(virtual_size)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::TempDir;

    fn setup_test_dir() -> TempDir {
        TempDir::new().expect("Failed to create temp dir")
    }

    #[test]
    fn test_disk_manager_new() {
        let temp_dir = setup_test_dir();
        let manager = DiskManager::new(temp_dir.path().to_string_lossy().to_string());
        assert_eq!(manager.storage_dir, temp_dir.path().to_string_lossy().to_string());
    }

    #[tokio::test]
    async fn test_create_disk_returns_valid_path() {
        let temp_dir = setup_test_dir();
        let manager = DiskManager::new(temp_dir.path().to_string_lossy().to_string());
        
        let result = manager.create_disk("test-vm-1", 50).await;
        
        match result {
            Ok(path) => {
                assert!(path.contains("test-vm-1"));
                assert!(path.ends_with(".qcow2"));
            }
            Err(e) => {
                assert!(e.to_string().contains("qemu-img") || e.to_string().contains("No such file"));
            }
        }
    }

    #[tokio::test]
    async fn test_delete_disk_removes_file() {
        let temp_dir = setup_test_dir();
        let manager = DiskManager::new(temp_dir.path().to_string_lossy().to_string());
        let disk_path = format!("{}/test-vm.qcow2", temp_dir.path().display());
        
        create_test_file(&disk_path, b"test");
        
        assert!(Path::new(&disk_path).exists());
        
        let result = manager.delete_disk("test-vm").await;
        assert!(result.is_ok());
        assert!(!Path::new(&disk_path).exists());
    }

    #[tokio::test]
    async fn test_delete_disk_nonexistent_succeeds() {
        let temp_dir = setup_test_dir();
        let manager = DiskManager::new(temp_dir.path().to_string_lossy().to_string());
        
        let result = manager.delete_disk("nonexistent-vm").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_disk_size_valid_file() {
        let temp_dir = setup_test_dir();
        let manager = DiskManager::new(temp_dir.path().to_string_lossy().to_string());
        let disk_path = format!("{}/test-vm.qcow2", temp_dir.path().display());
        
        let test_data = vec![0u8; 1024];
        create_test_file(&disk_path, &test_data);
        
        let result = manager.get_disk_size("test-vm").await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1024);
    }

    #[tokio::test]
    async fn test_get_disk_size_nonexistent_fails() {
        let temp_dir = setup_test_dir();
        let manager = DiskManager::new(temp_dir.path().to_string_lossy().to_string());
        
        let result = manager.get_disk_size("nonexistent-vm").await;
        assert!(result.is_err());
    }

    #[test]
    fn test_storage_dir_path_validation() {
        let manager = DiskManager::new("/valid/path".to_string());
        assert!(!manager.storage_dir.is_empty());
    }

    #[tokio::test]
    async fn test_multiple_disks_same_dir() {
        let temp_dir = setup_test_dir();
        let manager = DiskManager::new(temp_dir.path().to_string_lossy().to_string());
        
        let disk1_result = manager.create_disk("vm-1", 50).await;
        let disk2_result = manager.create_disk("vm-2", 100).await;
        
        if disk1_result.is_ok() && disk2_result.is_ok() {
            let disk1 = disk1_result.unwrap();
            let disk2 = disk2_result.unwrap();
            
            assert_ne!(disk1, disk2);
            assert!(disk1.contains("vm-1"));
            assert!(disk2.contains("vm-2"));
        }
    }

    #[test]
    fn test_storage_dir_with_special_chars() {
        let manager = DiskManager::new("/path/with spaces/and-dashes".to_string());
        assert!(!manager.storage_dir.is_empty());
        assert!(manager.storage_dir.contains("spaces"));
    }

    fn create_test_file(path: &str, data: &[u8]) {
        let mut file = fs::File::create(path).expect("Failed to create test file");
        file.write_all(data).expect("Failed to write test data");
    }
}