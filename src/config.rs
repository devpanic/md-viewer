use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug, Clone)]
#[command(name = "md_viewer")]
#[command(about = "A real-time markdown viewer with live file watching", long_about = None)]
pub struct Config {
    /// Directory to watch for markdown files
    #[arg(value_name = "DIRECTORY")]
    pub watch_dir: PathBuf,

    /// Host to bind the server to
    #[arg(short = 'H', long, default_value = "127.0.0.1")]
    pub host: String,

    /// Port to bind the server to
    #[arg(short, long, default_value = "8080")]
    pub port: u16,

    /// Don't auto-open browser
    #[arg(long)]
    pub no_browser: bool,

    /// File change debounce time in milliseconds
    #[arg(long, default_value = "300")]
    pub debounce_ms: u64,
}

impl Config {
    pub fn parse_args() -> Self {
        Config::parse()
    }

    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    pub fn server_url(&self) -> String {
        format!("http://{}:{}", self.host, self.port)
    }
}
