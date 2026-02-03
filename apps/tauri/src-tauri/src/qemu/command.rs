//! QEMU Command Builder
//! 
//! Generates QEMU command lines programmatically with type safety.
//! Builder pattern for composing QEMU command arguments.

use std::collections::HashMap;

#[derive(Debug, Clone)]
pub enum Accelerator {
    Hvf,
    Kvm,
    Whpx,
    Tcg,
}

impl Accelerator {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Hvf => "hvf",
            Self::Kvm => "kvm",
            Self::Whpx => "whpx",
            Self::Tcg => "tcg",
        }
    }
}

#[derive(Debug, Clone)]
pub enum MachineType {
    Q35,
    I440fx,
    Virt,
}

impl MachineType {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Q35 => "q35",
            Self::I440fx => "i440fx",
            Self::Virt => "virt",
        }
    }
}

#[derive(Debug, Clone)]
pub struct DriveConfig {
    pub id: String,
    pub file: String,
    pub format: String,
    pub interface: String,
}

#[derive(Debug, Clone)]
pub struct NetdevConfig {
    pub id: String,
    pub kind: String,
    pub options: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct DisplayConfig {
    pub kind: String,
    pub port: Option<u16>,
    pub options: HashMap<String, String>,
}

/// QEMU command builder with fluent API
#[derive(Debug, Clone)]
pub struct QemuCommand {
    machine: Option<MachineType>,
    accelerator: Option<Accelerator>,
    cpu_count: Option<u32>,
    memory_mb: Option<u32>,
    drives: Vec<DriveConfig>,
    netdevs: Vec<NetdevConfig>,
    display: Option<DisplayConfig>,
    usb_tablet: bool,
}

impl Default for QemuCommand {
    fn default() -> Self {
        Self::new()
    }
}

impl QemuCommand {
    /// Create new QEMU command builder
    pub fn new() -> Self {
        Self {
            machine: None,
            accelerator: None,
            cpu_count: None,
            memory_mb: None,
            drives: Vec::new(),
            netdevs: Vec::new(),
            display: None,
            usb_tablet: false,
        }
    }

    /// Set machine type
    pub fn machine(mut self, machine: MachineType) -> Self {
        self.machine = Some(machine);
        self
    }

    /// Set accelerator
    pub fn accel(mut self, accel: Accelerator) -> Self {
        self.accelerator = Some(accel);
        self
    }

    /// Set CPU count (must be > 0)
    pub fn cpu(mut self, count: u32) -> Result<Self, String> {
        if count == 0 {
            return Err("CPU count must be > 0".to_string());
        }
        self.cpu_count = Some(count);
        Ok(self)
    }

    /// Set memory in MB (must be > 0)
    pub fn memory(mut self, mb: u32) -> Result<Self, String> {
        if mb == 0 {
            return Err("Memory must be > 0 MB".to_string());
        }
        self.memory_mb = Some(mb);
        Ok(self)
    }

    /// Add virtual drive
    pub fn drive(mut self, drive: DriveConfig) -> Self {
        self.drives.push(drive);
        self
    }

    /// Add network device
    pub fn netdev(mut self, netdev: NetdevConfig) -> Self {
        self.netdevs.push(netdev);
        self
    }

    /// Set display configuration (SPICE)
    pub fn display(mut self, display: DisplayConfig) -> Self {
        self.display = Some(display);
        self
    }

    /// Enable USB tablet for better mouse support
    pub fn usb_tablet(mut self) -> Self {
        self.usb_tablet = true;
        self
    }

    /// Generate command line arguments as Vec<String>
    pub fn build(&self) -> Vec<String> {
        let mut args = vec!["qemu-system-x86_64".to_string()];

        // Machine type
        if let Some(machine) = &self.machine {
            args.push("-machine".to_string());
            args.push(machine.as_str().to_string());
        }

        // Accelerator
        if let Some(accel) = &self.accelerator {
            args.push("-accel".to_string());
            args.push(accel.as_str().to_string());
        }

        // CPU
        if let Some(cpu) = self.cpu_count {
            args.push("-smp".to_string());
            args.push(cpu.to_string());
        }

        // Memory
        if let Some(mem) = self.memory_mb {
            args.push("-m".to_string());
            args.push(mem.to_string());
        }

        // Drives
        for drive in &self.drives {
            args.push("-drive".to_string());
            let drive_str = format!(
                "file={},format={},if={}",
                drive.file, drive.format, drive.interface
            );
            args.push(drive_str);
        }

        // Netdevs
        for netdev in &self.netdevs {
            args.push("-netdev".to_string());
            let mut netdev_str = format!("{},id={}", netdev.kind, netdev.id);
            for (k, v) in &netdev.options {
                netdev_str.push(',');
                netdev_str.push_str(&format!("{}={}", k, v));
            }
            args.push(netdev_str);
        }

        // Display
        if let Some(display) = &self.display {
            if display.kind == "spice" {
                args.push("-spice".to_string());
                let mut spice_str = String::new();
                if let Some(port) = display.port {
                    spice_str.push_str(&format!("port={}", port));
                }
                for (k, v) in &display.options {
                    if !spice_str.is_empty() {
                        spice_str.push(',');
                    }
                    spice_str.push_str(&format!("{}={}", k, v));
                }
                args.push(spice_str);
            }
        }

        // USB tablet
        if self.usb_tablet {
            args.push("-device".to_string());
            args.push("usb-tablet".to_string());
        }

        args
    }

    /// Generate complete command line string
    pub fn build_string(&self) -> String {
        self.build().join(" ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_command_with_accelerator() {
        let cmd = QemuCommand::new()
            .accel(Accelerator::Hvf);

        let args = cmd.build();
        assert!(args.contains(&"-accel".to_string()));
        assert!(args.contains(&"hvf".to_string()));
    }

    #[test]
    fn test_set_cpu_count() {
        let cmd = QemuCommand::new()
            .cpu(4)
            .expect("cpu should work");

        let args = cmd.build();
        assert!(args.contains(&"-smp".to_string()));
        assert!(args.contains(&"4".to_string()));
    }

    #[test]
    fn test_set_memory() {
        let cmd = QemuCommand::new()
            .memory(4096)
            .expect("memory should work");

        let args = cmd.build();
        assert!(args.contains(&"-m".to_string()));
        assert!(args.contains(&"4096".to_string()));
    }

    #[test]
    fn test_add_drive() {
        let drive = DriveConfig {
            id: "disk0".to_string(),
            file: "/path/to/disk.qcow2".to_string(),
            format: "qcow2".to_string(),
            interface: "virtio".to_string(),
        };

        let cmd = QemuCommand::new()
            .drive(drive);

        let args = cmd.build();
        let args_str = args.join(" ");
        assert!(args_str.contains("file=/path/to/disk.qcow2"));
        assert!(args_str.contains("format=qcow2"));
        assert!(args_str.contains("if=virtio"));
    }

    #[test]
    fn test_add_network() {
        let mut opts = HashMap::new();
        opts.insert("hostfwd".to_string(), "tcp::2222-:22".to_string());

        let netdev = NetdevConfig {
            id: "net0".to_string(),
            kind: "user".to_string(),
            options: opts,
        };

        let cmd = QemuCommand::new()
            .netdev(netdev);

        let args = cmd.build();
        let args_str = args.join(" ");
        assert!(args_str.contains("-netdev"));
        assert!(args_str.contains("user,id=net0"));
        assert!(args_str.contains("hostfwd=tcp::2222-:22"));
    }

    #[test]
    fn test_add_spice_display() {
        let display = DisplayConfig {
            kind: "spice".to_string(),
            port: Some(5900),
            options: Default::default(),
        };

        let cmd = QemuCommand::new()
            .display(display);

        let args = cmd.build();
        assert!(args.contains(&"-spice".to_string()));
        let args_str = args.join(" ");
        assert!(args_str.contains("port=5900"));
    }

    #[test]
    fn test_add_usb_tablet() {
        let cmd = QemuCommand::new()
            .usb_tablet();

        let args = cmd.build();
        assert!(args.contains(&"-device".to_string()));
        assert!(args.contains(&"usb-tablet".to_string()));
    }

    #[test]
    fn test_validate_cpu_count() {
        let result = QemuCommand::new().cpu(0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "CPU count must be > 0");
    }

    #[test]
    fn test_validate_memory() {
        let result = QemuCommand::new().memory(0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Memory must be > 0 MB");
    }

    #[test]
    fn test_machine_type() {
        let cmd = QemuCommand::new()
            .machine(MachineType::Q35);

        let args = cmd.build();
        assert!(args.contains(&"-machine".to_string()));
        assert!(args.contains(&"q35".to_string()));
    }

    #[test]
    fn test_complete_command() {
        let drive = DriveConfig {
            id: "disk0".to_string(),
            file: "/path/to/disk.qcow2".to_string(),
            format: "qcow2".to_string(),
            interface: "virtio".to_string(),
        };

        let mut net_opts = HashMap::new();
        net_opts.insert("hostfwd".to_string(), "tcp::2222-:22".to_string());

        let netdev = NetdevConfig {
            id: "net0".to_string(),
            kind: "user".to_string(),
            options: net_opts,
        };

        let display = DisplayConfig {
            kind: "spice".to_string(),
            port: Some(5900),
            options: Default::default(),
        };

        let cmd = QemuCommand::new()
            .machine(MachineType::Q35)
            .accel(Accelerator::Hvf)
            .cpu(4)
            .expect("cpu should work")
            .memory(4096)
            .expect("memory should work")
            .drive(drive)
            .netdev(netdev)
            .display(display)
            .usb_tablet();

        let args = cmd.build();
        
        // Verify all major components present
        assert!(args.contains(&"-machine".to_string()));
        assert!(args.contains(&"-accel".to_string()));
        assert!(args.contains(&"-smp".to_string()));
        assert!(args.contains(&"-m".to_string()));
        assert!(args.contains(&"-drive".to_string()));
        assert!(args.contains(&"-netdev".to_string()));
        assert!(args.contains(&"-spice".to_string()));
        assert!(args.contains(&"-device".to_string()));
        
        // Command string should be valid
        let cmd_str = cmd.build_string();
        assert!(!cmd_str.is_empty());
        assert!(cmd_str.contains("qemu-system-x86_64"));
    }
}
