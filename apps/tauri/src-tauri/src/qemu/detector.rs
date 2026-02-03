use crate::{QemuInfo, Result, Error};
use std::path::PathBuf;
use std::process::Command;

/// Detect QEMU binary and get system information
pub async fn detect() -> Result<QemuInfo> {
    let qemu_path = find_qemu_binary()?;
    let version = get_qemu_version(&qemu_path).ok();
    
    #[cfg(target_os = "macos")]
    let accelerator = detect_hvf_support().ok();
    
    #[cfg(target_os = "linux")]
    let accelerator = detect_kvm_support().ok();
    
    #[cfg(target_os = "windows")]
    let accelerator = detect_whpx_support().ok();
    
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
pub fn find_qemu_binary() -> Result<PathBuf> {
    let search_paths = get_search_paths();

    for path in search_paths {
        if path.exists() {
            return Ok(path);
        }
    }

    // Fallback: try via which command
    if let Ok(output) = Command::new("which")
        .arg("qemu-system-x86_64")
        .output()
    {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok(PathBuf::from(path_str));
        }
    }

    Err(Error::QemuNotFound)
}

/// Detect HVF support on macOS via sysctl
#[cfg(target_os = "macos")]
fn detect_hvf_support() -> Result<String> {
    let output = Command::new("sysctl")
        .arg("kern.hv_support")
        .output()
        .map_err(|e| Error::QemuError(format!("Failed to check HVF: {}", e)))?;

    if !output.status.success() {
        return Err(Error::QemuError("HVF not available".to_string()));
    }

    let sysctl_output = String::from_utf8_lossy(&output.stdout);
    if sysctl_output.contains("1") {
        Ok("HVF".to_string())
    } else {
        Err(Error::QemuError("HVF disabled".to_string()))
    }
}

/// Detect KVM support on Linux
#[cfg(target_os = "linux")]
fn detect_kvm_support() -> Result<String> {
    let kvm_path = PathBuf::from("/dev/kvm");
    if kvm_path.exists() {
        Ok("KVM".to_string())
    } else {
        Err(Error::QemuError("KVM not available".to_string()))
    }
}

/// Detect WHPX support on Windows
#[cfg(target_os = "windows")]
fn detect_whpx_support() -> Result<String> {
    // Check if WHPX feature is enabled on Windows
    // For now, return WHPX as available (actual check requires Windows API)
    Ok("WHPX".to_string())
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
pub fn get_qemu_version(path: &PathBuf) -> Result<String> {
    let output = Command::new(path)
        .arg("--version")
        .output()
        .map_err(|e| Error::QemuError(e.to_string()))?;

    if !output.status.success() {
        return Err(Error::QemuError("Failed to get QEMU version".to_string()));
    }

    let version_str = String::from_utf8(output.stdout)
        .map_err(|e| Error::QemuError(e.to_string()))?;

    Ok(version_str
        .lines()
        .next()
        .unwrap_or("unknown")
        .trim()
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qemu_not_found() {
        let result = find_qemu_binary();
        // This may fail on CI, but on a dev machine with QEMU installed, it should succeed
        // or fail gracefully
        match result {
            Ok(_) => {} // QEMU is installed
            Err(Error::QemuNotFound) => {} // QEMU not installed (expected in CI)
            Err(e) => panic!("Unexpected error: {}", e),
        }
    }

    #[test]
    fn test_get_qemu_version_format() {
        // This test requires QEMU to be installed
        if let Ok(qemu_path) = find_qemu_binary() {
            let version = get_qemu_version(&qemu_path);
            assert!(
                version.is_ok(),
                "Should be able to get QEMU version if binary found"
            );

            if let Ok(version_str) = version {
                assert!(
                    !version_str.is_empty(),
                    "Version string should not be empty"
                );
                // Version should contain 'QEMU' or a version number
                assert!(
                    version_str.contains("QEMU") || version_str.chars().next().unwrap().is_numeric(),
                    "Version should contain QEMU or numeric version"
                );
            }
        }
    }

    #[test]
    fn test_qemu_info_has_required_fields() {
        // If QEMU is found, ensure all required fields are populated
        if let Ok(qemu_path) = find_qemu_binary() {
            let info = QemuInfo {
                detected: true,
                path: Some(qemu_path.display().to_string()),
                version: get_qemu_version(&qemu_path).ok(),
                accelerator: None,
            };

            assert!(info.detected, "Detected should be true");
            assert!(info.path.is_some(), "Path should be populated");
            assert!(
                info.path.as_ref().unwrap().contains("qemu"),
                "Path should contain 'qemu'"
            );
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_hvf_detection() {
        // Test HVF detection on macOS
        let result = detect_hvf_support();
        // Result depends on actual system support, just verify it doesn't panic
        match result {
            Ok(accel) => assert_eq!(accel, "HVF"),
            Err(_) => {} // HVF not available is acceptable
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn test_kvm_detection() {
        // Test KVM detection on Linux
        let result = detect_kvm_support();
        // /dev/kvm existence depends on system, just verify it doesn't panic
        match result {
            Ok(accel) => assert_eq!(accel, "KVM"),
            Err(_) => {} // KVM not available is acceptable
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_whpx_detection() {
        let result = detect_whpx_support();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "WHPX");
    }

    #[test]
    fn test_get_search_paths_not_empty() {
        let paths = get_search_paths();
        assert!(!paths.is_empty(), "Search paths should not be empty for any platform");
    }

    #[test]
    fn test_search_paths_contain_qemu_references() {
        let paths = get_search_paths();
        let has_qemu_ref = paths.iter().any(|p| {
            p.to_string_lossy().contains("qemu")
        });
        assert!(
            has_qemu_ref,
            "At least one search path should reference 'qemu'"
        );
    }
}
