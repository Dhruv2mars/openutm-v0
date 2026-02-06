#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod qemu;
mod platform;
mod storage;
mod config;
mod error;

pub use error::{Error, Result};

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DisplaySession {
    pub vm_id: String,
    pub protocol: String,
    pub host: String,
    pub port: u16,
    pub uri: String,
    pub status: String,
    pub reconnect_attempts: u32,
    pub last_error: Option<String>,
    pub connected_at: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct QemuInfo {
    pub detected: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub accelerator: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct VMConfig {
    pub name: String,
    pub memory_mb: u32,
    pub cpu_cores: u32,
    pub disk_size_gb: u32,
    pub os: String,
    #[serde(default)]
    pub install_media_path: Option<String>,
    #[serde(default = "default_boot_order")]
    pub boot_order: String,
    #[serde(default = "default_network_type")]
    pub network_type: String,
}

fn default_boot_order() -> String {
    "disk-first".to_string()
}

fn default_network_type() -> String {
    "nat".to_string()
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct VM {
    pub id: String,
    pub name: String,
    pub status: VMStatus,
    pub config: VMConfig,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VMStatus {
    Running,
    Stopped,
    Paused,
    Error,
}

fn main() {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let data_dir = std::path::PathBuf::from(home).join(".openutm");
    let storage_dir = data_dir.join("disks");
    std::fs::create_dir_all(&storage_dir).expect("failed to create storage directory");

    let db_path = data_dir.join("config.db");
    let config_store = config::ConfigStore::new(db_path).expect("failed to init config db");
    let disk_manager = storage::DiskManager::new(storage_dir.display().to_string());

    let qemu_path = qemu::detector::find_qemu_binary()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| {
            if cfg!(target_arch = "aarch64") {
                "qemu-system-aarch64".to_string()
            } else {
                "qemu-system-x86_64".to_string()
            }
        });
    let qemu_controller = qemu::QemuController::new(qemu_path);

    let state = commands::CommandState {
        config_store,
        disk_manager,
        storage_dir,
        qemu_controller: tokio::sync::Mutex::new(qemu_controller),
        display_sessions: tokio::sync::Mutex::new(std::collections::HashMap::new()),
    };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::detect_qemu,
            commands::create_vm,
            commands::update_vm,
            commands::pick_install_media,
            commands::set_install_media,
            commands::eject_install_media,
            commands::set_boot_order,
            commands::start_vm,
            commands::stop_vm,
            commands::pause_vm,
            commands::resume_vm,
            commands::list_vms,
            commands::get_vm,
            commands::delete_vm,
            commands::get_platform_info,
            commands::open_display,
            commands::get_display,
            commands::close_display,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
