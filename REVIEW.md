# Code Review Guidelines

## Always check
- Path traversal vulnerabilities in route handlers (src/routes.rs)
- WebSocket message handling doesn't panic on malformed input
- File watcher events are properly debounced
- New dependencies are justified and well-maintained

## Code quality
- Give each function a single responsibility; extract when logic is mixed
- Use early returns and guard clauses to keep nesting shallow
- Keep names under 3 words; prefer `list_md_files` over `get_all_markdown_files_from_directory`
- Keep only live code; clean up unused imports and commented-out blocks
- Keep functions short enough to read without scrolling

## Style
- Rust code follows idiomatic patterns (Result/Option chaining over nested matches)
- Frontend JS uses vanilla ES6+ without build tools
- Error messages are user-friendly, not exposing internal paths

## Skip
- Vendored libraries under static/vendor/
- Generated files under target/
