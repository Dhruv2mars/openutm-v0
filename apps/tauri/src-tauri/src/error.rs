use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Error, Debug)]
pub enum Error {
    #[error("QEMU not found")]
    QemuNotFound,

    #[error("QEMU error: {0}")]
    QemuError(String),

    #[error("VM error: {0}")]
    VMError(String),

    #[error("Platform error: {0}")]
    PlatformError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Invalid VM configuration: {0}")]
    InvalidConfig(String),
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
