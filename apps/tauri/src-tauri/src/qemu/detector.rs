use crate::{QemuInfo, Result, Error};
use std::path::PathBuf;
use std::process::Command;

/// Detect QEMU binary and get system information
pub async fn detect() -> Result<QemuInfo> {
    let qemu_path = find_qemu_binary()?;
    let version = get_qemu_version(&qemu_path).ok();
    
    #[cfg(target_os = "macos")]
    let accelerator = Some("HVF".to_string());
    
    #[cfg(target_os = "linux")]
    let accelerator = Some("KVM".to_string());
    
    #[cfg(target_os = "windows")]
    let accelerator = Some("WHPX".to_string());
    
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    let accelerator = None;

    Ok(QemuInfo {
        detected: true,
        path: Some(qemu_path.display().to_string()),
        version,
        accelerator,
    })
}

/// Find QEMU binary in system PATH
fn find_qemu_binary() -> Result<PathBuf> {
    let search_paths = get_search_paths();

    for path in search_paths {
        if path.exists() {
            return Ok(path);
        }
    }

    Err(Error::QemuNotFound)
}

/// Get QEMU installation search paths by platform
#[cfg(target_os = "macos")]
fn get_search_paths() -> Vec<PathBuf> {
    vec![
        PathBuf::from("/usr/local/bin/qemu-system-aarch64"),
        PathBuf::from("/opt/homebrew/bin/qemu-system-aarch64"),
        PathBuf::from("/usr/local/bin/qemu-system-x86_64"),
        PathBuf::from("/opt/homebrew/bin/qemu-system-x86_64"),
    ]
}

#[cfg(target_os = "linux")]
fn get_search_paths() -> Vec<PathBuf> {
    vec![
        PathBuf::from("/usr/bin/qemu-system-x86_64"),
        PathBuf::from("/usr/bin/qemu-system-aarch64"),
        PathBuf::from("/usr/libexec/qemu-system-x86_64"),
    ]
}

#[cfg(target_os = "windows")]
fn get_search_paths() -> Vec<PathBuf> {
    vec![
        PathBuf::from("C:\\Program Files\\qemu\\qemu-system-x86_64.exe"),
        PathBuf::from("C:\\Program Files (x86)\\qemu\\qemu-system-x86_64.exe"),
    ]
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn get_search_paths() -> Vec<PathBuf> {
    vec![]
}

/// Get QEMU version from binary
fn get_qemu_version(path: &PathBuf) -> Result<String> {
    let output = Command::new(path)
        .arg("--version")
        .output()
        .map_err(|e| Error::QemuError(e.to_string()))?;

    let version_str = String::from_utf8(output.stdout)
        .map_err(|e| Error::QemuError(e.to_string()))?;

    Ok(version_str.lines().next().unwrap_or("unknown").to_string())
}
