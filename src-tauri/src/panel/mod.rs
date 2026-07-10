#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(target_os = "macos"))]
mod desktop;

#[cfg(target_os = "macos")]
pub use macos::*;
#[cfg(not(target_os = "macos"))]
pub use desktop::*;
