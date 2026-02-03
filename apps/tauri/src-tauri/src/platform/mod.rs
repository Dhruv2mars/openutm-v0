pub mod macos;
pub mod linux;
pub mod windows;

use crate::Result;

/// Get current platform accelerator information
pub fn get_platform_info() -> Result<String> {
    #[cfg(target_os = "macos")]
    return macos::get_accelerator_info();

    #[cfg(target_os = "linux")]
    return linux::get_accelerator_info();

    #[cfg(target_os = "windows")]
    return windows::get_accelerator_info();

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    return Ok("Unknown platform".to_string());
}

/// Detect if hypervisor acceleration is available
pub fn has_acceleration() -> bool {
    #[cfg(target_os = "macos")]
    return macos::has_hvf();

    #[cfg(target_os = "linux")]
    return linux::has_kvm();

    #[cfg(target_os = "windows")]
    return windows::has_whpx();

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    false
}
