use crate::Result;

pub fn get_accelerator_info() -> Result<String> {
    if has_hvf() {
        Ok("macOS HVF (Hypervisor Framework) available".to_string())
    } else {
        Ok("macOS HVF not available".to_string())
    }
}

pub fn has_hvf() -> bool {
    std::process::Command::new("sysctl")
        .args(&["hw.optional.hv"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}
