use crate::Result;

pub fn get_accelerator_info() -> Result<String> {
    if has_kvm() {
        Ok("Linux KVM available".to_string())
    } else {
        Ok("Linux KVM not available".to_string())
    }
}

pub fn has_kvm() -> bool {
    std::path::Path::new("/dev/kvm").exists()
}
