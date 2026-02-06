use std::collections::HashMap;
use std::path::PathBuf;

use tauri::State;
use uuid::Uuid;

use crate::config::{ConfigStore, VMRecord};
use crate::qemu::{self, Accelerator, DisplayConfig, DriveConfig, MachineType, NetdevConfig, QemuCommand};
use crate::storage::DiskManager;
use crate::{platform, DisplaySession, QemuInfo, VMConfig, VMStatus, VM};

pub struct CommandState {
    pub config_store: ConfigStore,
    pub disk_manager: DiskManager,
    pub storage_dir: PathBuf,
    pub qemu_controller: tokio::sync::Mutex<qemu::QemuController>,
    pub display_sessions: tokio::sync::Mutex<HashMap<String, DisplaySession>>,
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateVmRequest {
    pub id: String,
    pub name: Option<String>,
    pub cpu: Option<u32>,
    pub memory: Option<u32>,
}

fn validate_vm_config(config: &VMConfig) -> std::result::Result<(), String> {
    if config.name.trim().is_empty() {
        return Err("VM name cannot be empty".to_string());
    }
    if config.memory_mb < 512 {
        return Err("Memory must be at least 512 MB".to_string());
    }
    if config.cpu_cores == 0 {
        return Err("CPU cores must be at least 1".to_string());
    }
    if config.disk_size_gb == 0 {
        return Err("Disk size must be at least 1 GB".to_string());
    }

    Ok(())
}

fn parse_vm_status(status: &str) -> VMStatus {
    match status.to_ascii_lowercase().as_str() {
        "running" => VMStatus::Running,
        "paused" => VMStatus::Paused,
        "error" => VMStatus::Error,
        _ => VMStatus::Stopped,
    }
}

fn status_to_storage(status: &VMStatus) -> &'static str {
    match status {
        VMStatus::Running => "running",
        VMStatus::Paused => "paused",
        VMStatus::Error => "error",
        VMStatus::Stopped => "stopped",
    }
}

fn map_record_to_vm(record: VMRecord) -> VM {
    let name = record.name.clone();

    VM {
        id: record.id,
        name: name.clone(),
        status: parse_vm_status(&record.status),
        config: VMConfig {
            name,
            memory_mb: record.memory_mb,
            cpu_cores: record.cpu_cores,
            disk_size_gb: record.disk_size_gb,
            os: record.os,
        },
    }
}

#[cfg(target_os = "macos")]
fn default_accelerator() -> Accelerator {
    Accelerator::Hvf
}

#[cfg(target_os = "linux")]
fn default_accelerator() -> Accelerator {
    Accelerator::Kvm
}

#[cfg(target_os = "windows")]
fn default_accelerator() -> Accelerator {
    Accelerator::Whpx
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn default_accelerator() -> Accelerator {
    Accelerator::Tcg
}

fn disk_path(storage_dir: &PathBuf, vm_id: &str) -> String {
    storage_dir
        .join(format!("{}.qcow2", vm_id))
        .display()
        .to_string()
}

fn resolve_spice_port(vm_id: &str) -> u16 {
    let mut hash: u16 = 0;
    for byte in vm_id.as_bytes() {
        hash = (hash.wrapping_mul(31).wrapping_add(*byte as u16)) % 1000;
    }
    5900 + hash
}

fn build_start_args(vm: &VMRecord, disk: &str, qmp_socket: &str) -> std::result::Result<Vec<String>, String> {
    let mut display_options = HashMap::new();
    display_options.insert("addr".to_string(), "127.0.0.1".to_string());
    display_options.insert("disable-ticketing".to_string(), "on".to_string());

    let command = QemuCommand::new()
        .machine(MachineType::Q35)
        .accel(default_accelerator())
        .cpu(vm.cpu_cores)
        .map_err(|e| format!("Invalid CPU config: {}", e))?
        .memory(vm.memory_mb)
        .map_err(|e| format!("Invalid memory config: {}", e))?
        .drive(DriveConfig {
            id: "disk0".to_string(),
            file: disk.to_string(),
            format: "qcow2".to_string(),
            interface: "virtio".to_string(),
        })
        .netdev(NetdevConfig {
            id: "net0".to_string(),
            kind: "user".to_string(),
            options: HashMap::new(),
        })
        .display(DisplayConfig {
            kind: "spice".to_string(),
            port: Some(resolve_spice_port(&vm.id)),
            options: display_options,
        })
        .usb_tablet();

    let mut args = command.build();
    if !args.is_empty() {
        args.remove(0);
    }

    args.push("-qmp".to_string());
    args.push(format!("unix:{},server=on,wait=off", qmp_socket));
    args.push("-name".to_string());
    args.push(vm.name.clone());

    Ok(args)
}

fn fetch_vm_or_err(config_store: &ConfigStore, id: &str) -> std::result::Result<VMRecord, String> {
    config_store
        .get_vm(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("VM {} not found", id))
}

fn update_vm_status(config_store: &ConfigStore, vm_id: &str, status: VMStatus) -> std::result::Result<(), String> {
    let mut record = fetch_vm_or_err(config_store, vm_id)?;
    record.status = status_to_storage(&status).to_string();
    config_store.update_vm(&record).map_err(|e| e.to_string())
}

fn build_display_session(vm_id: &str, status: &str, reconnect_attempts: u32, last_error: Option<String>) -> DisplaySession {
    let port = resolve_spice_port(vm_id);
    DisplaySession {
        vm_id: vm_id.to_string(),
        protocol: "spice".to_string(),
        host: "127.0.0.1".to_string(),
        port,
        uri: format!("spice://127.0.0.1:{}", port),
        status: status.to_string(),
        reconnect_attempts,
        last_error,
    }
}

/// Detect QEMU binary and get system accelerator capabilities
#[tauri::command]
pub async fn detect_qemu() -> std::result::Result<QemuInfo, String> {
    qemu::detector::detect().await.map_err(|e| e.to_string())
}

/// Create a new VM with the given configuration
#[tauri::command]
pub async fn create_vm(state: State<'_, CommandState>, config: VMConfig) -> std::result::Result<VM, String> {
    validate_vm_config(&config)?;

    let vm_id = Uuid::new_v4().to_string();
    state
        .disk_manager
        .create_disk(&vm_id, config.disk_size_gb)
        .await
        .map_err(|e| e.to_string())?;

    let record = VMRecord {
        id: vm_id,
        name: config.name.clone(),
        status: "stopped".to_string(),
        memory_mb: config.memory_mb,
        cpu_cores: config.cpu_cores,
        disk_size_gb: config.disk_size_gb,
        os: config.os.clone(),
    };

    if let Err(err) = state.config_store.create_vm(&record).map_err(|e| e.to_string()) {
        let _ = state.disk_manager.delete_disk(&record.id).await;
        return Err(err);
    }

    Ok(map_record_to_vm(record))
}

/// Update VM mutable fields
#[tauri::command]
pub async fn update_vm(
    state: State<'_, CommandState>,
    request: UpdateVmRequest,
) -> std::result::Result<VM, String> {
    if request.id.trim().is_empty() {
        return Err("VM ID cannot be empty".to_string());
    }

    let mut record = fetch_vm_or_err(&state.config_store, &request.id)?;

    if let Some(name) = request.name {
        if name.trim().is_empty() {
            return Err("VM name cannot be empty".to_string());
        }
        record.name = name;
    }

    if let Some(cpu) = request.cpu {
        if cpu == 0 {
            return Err("CPU cores must be at least 1".to_string());
        }
        record.cpu_cores = cpu;
    }

    if let Some(memory) = request.memory {
        if memory < 512 {
            return Err("Memory must be at least 512 MB".to_string());
        }
        record.memory_mb = memory;
    }

    state
        .config_store
        .update_vm(&record)
        .map_err(|e| e.to_string())?;

    Ok(map_record_to_vm(record))
}

/// Start a VM by ID
#[tauri::command]
pub async fn start_vm(state: State<'_, CommandState>, id: String) -> std::result::Result<(), String> {
    if id.trim().is_empty() {
        return Err("VM ID cannot be empty".to_string());
    }

    let vm_record = fetch_vm_or_err(&state.config_store, &id)?;
    let qmp_socket = format!("/tmp/openutm-qmp-{}.sock", id);
    let args = build_start_args(&vm_record, &disk_path(&state.storage_dir, &id), &qmp_socket)?;

    let mut controller = state.qemu_controller.lock().await;
    controller
        .start_vm(&id, args, Some(qmp_socket))
        .await
        .map_err(|e| e.to_string())?;

    update_vm_status(&state.config_store, &id, VMStatus::Running)?;
    let mut sessions = state.display_sessions.lock().await;
    if let Some(existing) = sessions.get_mut(&id) {
        existing.status = "connected".to_string();
        existing.last_error = None;
    }
    Ok(())
}

/// Stop a running VM
#[tauri::command]
pub async fn stop_vm(state: State<'_, CommandState>, id: String) -> std::result::Result<(), String> {
    if id.trim().is_empty() {
        return Err("VM ID cannot be empty".to_string());
    }

    let mut controller = state.qemu_controller.lock().await;
    controller.stop_vm(&id).await.map_err(|e| e.to_string())?;

    update_vm_status(&state.config_store, &id, VMStatus::Stopped)?;
    let mut sessions = state.display_sessions.lock().await;
    if let Some(existing) = sessions.get_mut(&id) {
        existing.status = "disconnected".to_string();
        existing.last_error = Some("VM stopped".to_string());
    }
    Ok(())
}

/// Pause a running VM
#[tauri::command]
pub async fn pause_vm(state: State<'_, CommandState>, id: String) -> std::result::Result<(), String> {
    if id.trim().is_empty() {
        return Err("VM ID cannot be empty".to_string());
    }

    let controller = state.qemu_controller.lock().await;
    controller.pause_vm(&id).await.map_err(|e| e.to_string())?;

    update_vm_status(&state.config_store, &id, VMStatus::Paused)?;
    Ok(())
}

/// Resume a paused VM
#[tauri::command]
pub async fn resume_vm(state: State<'_, CommandState>, id: String) -> std::result::Result<(), String> {
    if id.trim().is_empty() {
        return Err("VM ID cannot be empty".to_string());
    }

    let controller = state.qemu_controller.lock().await;
    controller.resume_vm(&id).await.map_err(|e| e.to_string())?;

    update_vm_status(&state.config_store, &id, VMStatus::Running)?;
    Ok(())
}

/// List all VMs
#[tauri::command]
pub async fn list_vms(state: State<'_, CommandState>) -> std::result::Result<Vec<VM>, String> {
    let records = state.config_store.list_vms().map_err(|e| e.to_string())?;
    Ok(records.into_iter().map(map_record_to_vm).collect())
}

/// Get VM details by ID
#[tauri::command]
pub async fn get_vm(state: State<'_, CommandState>, id: String) -> std::result::Result<Option<VM>, String> {
    if id.trim().is_empty() {
        return Err("VM ID cannot be empty".to_string());
    }

    let record = state.config_store.get_vm(&id).map_err(|e| e.to_string())?;
    Ok(record.map(map_record_to_vm))
}

/// Delete a VM
#[tauri::command]
pub async fn delete_vm(state: State<'_, CommandState>, id: String) -> std::result::Result<(), String> {
    if id.trim().is_empty() {
        return Err("VM ID cannot be empty".to_string());
    }

    let maybe_vm = state.config_store.get_vm(&id).map_err(|e| e.to_string())?;
    if maybe_vm.is_none() {
        return Ok(());
    }

    {
        let mut controller = state.qemu_controller.lock().await;
        let _ = controller.stop_vm(&id).await;
    }

    state.disk_manager.delete_disk(&id).await.map_err(|e| e.to_string())?;
    state.config_store.delete_vm(&id).map_err(|e| e.to_string())?;
    state.display_sessions.lock().await.remove(&id);

    Ok(())
}

/// Get platform acceleration capabilities
#[tauri::command]
pub async fn get_platform_info() -> std::result::Result<String, String> {
    platform::get_platform_info().map_err(|e| e.to_string())
}

/// Open display session for a running VM
#[tauri::command]
pub async fn open_display(state: State<'_, CommandState>, id: String) -> std::result::Result<DisplaySession, String> {
    if id.trim().is_empty() {
        return Err("VM ID cannot be empty".to_string());
    }

    let _ = fetch_vm_or_err(&state.config_store, &id)?;
    let controller = state.qemu_controller.lock().await;
    if !controller.is_running(&id) {
        return Err(format!("VM {} not running", id));
    }
    drop(controller);

    let mut sessions = state.display_sessions.lock().await;
    if let Some(existing) = sessions.get_mut(&id) {
        if existing.status == "disconnected" || existing.status == "error" {
            existing.status = "connected".to_string();
            existing.reconnect_attempts += 1;
            existing.last_error = None;
        }
        return Ok(existing.clone());
    }

    let session = build_display_session(&id, "connected", 0, None);
    sessions.insert(id, session.clone());
    Ok(session)
}

/// Get display session by VM ID
#[tauri::command]
pub async fn get_display(state: State<'_, CommandState>, id: String) -> std::result::Result<Option<DisplaySession>, String> {
    if id.trim().is_empty() {
        return Err("VM ID cannot be empty".to_string());
    }

    let is_running = {
        let controller = state.qemu_controller.lock().await;
        controller.is_running(&id)
    };

    let mut sessions = state.display_sessions.lock().await;
    if let Some(existing) = sessions.get_mut(&id) {
        if !is_running && existing.status != "disconnected" {
            existing.status = "disconnected".to_string();
            existing.last_error = Some("VM not running".to_string());
        }
        return Ok(Some(existing.clone()));
    }

    Ok(None)
}

/// Close display session
#[tauri::command]
pub async fn close_display(state: State<'_, CommandState>, id: String) -> std::result::Result<(), String> {
    if id.trim().is_empty() {
        return Err("VM ID cannot be empty".to_string());
    }

    let mut sessions = state.display_sessions.lock().await;
    if let Some(existing) = sessions.get_mut(&id) {
        existing.status = "disconnected".to_string();
        existing.last_error = Some("Display session closed".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_vm_config_rejects_invalid() {
        let config = VMConfig {
            name: String::new(),
            memory_mb: 256,
            cpu_cores: 0,
            disk_size_gb: 0,
            os: "linux".to_string(),
        };

        let result = validate_vm_config(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_vm_status_defaults_to_stopped() {
        assert_eq!(parse_vm_status("unknown"), VMStatus::Stopped);
    }

    #[test]
    fn test_map_record_to_vm_maps_core_fields() {
        let record = VMRecord {
            id: "vm-1".to_string(),
            name: "Ubuntu VM".to_string(),
            status: "paused".to_string(),
            memory_mb: 4096,
            cpu_cores: 4,
            disk_size_gb: 64,
            os: "linux".to_string(),
        };

        let vm = map_record_to_vm(record);
        assert_eq!(vm.id, "vm-1");
        assert_eq!(vm.name, "Ubuntu VM");
        assert_eq!(vm.status, VMStatus::Paused);
        assert_eq!(vm.config.memory_mb, 4096);
        assert_eq!(vm.config.cpu_cores, 4);
    }

    #[test]
    fn test_build_start_args_includes_qmp_and_name() {
        let record = VMRecord {
            id: "vm-1".to_string(),
            name: "Fedora VM".to_string(),
            status: "stopped".to_string(),
            memory_mb: 2048,
            cpu_cores: 2,
            disk_size_gb: 20,
            os: "linux".to_string(),
        };

        let args = build_start_args(&record, "/tmp/vm-1.qcow2", "/tmp/openutm-qmp-vm-1.sock")
            .expect("args should build");
        let joined = args.join(" ");

        assert!(joined.contains("-qmp"));
        assert!(joined.contains("openutm-qmp-vm-1.sock"));
        assert!(joined.contains("-name Fedora VM"));
        assert!(joined.contains("-spice"));
        assert!(joined.contains(&format!("port={}", resolve_spice_port("vm-1"))));
    }

    #[test]
    fn test_resolve_spice_port_is_stable_and_in_range() {
        let port = resolve_spice_port("vm-1");
        assert_eq!(port, resolve_spice_port("vm-1"));
        assert!((5900..=6899).contains(&port));
    }

    #[test]
    fn test_build_display_session_defaults() {
        let session = build_display_session("vm-1", "connected", 0, None);
        assert_eq!(session.protocol, "spice");
        assert!(session.uri.starts_with("spice://127.0.0.1:"));
        assert_eq!(session.status, "connected");
        assert_eq!(session.reconnect_attempts, 0);
    }
}
