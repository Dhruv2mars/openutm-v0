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
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::detect_qemu,
            commands::create_vm,
            commands::start_vm,
            commands::stop_vm,
            commands::pause_vm,
            commands::resume_vm,
            commands::list_vms,
            commands::get_vm,
            commands::delete_vm,
            commands::get_platform_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
