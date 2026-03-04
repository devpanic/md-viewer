class TabManager {
    constructor() {
        this.tabs = new Map();
        this.tabOrder = [];
        this.panes = {};
        this.activePaneId = '1';
        this.isSplit = false;
        this.nextTabId = 1;
    }

    init() {
        this.paneContainer = document.getElementById('pane-container');
        this.splitToggleBtn = document.getElementById('split-toggle-btn');
        this.tabBarEl = document.getElementById('unified-tab-bar');

        ['1', '2'].forEach(id => {
            const paneEl = document.getElementById('pane-' + id);
            const viewerContainer = document.getElementById('markdown-viewer-' + id);
            const viewer = new MarkdownViewer(viewerContainer);
            const contentEl = document.getElementById('pane-content-' + id);

            viewer.onLinkClick = (envId, projectId, path) => {
                const paneId = this.getPaneIdForViewer(viewer);
                return this.openTabInPane(envId, projectId, path, paneId || this.activePaneId);
            };

            this.panes[id] = {
                el: paneEl,
                contentEl: contentEl,
                viewerContainer: viewerContainer,
                viewer: viewer,
                activeTabId: null
            };

            paneEl.addEventListener('click', () => {
                if (this.isSplit) {
                    this.setActivePane(id);
                }
            });
        });

        this.splitToggleBtn.addEventListener('click', () => {
            this.toggleSplitView();
        });
    }

    getPaneIdForViewer(viewer) {
        for (const [id, pane] of Object.entries(this.panes)) {
            if (pane.viewer === viewer) return id;
        }
        return null;
    }

    generateTabId() {
        return 'tab-' + (this.nextTabId++);
    }

    getTabKey(envId, projectId, path) {
        return envId + ':' + projectId + ':' + path;
    }

    findTabByPath(envId, projectId, path) {
        const key = this.getTabKey(envId, projectId, path);
        for (const [, tab] of this.tabs) {
            if (this.getTabKey(tab.envId, tab.projectId, tab.path) === key) {
                return tab;
            }
        }
        return null;
    }

    // Which pane is currently displaying this tab? (null if none visible)
    findPaneShowingTab(tabId) {
        for (const [id, pane] of Object.entries(this.panes)) {
            if (pane.activeTabId === tabId) {
                if (id === '1' || this.isSplit) return id;
            }
        }
        return null;
    }

    // Left-click: open tab in active pane (or focus pane already showing it)
    openTab(envId, projectId, path) {
        const existing = this.findTabByPath(envId, projectId, path);
        if (existing) {
            const showingIn = this.findPaneShowingTab(existing.id);
            if (showingIn) {
                this.setActivePane(showingIn);
                this.renderTabBar();
                return Promise.resolve();
            }
            return this.showTabInPane(existing.id, this.activePaneId);
        }
        return this.createAndShowTab(envId, projectId, path, this.activePaneId);
    }

    // Context-menu: open tab in a specific pane
    openTabInPane(envId, projectId, path, paneId) {
        const existing = this.findTabByPath(envId, projectId, path);
        if (existing) {
            this.setActivePane(paneId);
            return this.showTabInPane(existing.id, paneId);
        }
        return this.createAndShowTab(envId, projectId, path, paneId);
    }

    async createAndShowTab(envId, projectId, path, paneId) {
        const tabId = this.generateTabId();
        const label = path.split('/').pop() || path;
        const tab = { id: tabId, envId, projectId, path, label, scrollPositions: {} };

        this.tabs.set(tabId, tab);
        this.tabOrder.push(tabId);

        this.setActivePane(paneId);
        await this.showTabInPane(tabId, paneId);
    }

    async showTabInPane(tabId, paneId) {
        const tab = this.tabs.get(tabId);
        const pane = this.panes[paneId];
        if (!tab || !pane) return;

        this.saveScrollPosition(paneId);

        pane.activeTabId = tabId;
        this.renderTabBar();

        await pane.viewer.loadFile(tab.envId, tab.projectId, tab.path);
        pane.contentEl.scrollTop = tab.scrollPositions[paneId] || 0;
    }

    closeTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        const idx = this.tabOrder.indexOf(tabId);
        if (idx === -1) return;

        this.tabOrder.splice(idx, 1);
        this.tabs.delete(tabId);

        // Update every pane that was showing this tab
        for (const [paneId, pane] of Object.entries(this.panes)) {
            if (pane.activeTabId !== tabId) continue;

            if (this.tabOrder.length > 0) {
                const newIdx = Math.min(idx, this.tabOrder.length - 1);
                const newTabId = this.tabOrder[newIdx];
                pane.activeTabId = newTabId;
                const newTab = this.tabs.get(newTabId);
                if (newTab) {
                    pane.viewer.loadFile(newTab.envId, newTab.projectId, newTab.path).then(() => {
                        pane.contentEl.scrollTop = newTab.scrollPositions[paneId] || 0;
                    });
                }
            } else {
                pane.activeTabId = null;
                this.showWelcome(paneId);
            }
        }

        this.renderTabBar();
    }

    saveScrollPosition(paneId) {
        const pane = this.panes[paneId];
        if (!pane || !pane.activeTabId) return;
        const tab = this.tabs.get(pane.activeTabId);
        if (tab) {
            tab.scrollPositions[paneId] = pane.contentEl.scrollTop;
        }
    }

    setActivePane(paneId) {
        this.activePaneId = paneId;
        for (const [id, pane] of Object.entries(this.panes)) {
            pane.el.classList.toggle('active-pane', id === paneId);
        }
    }

    toggleSplitView() {
        if (this.isSplit) {
            this.closeSplitView();
        } else {
            this.isSplit = true;
            this.panes['2'].el.style.display = '';
            this.splitToggleBtn.classList.add('active');
            this.renderTabBar();
        }
    }

    closeSplitView() {
        const pane2 = this.panes['2'];
        const pane1 = this.panes['1'];

        // If pane-1 has nothing but pane-2 does, move it over
        if (pane2.activeTabId && !pane1.activeTabId) {
            const tab = this.tabs.get(pane2.activeTabId);
            if (tab) {
                pane1.activeTabId = pane2.activeTabId;
                pane1.viewer.loadFile(tab.envId, tab.projectId, tab.path);
            }
        }

        pane2.activeTabId = null;
        this.showWelcome('2');

        this.isSplit = false;
        pane2.el.style.display = 'none';
        this.splitToggleBtn.classList.remove('active');
        this.setActivePane('1');
        this.renderTabBar();
    }

    showWelcome(paneId) {
        const pane = this.panes[paneId];
        pane.viewer.container.innerHTML =
            '<div class="welcome">' +
                '<h1>Markdown Viewer</h1>' +
                '<p>Select a markdown file from the sidebar to view it here.</p>' +
            '</div>';
    }

    renderTabBar() {
        this.tabBarEl.innerHTML = '';

        this.tabOrder.forEach(tabId => {
            const tab = this.tabs.get(tabId);
            if (!tab) return;

            const tabEl = document.createElement('div');
            tabEl.className = 'viewer-tab';

            // Determine which pane is showing this tab
            const paneShowing = this.findPaneShowingTab(tabId);
            if (paneShowing) {
                tabEl.classList.add('active');
                if (this.isSplit) {
                    tabEl.classList.add('pane-' + paneShowing);
                }
            }

            // Pane indicator badge (split mode only)
            if (paneShowing && this.isSplit) {
                const indicator = document.createElement('span');
                indicator.className = 'viewer-tab-pane-indicator';
                indicator.textContent = paneShowing;
                tabEl.appendChild(indicator);
            }

            const labelEl = document.createElement('span');
            labelEl.className = 'viewer-tab-label';
            labelEl.textContent = tab.label;
            tabEl.appendChild(labelEl);

            const closeEl = document.createElement('button');
            closeEl.className = 'viewer-tab-close';
            closeEl.innerHTML = '&times;';
            closeEl.title = '닫기';
            closeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.closeTab(tabId);
            });
            tabEl.appendChild(closeEl);

            // Left click: show in active pane, or focus pane already showing it
            tabEl.addEventListener('click', (e) => {
                if (e.target.closest('.viewer-tab-close')) return;
                e.stopPropagation();

                const showingIn = this.findPaneShowingTab(tabId);
                if (showingIn) {
                    this.setActivePane(showingIn);
                    this.renderTabBar();
                } else {
                    this.showTabInPane(tabId, this.activePaneId);
                }
            });

            // Middle click: close
            tabEl.addEventListener('mousedown', (e) => {
                if (e.button === 1) {
                    e.preventDefault();
                    this.closeTab(tabId);
                }
            });

            this.tabBarEl.appendChild(tabEl);
        });
    }

    refreshTabsByPath(filePath) {
        for (const [tabId, tab] of this.tabs) {
            if (filePath.endsWith(tab.path)) {
                for (const [, pane] of Object.entries(this.panes)) {
                    if (pane.activeTabId === tabId) {
                        pane.viewer.refresh();
                    }
                }
            }
        }
    }
}
