# Markdown Viewer

A real-time markdown viewer built with Rust, featuring live file watching and automatic browser updates.

## Features

- **Real-time file watching**: Automatically refreshes when markdown files are modified
- **Sidebar file browser**: Easy navigation through your markdown files
- **GitHub Flavored Markdown (GFM)**: Tables, task lists, strikethrough, and more
- **Code syntax highlighting**: Powered by highlight.js
- **LaTeX math equations**: Beautiful math rendering with KaTeX
- **Mermaid diagrams**: Create flowcharts, sequence diagrams, and more
- **Fast and lightweight**: Built with Rust and actix-web

## Installation

### Prerequisites

- Rust (1.70 or later)

### Build from source

```bash
git clone <repository-url>
cd md_viewer
cargo build --release
```

The compiled binary will be at `target/release/md_viewer`.

### Install

```bash
cargo install --path .
```

## Usage

```bash
md_viewer [OPTIONS] <DIRECTORY>

Arguments:
  <DIRECTORY>  Directory to watch for markdown files

Options:
  -H, --host <HOST>        Host to bind the server to [default: 127.0.0.1]
  -p, --port <PORT>        Port to bind the server to [default: 8080]
      --no-browser         Don't auto-open browser
      --debounce <MS>      File change debounce time in milliseconds [default: 300]
  -h, --help               Print help
```

### Examples

```bash
# Watch current directory
md_viewer .

# Watch a specific directory
md_viewer ~/Documents/notes

# Use a different port
md_viewer -p 3000 ~/Documents/notes

# Don't auto-open browser
md_viewer --no-browser ~/Documents/notes
```

## Development

```bash
# Run in development mode
cargo run -- ./test_docs

# Run tests
cargo test

# Build for release
cargo build --release
```

## Architecture

- **Backend**: Rust with actix-web
- **File watching**: notify crate with debouncing
- **Real-time updates**: WebSocket connections
- **Markdown parsing**: pulldown-cmark with GFM extensions
- **Frontend**: Vanilla JavaScript (no build step required)

## Project Structure

```
md_viewer/
├── src/
│   ├── main.rs           # Entry point and HTTP server
│   ├── config.rs         # CLI configuration
│   ├── markdown.rs       # Markdown parsing
│   ├── file_watcher.rs   # File system watching
│   ├── file_browser.rs   # Directory tree generation
│   ├── websocket.rs      # WebSocket handler
│   └── routes.rs         # HTTP API endpoints
├── static/
│   ├── css/              # Stylesheets
│   ├── js/               # Frontend JavaScript
│   └── vendor/           # Third-party libraries
└── Cargo.toml            # Dependencies
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
