// Version: 2026-03-13-redesign
class FileBrowser {
    constructor(container) {
        this.container = container;
        this.currentFile = null;
        this.listeners = {};
        this.collapsedNodes = new Set();
        this.projectFileCache = new Map();
        this.config = null;
        console.log('FileBrowser initialized - redesign version');
    }

    // SVG icon helpers
    svgChevron() {
        return '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>';
    }
    svgServer() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg>';
    }
    svgFolder() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    }
    svgFolderOpen() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 3h9a2 2 0 0 1 2 2v1M5 19h14a2 2 0 0 0 2-2l1-7H7.5"/></svg>';
    }
    svgFile() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }
    svgProject() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
    }
    svgStar() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }
    svgStarFilled() {
        return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
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

        this.config.environments.forEach(env => {
            if (env.id !== this.config.curr_env) {
                this.collapsedNodes.add(`env:${env.id}`);
            }

            env.projects.forEach(project => {
                this.collapsedNodes.add(`project:${env.id}:${project.id}`);
            });
        });
    }

    isFavorite(envId, projectId, path) {
        if (!this.config || !this.config.favorites) return false;
        return this.config.favorites.some(f =>
            f.env_id === envId && f.project_id === projectId && f.path === path
        );
    }

    async render() {
        if (!this.config) return;

        this.container.innerHTML = '';

        this.renderFavorites();

        for (const env of this.config.environments) {
            await this.renderEnvironment(env);
        }
    }

    renderFavorites() {
        const favorites = this.config.favorites || [];
        if (favorites.length === 0) return;

        const section = document.createElement('div');
        section.className = 'tree-favorites';

        const favKey = 'favorites';
        const isCollapsed = this.collapsedNodes.has(favKey);

        // Header
        const header = document.createElement('div');
        header.className = 'tree-favorites-header';

        const chevron = document.createElement('span');
        chevron.className = 'tree-chevron' + (isCollapsed ? '' : ' open');
        chevron.innerHTML = this.svgChevron();

        const icon = document.createElement('span');
        icon.className = 'tree-icon tree-fav-icon';
        icon.innerHTML = this.svgStarFilled();

        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = '즐겨찾기';

        const count = document.createElement('span');
        count.className = 'tree-fav-count';
        count.textContent = favorites.length;

        header.appendChild(chevron);
        header.appendChild(icon);
        header.appendChild(label);
        header.appendChild(count);

        header.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (this.collapsedNodes.has(favKey)) {
                this.collapsedNodes.delete(favKey);
            } else {
                this.collapsedNodes.add(favKey);
            }
            await this.render();
        });

        section.appendChild(header);

        // Favorite items
        if (!isCollapsed) {
            const list = document.createElement('div');
            list.className = 'tree-favorites-list';

            favorites.forEach(fav => {
                const item = document.createElement('div');
                item.className = 'tree-file tree-favorite-item';
                item.dataset.envId = fav.env_id;
                item.dataset.projectId = fav.project_id;
                item.dataset.path = fav.path;

                const fileIcon = document.createElement('span');
                fileIcon.className = 'tree-icon icon-md';
                fileIcon.innerHTML = this.svgFile();

                const nameEl = document.createElement('span');
                nameEl.className = 'tree-label';
                nameEl.textContent = fav.name;

                // Find project name for sublabel
                let projectLabel = '';
                for (const env of this.config.environments) {
                    const prj = env.projects.find(p => p.id === fav.project_id && env.id === fav.env_id);
                    if (prj) {
                        projectLabel = prj.name;
                        break;
                    }
                }

                const subEl = document.createElement('span');
                subEl.className = 'tree-fav-project';
                subEl.textContent = projectLabel;

                item.appendChild(fileIcon);
                item.appendChild(nameEl);
                item.appendChild(subEl);

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectFile(fav.env_id, fav.project_id, fav.path);
                });

                item.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.emit('favorite-context-menu', {
                        x: e.clientX,
                        y: e.clientY,
                        type: 'favorite',
                        envId: fav.env_id,
                        projectId: fav.project_id,
                        path: fav.path
                    });
                });

                list.appendChild(item);
            });

            section.appendChild(list);
        }

        this.container.appendChild(section);
    }

    async renderEnvironment(env) {
        const envDiv = document.createElement('div');
        envDiv.className = 'tree-env';

        const isCurrentEnv = env.id === this.config.curr_env;
        const envKey = `env:${env.id}`;
        const isCollapsed = this.collapsedNodes.has(envKey);

        // Environment header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'tree-env-header';
        if (isCurrentEnv) headerDiv.classList.add('current');

        const chevron = document.createElement('span');
        chevron.className = 'tree-chevron' + (isCollapsed ? '' : ' open');
        chevron.innerHTML = this.svgChevron();

        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.innerHTML = this.svgServer();

        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = env.name;

        headerDiv.appendChild(chevron);
        headerDiv.appendChild(icon);
        headerDiv.appendChild(label);

        if (isCurrentEnv) {
            const badge = document.createElement('span');
            badge.className = 'tree-badge';
            badge.textContent = '현재';
            headerDiv.appendChild(badge);
        }

        headerDiv.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (this.collapsedNodes.has(envKey)) {
                this.collapsedNodes.delete(envKey);
            } else {
                this.collapsedNodes.add(envKey);
            }
            await this.render();
        });

        headerDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.emit('env-context-menu', {
                x: e.clientX,
                y: e.clientY,
                type: 'environment',
                envId: env.id,
                envName: env.name
            });
        });

        envDiv.appendChild(headerDiv);

        // Projects container
        if (!isCollapsed) {
            for (const project of env.projects) {
                await this.renderProject(envDiv, env, project);
            }
        }

        this.container.appendChild(envDiv);
    }

    async renderProject(parent, env, project) {
        const isCurrentProject = env.id === this.config.curr_env && project.id === env.curr_prj;
        const projectKey = `project:${env.id}:${project.id}`;
        const isCollapsed = this.collapsedNodes.has(projectKey);

        // Project header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'tree-project-header';

        const chevron = document.createElement('span');
        chevron.className = 'tree-chevron' + (isCollapsed ? '' : ' open');
        chevron.innerHTML = this.svgChevron();

        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.innerHTML = this.svgProject();

        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = project.name;

        headerDiv.appendChild(chevron);
        headerDiv.appendChild(icon);
        headerDiv.appendChild(label);

        headerDiv.addEventListener('click', async (e) => {
            e.stopPropagation();

            if (this.collapsedNodes.has(projectKey)) {
                this.collapsedNodes.delete(projectKey);
                if (!this.projectFileCache.has(projectKey)) {
                    await this.loadProjectFiles(env.id, project.id);
                }
            } else {
                this.collapsedNodes.add(projectKey);
            }

            if (!isCurrentProject) {
                const currentEnv = this.config.environments.find(e => e.id === this.config.curr_env);
                if (currentEnv) {
                    currentEnv.curr_prj = project.id;
                }
                this.emit('project-changed', { envId: env.id, projectId: project.id });
            }

            await this.render();
        });

        headerDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.emit('project-context-menu', {
                x: e.clientX,
                y: e.clientY,
                type: 'project',
                envId: env.id,
                projectId: project.id,
                projectName: project.name,
                projectPath: project.path
            });
        });

        parent.appendChild(headerDiv);

        // Files container (lazy loaded)
        if (!isCollapsed) {
            const filesDiv = document.createElement('div');
            filesDiv.className = 'tree-files';

            const fileTree = this.projectFileCache.get(projectKey);

            if (!fileTree) {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'tree-file';
                loadingDiv.innerHTML = '<span class="tree-label" style="color: var(--text-muted); font-style: italic;">로딩 중...</span>';
                filesDiv.appendChild(loadingDiv);

                this.loadProjectFiles(env.id, project.id).then(() => {
                    this.render();
                });
            } else {
                if (fileTree.children && fileTree.children.length > 0) {
                    fileTree.children.forEach(child => {
                        this.renderFileNode(filesDiv, child, `${projectKey}:`, env.id, project.id);
                    });
                } else {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'tree-file';
                    emptyDiv.innerHTML = '<span class="tree-label" style="color: var(--text-muted); font-style: italic;">파일이 없습니다</span>';
                    filesDiv.appendChild(emptyDiv);
                }
            }

            parent.appendChild(filesDiv);
        }
    }

    renderFileNode(parent, node, pathPrefix, envId, projectId) {
        if (node.is_dir) {
            const nodeKey = `${pathPrefix}${node.path}`;
            const isCollapsed = this.collapsedNodes.has(nodeKey);

            // Directory header
            const dirHeader = document.createElement('div');
            dirHeader.className = 'tree-dir-header';

            const chevron = document.createElement('span');
            chevron.className = 'tree-chevron' + (isCollapsed ? '' : ' open');
            chevron.innerHTML = this.svgChevron();

            const icon = document.createElement('span');
            icon.className = 'tree-icon icon-folder' + (isCollapsed ? '' : '-open');
            icon.innerHTML = isCollapsed ? this.svgFolder() : this.svgFolderOpen();

            const label = document.createElement('span');
            label.className = 'tree-label';
            label.textContent = node.name;

            dirHeader.appendChild(chevron);
            dirHeader.appendChild(icon);
            dirHeader.appendChild(label);

            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-dir-children';
            if (isCollapsed) {
                childrenDiv.classList.add('collapsed');
            }

            dirHeader.addEventListener('click', (e) => {
                e.stopPropagation();

                if (this.collapsedNodes.has(nodeKey)) {
                    this.collapsedNodes.delete(nodeKey);
                    chevron.classList.add('open');
                    icon.className = 'tree-icon icon-folder-open';
                    icon.innerHTML = this.svgFolderOpen();
                    childrenDiv.classList.remove('collapsed');
                } else {
                    this.collapsedNodes.add(nodeKey);
                    chevron.classList.remove('open');
                    icon.className = 'tree-icon icon-folder';
                    icon.innerHTML = this.svgFolder();
                    childrenDiv.classList.add('collapsed');
                }
            });

            parent.appendChild(dirHeader);

            if (node.children) {
                node.children.forEach(child => {
                    this.renderFileNode(childrenDiv, child, pathPrefix, envId, projectId);
                });
            }

            parent.appendChild(childrenDiv);
        } else {
            // File
            const fileDiv = document.createElement('div');
            fileDiv.className = 'tree-file';
            fileDiv.dataset.path = node.path;
            fileDiv.dataset.envId = envId;
            fileDiv.dataset.projectId = projectId;

            const fileKey = `${envId}:${projectId}:${node.path}`;
            if (this.currentFile === fileKey) {
                fileDiv.classList.add('active');
            }

            const icon = document.createElement('span');
            icon.className = 'tree-icon icon-md';
            icon.innerHTML = this.svgFile();

            const label = document.createElement('span');
            label.className = 'tree-label';
            label.textContent = node.name;

            fileDiv.appendChild(icon);
            fileDiv.appendChild(label);

            if (this.isFavorite(envId, projectId, node.path)) {
                const favIndicator = document.createElement('span');
                favIndicator.className = 'fav-indicator';
                favIndicator.innerHTML = this.svgStarFilled();
                fileDiv.appendChild(favIndicator);
            }

            fileDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectFile(envId, projectId, node.path);
            });

            fileDiv.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.emit('file-context-menu', {
                    x: e.clientX,
                    y: e.clientY,
                    type: 'file',
                    envId, projectId, path: node.path
                });
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
                    this.collapsedNodes.add(`${pathPrefix}:${child.path}`);
                    this.initializeFileTreeCollapsedState(child, pathPrefix);
                }
            });
        }
    }

    async refreshProject(envId, projectId) {
        const projectKey = `project:${envId}:${projectId}`;
        this.projectFileCache.delete(projectKey);

        if (!this.collapsedNodes.has(projectKey)) {
            await this.loadProjectFiles(envId, projectId);
        }

        await this.render();
    }

    async refreshAllFiles() {
        this.projectFileCache.clear();

        if (this.config) {
            for (const env of this.config.environments) {
                for (const project of env.projects) {
                    const projectKey = `project:${env.id}:${project.id}`;
                    if (!this.collapsedNodes.has(projectKey)) {
                        await this.loadProjectFiles(env.id, project.id);
                    }
                }
            }
        }

        await this.render();
    }

    selectFile(envId, projectId, path) {
        const fileKey = `${envId}:${projectId}:${path}`;
        this.currentFile = fileKey;

        this.container.querySelectorAll('.tree-file.active').forEach(el => {
            el.classList.remove('active');
        });

        this.container.querySelectorAll('.tree-file').forEach(el => {
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
