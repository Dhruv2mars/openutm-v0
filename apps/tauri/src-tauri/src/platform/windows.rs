use crate::Result;

pub fn get_accelerator_info() -> Result<String> {
    if has_whpx() {
        Ok("Windows WHPX available".to_string())
    } else {
        Ok("Windows WHPX not available".to_string())
    }
}

pub fn has_whpx() -> bool {
    std::path::Path::new("\\\\.\\Global\\WHPX").exists()
}
