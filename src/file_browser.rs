use ignore::WalkBuilder;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified: Option<u64>,
}

pub fn build_file_tree(root: &Path) -> anyhow::Result<FileNode> {
    let root_name = root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(".")
        .to_string();

    let mut root_node = FileNode {
        name: root_name,
        path: String::from("/"),
        is_dir: true,
        children: Some(Vec::new()),
        modified: None,
    };

    let mut entries: Vec<(PathBuf, bool, Option<SystemTime>)> = Vec::new();

    // Use ignore crate to respect .gitignore
    for result in WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .build()
    {
        match result {
            Ok(entry) => {
                let path = entry.path();
                if path == root {
                    continue;
                }

                let is_md_file = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e == "md" || e == "markdown")
                    .unwrap_or(false);

                let is_dir = path.is_dir();

                if is_md_file || is_dir {
                    let modified = entry.metadata().ok().and_then(|m| m.modified().ok());
                    entries.push((path.to_path_buf(), is_dir, modified));
                }
            }
            Err(e) => {
                log::warn!("Error walking directory: {}", e);
            }
        }
    }

    // Sort: directories first, then by name
    entries.sort_by(|a, b| {
        match (a.1, b.1) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.0.cmp(&b.0),
        }
    });

    for (path, is_dir, modified) in entries {
        add_to_tree(&mut root_node, root, &path, is_dir, modified);
    }

    Ok(root_node)
}

fn add_to_tree(
    root: &mut FileNode,
    base_path: &Path,
    file_path: &Path,
    is_dir: bool,
    modified: Option<SystemTime>,
) {
    let relative_path = file_path.strip_prefix(base_path).unwrap();
    let components: Vec<_> = relative_path.components().collect();

    let mut current = root;

    for (i, component) in components.iter().enumerate() {
        let name = component.as_os_str().to_str().unwrap().to_string();
        let is_last = i == components.len() - 1;

        if is_last {
            // This is the file/dir we're adding
            let path_str = format!("/{}", relative_path.to_str().unwrap());
            let node = FileNode {
                name,
                path: path_str,
                is_dir,
                children: if is_dir { Some(Vec::new()) } else { None },
                modified: modified.and_then(|t| {
                    t.duration_since(SystemTime::UNIX_EPOCH)
                        .ok()
                        .map(|d| d.as_secs())
                }),
            };

            if let Some(ref mut children) = current.children {
                children.push(node);
            }
        } else {
            // This is an intermediate directory
            if let Some(ref mut children) = current.children {
                // Find the index of existing node
                let existing_idx = children.iter().position(|c| c.name == name && c.is_dir);

                if let Some(idx) = existing_idx {
                    current = &mut children[idx];
                } else {
                    let partial_path: PathBuf = components.iter().take(i + 1).collect();
                    let path_str = format!("/{}", partial_path.to_str().unwrap());

                    let new_dir = FileNode {
                        name,
                        path: path_str,
                        is_dir: true,
                        children: Some(Vec::new()),
                        modified: None,
                    };
                    children.push(new_dir);
                    let idx = children.len() - 1;
                    current = &mut children[idx];
                }
            }
        }
    }
}
