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
                // Environment-level favorite
                if (!fav.project_id) {
                    this.renderFavoriteEnv(list, fav);
                    return;
                }

                // Find project name for sublabel
                let projectLabel = '';
                for (const env of this.config.environments) {
                    const prj = env.projects.find(p => p.id === fav.project_id && env.id === fav.env_id);
                    if (prj) {
                        projectLabel = prj.name;
                        break;
                    }
                }

                // Project-level favorite (project_id set, path empty)
                if (!fav.path) {
                    this.renderFavoriteProject(list, fav);
                    return;
                }

                if (fav.is_dir) {
                    this.renderFavoriteDir(list, fav, projectLabel);
                } else {
                    this.renderFavoriteFile(list, fav, projectLabel);
                }
            });

            section.appendChild(list);
        }

        this.container.appendChild(section);
    }

    renderFavoriteFile(parent, fav, projectLabel) {
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
                x: e.clientX, y: e.clientY,
                type: 'favorite',
                envId: fav.env_id, projectId: fav.project_id,
                path: fav.path, isDir: false
            });
        });

        parent.appendChild(item);
    }

    renderFavoriteEnv(parent, fav) {
        const favEnvKey = `fav-env:${fav.env_id}`;
        const isCollapsed = this.collapsedNodes.has(favEnvKey);

        // Find the environment data
        const env = this.config.environments.find(e => e.id === fav.env_id);

        const wrapper = document.createElement('div');
        wrapper.className = 'tree-favorite-dir-wrapper';

        // Header row
        const header = document.createElement('div');
        header.className = 'tree-favorite-item tree-favorite-dir-header';

        const chevron = document.createElement('span');
        chevron.className = 'tree-chevron' + (isCollapsed ? '' : ' open');
        chevron.innerHTML = this.svgChevron();

        const envIcon = document.createElement('span');
        envIcon.className = 'tree-icon';
        envIcon.innerHTML = this.svgServer();

        const nameEl = document.createElement('span');
        nameEl.className = 'tree-label';
        nameEl.textContent = env ? env.name : fav.name;

        header.appendChild(chevron);
        header.appendChild(envIcon);
        header.appendChild(nameEl);

        header.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (this.collapsedNodes.has(favEnvKey)) {
                this.collapsedNodes.delete(favEnvKey);
            } else {
                this.collapsedNodes.add(favEnvKey);
            }
            await this.render();
        });

        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.emit('favorite-context-menu', {
                x: e.clientX, y: e.clientY,
                type: 'favorite',
                envId: fav.env_id, projectId: '',
                path: '', isDir: false, isEnv: true
            });
        });

        wrapper.appendChild(header);

        // Children: show projects when expanded
        if (!isCollapsed && env) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-favorites-dir-children';

            if (env.projects.length > 0) {
                for (const project of env.projects) {
                    const projectKey = `project:${env.id}:${project.id}`;
                    const projIsCollapsed = this.collapsedNodes.has(`fav-env-prj:${env.id}:${project.id}`);

                    const projHeader = document.createElement('div');
                    projHeader.className = 'tree-favorite-item tree-favorite-dir-header';

                    const projChevron = document.createElement('span');
                    projChevron.className = 'tree-chevron' + (projIsCollapsed ? '' : ' open');
                    projChevron.innerHTML = this.svgChevron();

                    const projIcon = document.createElement('span');
                    projIcon.className = 'tree-icon';
                    projIcon.innerHTML = this.svgProject();

                    const projLabel = document.createElement('span');
                    projLabel.className = 'tree-label';
                    projLabel.textContent = project.name;

                    projHeader.appendChild(projChevron);
                    projHeader.appendChild(projIcon);
                    projHeader.appendChild(projLabel);

                    projHeader.addEventListener('click', async (ev) => {
                        ev.stopPropagation();
                        const key = `fav-env-prj:${env.id}:${project.id}`;
                        if (!this.projectFileCache.has(projectKey)) {
                            await this.loadProjectFiles(env.id, project.id);
                        }
                        if (this.collapsedNodes.has(key)) {
                            this.collapsedNodes.delete(key);
                        } else {
                            this.collapsedNodes.add(key);
                        }
                        await this.render();
                    });

                    childrenDiv.appendChild(projHeader);

                    // Project files when expanded
                    if (!projIsCollapsed) {
                        const filesDiv = document.createElement('div');
                        filesDiv.className = 'tree-favorites-dir-children';

                        const fileTree = this.projectFileCache.get(projectKey);
                        if (!fileTree) {
                            const loadingEl = document.createElement('div');
                            loadingEl.className = 'tree-file';
                            loadingEl.innerHTML = '<span class="tree-label" style="color: var(--text-muted); font-style: italic;">로딩 중...</span>';
                            filesDiv.appendChild(loadingEl);
                            this.loadProjectFiles(env.id, project.id).then(() => this.render());
                        } else if (fileTree.children && fileTree.children.length > 0) {
                            fileTree.children.forEach(child => {
                                this.renderFileNode(filesDiv, child, `${projectKey}:`, env.id, project.id);
                            });
                        }

                        childrenDiv.appendChild(filesDiv);
                    }
                }
            } else {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'tree-file';
                emptyEl.innerHTML = '<span class="tree-label" style="color: var(--text-muted); font-style: italic;">프로젝트 없음</span>';
                childrenDiv.appendChild(emptyEl);
            }

            wrapper.appendChild(childrenDiv);
        }

        parent.appendChild(wrapper);
    }

    renderFavoriteProject(parent, fav) {
        const favPrjKey = `fav-prj:${fav.env_id}:${fav.project_id}`;
        const isCollapsed = this.collapsedNodes.has(favPrjKey);
        const projectKey = `project:${fav.env_id}:${fav.project_id}`;

        // Find project data
        let project = null;
        let envName = '';
        for (const env of this.config.environments) {
            if (env.id === fav.env_id) {
                envName = env.name;
                project = env.projects.find(p => p.id === fav.project_id);
                break;
            }
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'tree-favorite-dir-wrapper';

        // Header
        const header = document.createElement('div');
        header.className = 'tree-favorite-item tree-favorite-dir-header';

        const chevron = document.createElement('span');
        chevron.className = 'tree-chevron' + (isCollapsed ? '' : ' open');
        chevron.innerHTML = this.svgChevron();

        const projIcon = document.createElement('span');
        projIcon.className = 'tree-icon';
        projIcon.innerHTML = this.svgProject();

        const nameEl = document.createElement('span');
        nameEl.className = 'tree-label';
        nameEl.textContent = project ? project.name : fav.name;

        const subEl = document.createElement('span');
        subEl.className = 'tree-fav-project';
        subEl.textContent = envName;

        header.appendChild(chevron);
        header.appendChild(projIcon);
        header.appendChild(nameEl);
        header.appendChild(subEl);

        header.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!this.projectFileCache.has(projectKey)) {
                await this.loadProjectFiles(fav.env_id, fav.project_id);
            }
            if (this.collapsedNodes.has(favPrjKey)) {
                this.collapsedNodes.delete(favPrjKey);
            } else {
                this.collapsedNodes.add(favPrjKey);
            }
            await this.render();
        });

        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.emit('favorite-context-menu', {
                x: e.clientX, y: e.clientY,
                type: 'favorite',
                envId: fav.env_id, projectId: fav.project_id,
                path: '', isDir: false, isEnv: false, isProject: true
            });
        });

        wrapper.appendChild(header);

        // Files when expanded
        if (!isCollapsed) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-favorites-dir-children';

            const fileTree = this.projectFileCache.get(projectKey);
            if (!fileTree) {
                const loadingEl = document.createElement('div');
                loadingEl.className = 'tree-file';
                loadingEl.innerHTML = '<span class="tree-label" style="color: var(--text-muted); font-style: italic;">로딩 중...</span>';
                childrenDiv.appendChild(loadingEl);
                this.loadProjectFiles(fav.env_id, fav.project_id).then(() => this.render());
            } else if (fileTree.children && fileTree.children.length > 0) {
                fileTree.children.forEach(child => {
                    this.renderFileNode(childrenDiv, child, `${projectKey}:`, fav.env_id, fav.project_id);
                });
            } else {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'tree-file';
                emptyEl.innerHTML = '<span class="tree-label" style="color: var(--text-muted); font-style: italic;">파일이 없습니다</span>';
                childrenDiv.appendChild(emptyEl);
            }

            wrapper.appendChild(childrenDiv);
        }

        parent.appendChild(wrapper);
    }

    renderFavoriteDir(parent, fav, projectLabel) {
        const favDirKey = `fav-dir:${fav.env_id}:${fav.project_id}:${fav.path}`;
        const isCollapsed = this.collapsedNodes.has(favDirKey);

        const wrapper = document.createElement('div');
        wrapper.className = 'tree-favorite-dir-wrapper';

        // Header row
        const header = document.createElement('div');
        header.className = 'tree-favorite-item tree-favorite-dir-header';

        const chevron = document.createElement('span');
        chevron.className = 'tree-chevron' + (isCollapsed ? '' : ' open');
        chevron.innerHTML = this.svgChevron();

        const folderIcon = document.createElement('span');
        folderIcon.className = 'tree-icon';
        folderIcon.innerHTML = isCollapsed ? this.svgFolder() : this.svgFolderOpen();

        const nameEl = document.createElement('span');
        nameEl.className = 'tree-label';
        nameEl.textContent = fav.name;

        const subEl = document.createElement('span');
        subEl.className = 'tree-fav-project';
        subEl.textContent = projectLabel;

        header.appendChild(chevron);
        header.appendChild(folderIcon);
        header.appendChild(nameEl);
        header.appendChild(subEl);

        header.addEventListener('click', async (e) => {
            e.stopPropagation();
            // Ensure project files are loaded
            const projectKey = `project:${fav.env_id}:${fav.project_id}`;
            if (!this.projectFileCache.has(projectKey)) {
                await this.loadProjectFiles(fav.env_id, fav.project_id);
            }
            if (this.collapsedNodes.has(favDirKey)) {
                this.collapsedNodes.delete(favDirKey);
            } else {
                this.collapsedNodes.add(favDirKey);
            }
            await this.render();
        });

        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.emit('favorite-context-menu', {
                x: e.clientX, y: e.clientY,
                type: 'favorite',
                envId: fav.env_id, projectId: fav.project_id,
                path: fav.path, isDir: true
            });
        });

        wrapper.appendChild(header);

        // Children (when expanded)
        if (!isCollapsed) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-favorites-dir-children';

            const projectKey = `project:${fav.env_id}:${fav.project_id}`;
            const fileTree = this.projectFileCache.get(projectKey);

            if (!fileTree) {
                const loadingEl = document.createElement('div');
                loadingEl.className = 'tree-file';
                loadingEl.innerHTML = '<span class="tree-label" style="color: var(--text-muted); font-style: italic;">로딩 중...</span>';
                childrenDiv.appendChild(loadingEl);

                this.loadProjectFiles(fav.env_id, fav.project_id).then(() => this.render());
            } else {
                // Find the directory node in file tree
                const dirNode = this.findNodeByPath(fileTree, fav.path);
                if (dirNode && dirNode.children) {
                    dirNode.children.forEach(child => {
                        this.renderFileNode(childrenDiv, child, `${projectKey}:`, fav.env_id, fav.project_id);
                    });
                } else {
                    const emptyEl = document.createElement('div');
                    emptyEl.className = 'tree-file';
                    emptyEl.innerHTML = '<span class="tree-label" style="color: var(--text-muted); font-style: italic;">비어 있음</span>';
                    childrenDiv.appendChild(emptyEl);
                }
            }

            wrapper.appendChild(childrenDiv);
        }

        parent.appendChild(wrapper);
    }

    findNodeByPath(tree, targetPath) {
        if (!tree.children) return null;
        const parts = targetPath.split('/').filter(p => p);
        let node = tree;
        for (const part of parts) {
            if (!node.children) return null;
            const child = node.children.find(c => c.name === part && c.is_dir);
            if (!child) return null;
            node = child;
        }
        return node;
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

        if (this.isFavorite(env.id, '', '')) {
            const favIndicator = document.createElement('span');
            favIndicator.className = 'fav-indicator';
            favIndicator.innerHTML = this.svgStarFilled();
            headerDiv.appendChild(favIndicator);
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

        if (this.isFavorite(env.id, project.id, '')) {
            const favIndicator = document.createElement('span');
            favIndicator.className = 'fav-indicator';
            favIndicator.innerHTML = this.svgStarFilled();
            headerDiv.appendChild(favIndicator);
        }

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

            dirHeader.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.emit('dir-context-menu', {
                    x: e.clientX,
                    y: e.clientY,
                    type: 'directory',
                    envId, projectId, path: node.path
                });
            });

            if (this.isFavorite(envId, projectId, node.path)) {
                const favIndicator = document.createElement('span');
                favIndicator.className = 'fav-indicator';
                favIndicator.innerHTML = this.svgStarFilled();
                dirHeader.appendChild(favIndicator);
            }

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
