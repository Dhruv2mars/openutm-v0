use std::process::Child;
use std::sync::{Arc, Mutex};
use crate::{Result, error::Error};

pub struct VMHandle {
    pub vm_id: String,
    pub pid: u32,
    pub process: Child,
    pub qmp_socket: Option<String>,
}

pub struct QemuController {
    qemu_path: String,
    running_vms: Arc<Mutex<std::collections::HashMap<String, VMHandle>>>,
}

impl QemuController {
    pub fn new(qemu_path: String) -> Self {
        Self {
            qemu_path,
            running_vms: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub async fn start_vm(
        &mut self,
        vm_id: &str,
        qemu_args: Vec<String>,
        qmp_socket: Option<String>,
    ) -> Result<u32> {
        use std::process::Command;

        let mut cmd = Command::new(&self.qemu_path);
        cmd.args(&qemu_args);

        let process = cmd.spawn()?;

        let pid = process.id();
        let handle = VMHandle {
            vm_id: vm_id.to_string(),
            pid,
            process,
            qmp_socket: qmp_socket.clone(),
        };

        self.running_vms
            .lock()
            .unwrap()
            .insert(vm_id.to_string(), handle);

        Ok(pid)
    }

    pub async fn stop_vm(&mut self, vm_id: &str) -> Result<()> {
        let mut vms = self.running_vms.lock().unwrap();
        
        match vms.remove(vm_id) {
            Some(mut handle) => {
                handle.process.kill().ok();
                Ok(())
            }
            None => Err(Error::VMError("VM not running".to_string())),
        }
    }

    pub async fn pause_vm(&self, vm_id: &str) -> Result<()> {
        let vms = self.running_vms.lock().unwrap();
        
        if vms.contains_key(vm_id) {
            Ok(())
        } else {
            Err(Error::VMError("VM not running".to_string()))
        }
    }

    pub async fn resume_vm(&self, vm_id: &str) -> Result<()> {
        let vms = self.running_vms.lock().unwrap();
        
        if vms.contains_key(vm_id) {
            Ok(())
        } else {
            Err(Error::VMError("VM not running".to_string()))
        }
    }

    pub fn get_running_vms(&self) -> Vec<String> {
        self.running_vms
            .lock()
            .unwrap()
            .keys()
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_controller() {
        let controller = QemuController::new("/usr/bin/qemu-system-x86_64".to_string());
        assert_eq!(controller.get_running_vms().len(), 0);
    }

    #[tokio::test]
    async fn test_start_vm_returns_handle_with_vm_id_and_pid() {
        let mut controller = QemuController::new("echo".to_string());
        
        let result = controller
            .start_vm("vm-test-1", vec!["test".to_string()], None)
            .await;
        
        match result {
            Ok(pid) => {
                assert!(pid > 0);
            }
            Err(e) => {
                eprintln!("Error: {:?}", e);
                panic!("start_vm failed");
            }
        }
    }

    #[tokio::test]
    async fn test_start_vm_with_qmp_socket() {
        let mut controller = QemuController::new("echo".to_string());
        
        let result = controller
            .start_vm(
                "vm-test-2",
                vec!["test".to_string()],
                Some("/tmp/qmp-vm-test-2.sock".to_string()),
            )
            .await;
        
        match result {
            Ok(pid) => {
                assert!(pid > 0);
            }
            Err(e) => {
                eprintln!("Error: {:?}", e);
                panic!("start_vm with QMP socket failed");
            }
        }
    }

    #[tokio::test]
    async fn test_start_vm_adds_to_running_vms_map() {
        let mut controller = QemuController::new("echo".to_string());
        
        let _ = controller
            .start_vm("vm-test-1", vec!["test".to_string()], None)
            .await;
        
        let running = controller.get_running_vms();
        assert!(running.contains(&"vm-test-1".to_string()));
    }

    #[tokio::test]
    async fn test_start_multiple_vms_independently() {
        let mut controller = QemuController::new("echo".to_string());
        
        let vm1 = controller
            .start_vm("vm-1", vec!["test".to_string()], None)
            .await;
        let vm2 = controller
            .start_vm("vm-2", vec!["test".to_string()], None)
            .await;
        
        assert!(vm1.is_ok());
        assert!(vm2.is_ok());
        
        let running = controller.get_running_vms();
        assert_eq!(running.len(), 2);
    }

    #[tokio::test]
    async fn test_stop_vm_removes_from_running_vms() {
        let mut controller = QemuController::new("echo".to_string());
        
        let _ = controller
            .start_vm("vm-test-1", vec!["test".to_string()], None)
            .await;
        
        assert_eq!(controller.get_running_vms().len(), 1);
        
        let stop_result = controller.stop_vm("vm-test-1").await;
        assert!(stop_result.is_ok());
        assert_eq!(controller.get_running_vms().len(), 0);
    }

    #[tokio::test]
    async fn test_stop_vm_returns_error_if_not_running() {
        let mut controller = QemuController::new("echo".to_string());
        
        let result = controller.stop_vm("vm-nonexistent").await;
        
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_pause_vm_requires_running() {
        let controller = QemuController::new("echo".to_string());
        
        let result = controller.pause_vm("vm-nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_pause_vm_succeeds_if_running() {
        let mut controller = QemuController::new("echo".to_string());
        
        let _ = controller
            .start_vm("vm-test-1", vec!["test".to_string()], None)
            .await;
        
        let result = controller.pause_vm("vm-test-1").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_resume_vm_requires_running() {
        let controller = QemuController::new("echo".to_string());
        
        let result = controller.resume_vm("vm-nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_resume_vm_succeeds_if_running() {
        let mut controller = QemuController::new("echo".to_string());
        
        let _ = controller
            .start_vm("vm-test-1", vec!["test".to_string()], None)
            .await;
        
        let result = controller.resume_vm("vm-test-1").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_lifecycle_start_pause_resume_stop() {
        let mut controller = QemuController::new("echo".to_string());
        
        let start = controller
            .start_vm("vm-test-1", vec!["test".to_string()], None)
            .await;
        assert!(start.is_ok());
        assert_eq!(controller.get_running_vms().len(), 1);
        
        let pause = controller.pause_vm("vm-test-1").await;
        assert!(pause.is_ok());
        
        let resume = controller.resume_vm("vm-test-1").await;
        assert!(resume.is_ok());
        
        let stop = controller.stop_vm("vm-test-1").await;
        assert!(stop.is_ok());
        assert_eq!(controller.get_running_vms().len(), 0);
    }

    #[tokio::test]
    async fn test_error_handling_invalid_process() {
        let mut controller = QemuController::new("/nonexistent/qemu".to_string());
        
        let result = controller
            .start_vm("vm-test-1", vec!["test".to_string()], None)
            .await;
        
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_multiple_vms_lifecycle() {
        let mut controller = QemuController::new("echo".to_string());
        
        let vm1 = controller
            .start_vm("vm-1", vec!["test".to_string()], None)
            .await;
        let vm2 = controller
            .start_vm("vm-2", vec!["test".to_string()], None)
            .await;
        
        assert!(vm1.is_ok());
        assert!(vm2.is_ok());
        assert_eq!(controller.get_running_vms().len(), 2);
        
        let _ = controller.pause_vm("vm-1").await;
        let _ = controller.pause_vm("vm-2").await;
        
        let _ = controller.stop_vm("vm-1").await;
        assert_eq!(controller.get_running_vms().len(), 1);
        
        let _ = controller.stop_vm("vm-2").await;
        assert_eq!(controller.get_running_vms().len(), 0);
    }

    #[tokio::test]
    async fn test_stop_then_start_same_vm_id() {
        let mut controller = QemuController::new("echo".to_string());
        
        let start1 = controller
            .start_vm("vm-reuse", vec!["test".to_string()], None)
            .await;
        assert!(start1.is_ok());
        
        let _ = controller.stop_vm("vm-reuse").await;
        
        let start2 = controller
            .start_vm("vm-reuse", vec!["test".to_string()], None)
            .await;
        assert!(start2.is_ok());
    }
}

