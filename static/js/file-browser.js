// Version: 2026-01-28-hierarchical
class FileBrowser {
    constructor(container) {
        this.container = container;
        this.currentFile = null;
        this.listeners = {};
        this.collapsedNodes = new Set(); // Track collapsed state by path
        this.projectFileCache = new Map(); // Cache loaded project files
        this.config = null; // Store project tree config
        console.log('FileBrowser initialized - hierarchical version');
    }

    async loadProjectTree() {
        try {
            const response = await fetch('/api/project-tree');
            if (!response.ok) throw new Error('Failed to load project tree');

            this.config = await response.json();
            this.initializeCollapsedState();
            await this.render();
        } catch (e) {
            console.error('Failed to load project tree:', e);
            this.container.innerHTML = '<div class="error">Failed to load projects</div>';
        }
    }

    initializeCollapsedState() {
        if (!this.config) return;

        // Collapse all non-current environments
        this.config.environments.forEach(env => {
            if (env.id !== this.config.curr_env) {
                this.collapsedNodes.add(`env:${env.id}`);
            }

            // Collapse all projects (including current one by default)
            env.projects.forEach(project => {
                this.collapsedNodes.add(`project:${env.id}:${project.id}`);
            });
        });

        console.log('Initialized collapsed state:', Array.from(this.collapsedNodes));
    }

    async render() {
        if (!this.config) return;

        this.container.innerHTML = '';

        for (const env of this.config.environments) {
            await this.renderEnvironment(env);
        }
    }

    async renderEnvironment(env) {
        const envDiv = document.createElement('div');
        envDiv.className = 'tree-node env-node';

        const isCurrentEnv = env.id === this.config.curr_env;
        const envKey = `env:${env.id}`;
        const isCollapsed = this.collapsedNodes.has(envKey);

        // Environment header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'tree-item environment';
        if (isCurrentEnv) headerDiv.classList.add('current-env');
        headerDiv.style.paddingLeft = '8px';

        const icon = document.createElement('span');
        icon.className = 'tree-item-icon';
        icon.textContent = isCollapsed ? '▸' : '▾';

        const name = document.createElement('span');
        name.className = 'tree-item-name';
        name.textContent = env.name;
        if (isCurrentEnv) name.textContent += ' (현재)';

        headerDiv.appendChild(icon);
        headerDiv.appendChild(name);

        headerDiv.addEventListener('click', async (e) => {
            e.stopPropagation();

            if (this.collapsedNodes.has(envKey)) {
                this.collapsedNodes.delete(envKey);
            } else {
                this.collapsedNodes.add(envKey);
            }

            await this.render();
        });

        envDiv.appendChild(headerDiv);

        // Projects container
        if (!isCollapsed) {
            const projectsDiv = document.createElement('div');
            projectsDiv.className = 'tree-children';

            for (const project of env.projects) {
                await this.renderProject(projectsDiv, env, project);
            }

            envDiv.appendChild(projectsDiv);
        }

        this.container.appendChild(envDiv);
    }

    async renderProject(parent, env, project) {
        const projectDiv = document.createElement('div');
        projectDiv.className = 'tree-node project-node';

        const isCurrentProject = env.id === this.config.curr_env && project.id === env.curr_prj;
        const projectKey = `project:${env.id}:${project.id}`;
        const isCollapsed = this.collapsedNodes.has(projectKey);

        // Project header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'tree-item project';
        if (isCurrentProject) headerDiv.classList.add('current-project');
        headerDiv.style.paddingLeft = '16px';

        const icon = document.createElement('span');
        icon.className = 'tree-item-icon';
        icon.textContent = isCollapsed ? '▸' : '▾';

        const name = document.createElement('span');
        name.className = 'tree-item-name';
        name.textContent = project.name;

        headerDiv.appendChild(icon);
        headerDiv.appendChild(name);

        headerDiv.addEventListener('click', async (e) => {
            e.stopPropagation();

            // Toggle collapse
            if (this.collapsedNodes.has(projectKey)) {
                this.collapsedNodes.delete(projectKey);

                // Load files if not cached
                if (!this.projectFileCache.has(projectKey)) {
                    await this.loadProjectFiles(env.id, project.id);
                }
            } else {
                this.collapsedNodes.add(projectKey);
            }

            // Update current project locally (no server call)
            if (!isCurrentProject) {
                const currentEnv = this.config.environments.find(e => e.id === this.config.curr_env);
                if (currentEnv) {
                    currentEnv.curr_prj = project.id;
                }

                // Emit event for other components
                this.emit('project-changed', { envId: env.id, projectId: project.id });
            }

            await this.render();
        });

        projectDiv.appendChild(headerDiv);

        // Files container (lazy loaded)
        if (!isCollapsed) {
            const filesDiv = document.createElement('div');
            filesDiv.className = 'tree-children';

            const fileTree = this.projectFileCache.get(projectKey);

            if (!fileTree) {
                // Show loading indicator
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'tree-item loading';
                loadingDiv.style.paddingLeft = '24px';
                loadingDiv.textContent = '로딩 중...';
                filesDiv.appendChild(loadingDiv);

                // Load in background
                this.loadProjectFiles(env.id, project.id).then(() => {
                    this.render();
                });
            } else {
                // Render file tree (skip root node, render children directly)
                if (fileTree.children && fileTree.children.length > 0) {
                    fileTree.children.forEach(child => {
                        this.renderFileNode(filesDiv, child, 3, `${projectKey}:`, env.id, project.id);
                    });
                } else {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'tree-item empty';
                    emptyDiv.style.paddingLeft = '24px';
                    emptyDiv.textContent = '파일이 없습니다';
                    filesDiv.appendChild(emptyDiv);
                }
            }

            projectDiv.appendChild(filesDiv);
        }

        parent.appendChild(projectDiv);
    }

    renderFileNode(parent, node, level, pathPrefix, envId, projectId) {
        if (node.is_dir) {
            // Directory
            const dirDiv = document.createElement('div');
            dirDiv.className = 'tree-node';

            const nodeKey = `${pathPrefix}${node.path}`;
            const isCollapsed = this.collapsedNodes.has(nodeKey);

            const itemDiv = document.createElement('div');
            itemDiv.className = 'tree-item directory';
            itemDiv.style.paddingLeft = (level * 8) + 'px';

            const icon = document.createElement('span');
            icon.className = 'tree-item-icon';
            icon.textContent = isCollapsed ? '▸' : '▾';

            const name = document.createElement('span');
            name.className = 'tree-item-name';
            name.textContent = node.name;

            itemDiv.appendChild(icon);
            itemDiv.appendChild(name);

            itemDiv.addEventListener('click', (e) => {
                e.stopPropagation();

                if (this.collapsedNodes.has(nodeKey)) {
                    this.collapsedNodes.delete(nodeKey);
                    icon.textContent = '▾';
                    childrenDiv.classList.remove('collapsed');
                } else {
                    this.collapsedNodes.add(nodeKey);
                    icon.textContent = '▸';
                    childrenDiv.classList.add('collapsed');
                }
            });

            dirDiv.appendChild(itemDiv);

            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-children';
            if (isCollapsed) {
                childrenDiv.classList.add('collapsed');
            }

            if (node.children) {
                node.children.forEach(child => {
                    this.renderFileNode(childrenDiv, child, level + 1, pathPrefix, envId, projectId);
                });
            }

            dirDiv.appendChild(childrenDiv);
            parent.appendChild(dirDiv);
        } else {
            // File
            const fileDiv = document.createElement('div');
            fileDiv.className = 'tree-item file';
            fileDiv.style.paddingLeft = (level * 8) + 'px';
            fileDiv.dataset.path = node.path;
            fileDiv.dataset.envId = envId;
            fileDiv.dataset.projectId = projectId;

            const fileKey = `${envId}:${projectId}:${node.path}`;
            if (this.currentFile === fileKey) {
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
                this.selectFile(envId, projectId, node.path);
            });

            parent.appendChild(fileDiv);
        }
    }

    async loadProjectFiles(envId, projectId) {
        const projectKey = `project:${envId}:${projectId}`;

        try {
            const response = await fetch(`/api/project-files/${envId}/${projectId}`);
            if (!response.ok) throw new Error('Failed to load project files');

            const fileTree = await response.json();
            this.projectFileCache.set(projectKey, fileTree);

            // Initialize collapsed state for all folders in this project
            this.initializeFileTreeCollapsedState(fileTree, projectKey);

            console.log('Loaded files for project:', projectKey);
        } catch (e) {
            console.error('Error loading project files:', e);
        }
    }

    initializeFileTreeCollapsedState(node, pathPrefix) {
        if (node.children) {
            node.children.forEach(child => {
                if (child.is_dir) {
                    // Collapse all folders by default
                    this.collapsedNodes.add(`${pathPrefix}:${child.path}`);
                    this.initializeFileTreeCollapsedState(child, pathPrefix);
                }
            });
        }
    }


    selectFile(envId, projectId, path) {
        const fileKey = `${envId}:${projectId}:${path}`;
        this.currentFile = fileKey;

        this.container.querySelectorAll('.tree-item.active').forEach(el => {
            el.classList.remove('active');
        });

        this.container.querySelectorAll('.tree-item.file').forEach(el => {
            if (el.dataset.envId === envId && el.dataset.projectId === projectId && el.dataset.path === path) {
                el.classList.add('active');
            }
        });

        this.emit('file-selected', { envId, projectId, path });
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
