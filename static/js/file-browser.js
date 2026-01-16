// Version: 2026-01-16-v2
class FileBrowser {
    constructor(container) {
        this.container = container;
        this.currentFile = null;
        this.listeners = {};
        this.collapsedDirs = new Set();
        console.log('FileBrowser initialized - v2');
    }

    async loadFiles() {
        try {
            const response = await fetch('/api/files');
            const tree = await response.json();
            // Initialize collapsed state: collapse all directories except top level
            this.initializeCollapsedState(tree);
            this.render(tree);
        } catch (e) {
            console.error('Failed to load files:', e);
            this.container.innerHTML = '<div class="error">Failed to load files</div>';
        }
    }

    initializeCollapsedState(node, level = 0) {
        console.log('initializeCollapsedState called, level:', level, 'node:', node.name);
        if (node.children) {
            node.children.forEach(child => {
                const childLevel = level + 1;
                console.log('Processing child:', child.name, 'at level', childLevel);

                // Collapse all directories at level 2 and deeper
                // level 0 = root, level 1 = top-level dirs (keep open), level 2+ = collapse
                if (child.children && childLevel >= 2) {
                    this.collapsedDirs.add(child.path);
                    console.log('Collapsing:', child.path, 'at level', childLevel);
                }
                if (child.children) {
                    this.initializeCollapsedState(child, childLevel);
                }
            });
        }
    }

    render(node, parent = this.container, level = 0) {
        if (level === 0) {
            this.container.innerHTML = '';
        }

        if (node.children && node.children.length > 0) {
            const dirDiv = document.createElement('div');
            dirDiv.className = 'tree-node';

            const itemDiv = document.createElement('div');
            itemDiv.className = 'tree-item directory';
            itemDiv.style.paddingLeft = (level * 8) + 'px';

            const isCollapsed = this.collapsedDirs.has(node.path);

            const icon = document.createElement('span');
            icon.className = 'tree-item-icon';
            icon.textContent = isCollapsed ? '▸' : '▾';

            const name = document.createElement('span');
            name.className = 'tree-item-name';
            name.textContent = node.name;

            itemDiv.appendChild(icon);
            itemDiv.appendChild(name);
            dirDiv.appendChild(itemDiv);

            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-children';
            if (isCollapsed) {
                childrenDiv.classList.add('collapsed');
            }

            itemDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                // Check current state dynamically
                const isCurrentlyCollapsed = this.collapsedDirs.has(node.path);

                if (isCurrentlyCollapsed) {
                    this.collapsedDirs.delete(node.path);
                    icon.textContent = '▾';
                    childrenDiv.classList.remove('collapsed');
                } else {
                    this.collapsedDirs.add(node.path);
                    icon.textContent = '▸';
                    childrenDiv.classList.add('collapsed');
                }
            });

            dirDiv.appendChild(childrenDiv);
            parent.appendChild(dirDiv);

            node.children.forEach(child => {
                this.render(child, childrenDiv, level + 1);
            });
        } else if (!node.is_dir) {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'tree-item';
            fileDiv.style.paddingLeft = (level * 8) + 'px';
            fileDiv.dataset.path = node.path;

            if (this.currentFile === node.path) {
                fileDiv.classList.add('active');
            }

            const icon = document.createElement('span');
            icon.className = 'tree-item-icon';
            icon.textContent = '📄';

            const name = document.createElement('span');
            name.className = 'tree-item-name';
            name.textContent = node.name;

            fileDiv.appendChild(icon);
            fileDiv.appendChild(name);

            fileDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectFile(node.path);
            });

            parent.appendChild(fileDiv);
        }
    }

    selectFile(path) {
        this.currentFile = path;
        
        this.container.querySelectorAll('.tree-item.active').forEach(el => {
            el.classList.remove('active');
        });

        this.container.querySelectorAll('.tree-item').forEach(el => {
            if (el.dataset.path === path) {
                el.classList.add('active');
            }
        });

        this.emit('file-selected', path);
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}
