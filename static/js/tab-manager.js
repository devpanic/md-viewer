class TabManager {
    constructor() {
        this.tabs = new Map();
        this.panes = {};
        this.activePaneId = '1';
        this.isSplit = false;
        this.nextTabId = 1;
        this.draggedTabId = null;
    }

    init() {
        this.paneContainer = document.getElementById('pane-container');
        this.splitToggleBtn = document.getElementById('split-toggle-btn');
        this.breadcrumbEl = document.getElementById('breadcrumb');

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
                tabBarEl: document.getElementById('pane-tab-bar-' + id),
                contentEl: contentEl,
                viewerContainer: viewerContainer,
                viewer: viewer,
                tabOrder: [],
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

        // Show welcome screen on init
        this.showWelcome('1');
        this.showWelcome('2');
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

    openTab(envId, projectId, path) {
        const existing = this.findTabByPath(envId, projectId, path);
        if (existing) {
            this.setActivePane(existing.paneId);
            this.switchTab(existing.id);
            return Promise.resolve();
        }
        return this.openTabInPane(envId, projectId, path, this.activePaneId);
    }

    async openTabInPane(envId, projectId, path, paneId) {
        const existing = this.findTabByPath(envId, projectId, path);
        if (existing) {
            if (existing.paneId !== paneId) {
                this.moveTabToPane(existing.id, paneId);
            }
            this.setActivePane(paneId);
            this.switchTab(existing.id);
            return;
        }

        const pane = this.panes[paneId];
        if (!pane) return;

        this.saveScrollPosition(paneId);

        const tabId = this.generateTabId();
        const label = path.split('/').pop() || path;
        const tab = { id: tabId, envId, projectId, path, label, paneId, scrollPosition: 0 };

        this.tabs.set(tabId, tab);
        pane.tabOrder.push(tabId);
        pane.activeTabId = tabId;

        this.setActivePane(paneId);
        this.renderTabBar(paneId);
        this.updateBreadcrumb(tab);

        await pane.viewer.loadFile(envId, projectId, path);
    }

    closeTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        const paneId = tab.paneId;
        const pane = this.panes[paneId];
        const idx = pane.tabOrder.indexOf(tabId);
        if (idx === -1) return;

        pane.tabOrder.splice(idx, 1);
        this.tabs.delete(tabId);

        if (pane.activeTabId === tabId) {
            if (pane.tabOrder.length > 0) {
                const newIdx = Math.min(idx, pane.tabOrder.length - 1);
                const newTabId = pane.tabOrder[newIdx];
                pane.activeTabId = newTabId;
                const newTab = this.tabs.get(newTabId);
                if (newTab) {
                    this.updateBreadcrumb(newTab);
                    pane.viewer.loadFile(newTab.envId, newTab.projectId, newTab.path).then(() => {
                        pane.contentEl.scrollTop = newTab.scrollPosition;
                    });
                }
            } else {
                pane.activeTabId = null;
                this.showWelcome(paneId);
                this.clearBreadcrumb();
            }
        }

        this.renderTabBar(paneId);
    }

    switchTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        const pane = this.panes[tab.paneId];
        this.saveScrollPosition(tab.paneId);

        pane.activeTabId = tabId;
        this.renderTabBar(tab.paneId);
        this.updateBreadcrumb(tab);

        pane.viewer.loadFile(tab.envId, tab.projectId, tab.path).then(() => {
            pane.contentEl.scrollTop = tab.scrollPosition;
        });
    }

    moveTabToPane(tabId, targetPaneId) {
        const tab = this.tabs.get(tabId);
        if (!tab || tab.paneId === targetPaneId) return;

        const srcPane = this.panes[tab.paneId];
        const dstPane = this.panes[targetPaneId];
        const srcPaneId = tab.paneId;

        const idx = srcPane.tabOrder.indexOf(tabId);
        if (idx !== -1) srcPane.tabOrder.splice(idx, 1);

        if (srcPane.activeTabId === tabId) {
            if (srcPane.tabOrder.length > 0) {
                const newIdx = Math.min(idx, srcPane.tabOrder.length - 1);
                srcPane.activeTabId = srcPane.tabOrder[newIdx];
                const t = this.tabs.get(srcPane.activeTabId);
                if (t) srcPane.viewer.loadFile(t.envId, t.projectId, t.path);
            } else {
                srcPane.activeTabId = null;
                this.showWelcome(srcPaneId);
            }
        }

        tab.paneId = targetPaneId;
        dstPane.tabOrder.push(tabId);

        this.renderTabBar(srcPaneId);
        this.renderTabBar(targetPaneId);
    }

    saveScrollPosition(paneId) {
        const pane = this.panes[paneId];
        if (!pane || !pane.activeTabId) return;
        const tab = this.tabs.get(pane.activeTabId);
        if (tab) {
            tab.scrollPosition = pane.contentEl.scrollTop;
        }
    }

    setActivePane(paneId) {
        this.activePaneId = paneId;
        for (const [id, pane] of Object.entries(this.panes)) {
            pane.el.classList.toggle('active-pane', id === paneId);
        }
        // Update breadcrumb for active pane's active tab
        const pane = this.panes[paneId];
        if (pane && pane.activeTabId) {
            const tab = this.tabs.get(pane.activeTabId);
            if (tab) this.updateBreadcrumb(tab);
        }
    }

    toggleSplitView() {
        if (this.isSplit) {
            this.closeSplitView();
        } else {
            this.isSplit = true;
            this.panes['2'].el.style.display = '';
            this.splitToggleBtn.classList.add('active');
        }
    }

    closeSplitView() {
        const pane2 = this.panes['2'];
        const pane1 = this.panes['1'];

        [...pane2.tabOrder].forEach(tabId => {
            const tab = this.tabs.get(tabId);
            if (tab) {
                tab.paneId = '1';
                pane1.tabOrder.push(tabId);
            }
        });

        if (!pane1.activeTabId && pane2.activeTabId) {
            pane1.activeTabId = pane2.activeTabId;
            const tab = this.tabs.get(pane1.activeTabId);
            if (tab) pane1.viewer.loadFile(tab.envId, tab.projectId, tab.path);
        }

        pane2.tabOrder = [];
        pane2.activeTabId = null;
        this.showWelcome('2');

        this.isSplit = false;
        pane2.el.style.display = 'none';
        this.splitToggleBtn.classList.remove('active');

        this.setActivePane('1');
        this.renderTabBar('1');
        this.renderTabBar('2');
    }

    showWelcome(paneId) {
        const pane = this.panes[paneId];
        pane.viewer.container.innerHTML =
            '<div class="welcome-screen">' +
                '<div class="welcome-bg"></div>' +
                '<div class="welcome-content">' +
                    '<div class="welcome-icon">' +
                        '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' +
                    '</div>' +
                    '<div class="welcome-title">Markdown Viewer</div>' +
                    '<div class="welcome-subtitle">사이드바에서 마크다운 파일을 선택하세요</div>' +
                '</div>' +
            '</div>';
    }

    updateBreadcrumb(tab) {
        if (!this.breadcrumbEl) return;
        const parts = tab.path.split('/').filter(p => p);
        const fileName = parts.pop() || tab.path;

        let html = '';
        if (tab.projectId) {
            html += '<span class="breadcrumb-item">' + this.escapeHtml(tab.projectId) + '</span>';
            html += '<span class="breadcrumb-sep">/</span>';
        }
        parts.forEach(part => {
            html += '<span class="breadcrumb-item">' + this.escapeHtml(part) + '</span>';
            html += '<span class="breadcrumb-sep">/</span>';
        });
        html += '<span class="breadcrumb-item current">' + this.escapeHtml(fileName) + '</span>';

        this.breadcrumbEl.innerHTML = html;
    }

    clearBreadcrumb() {
        if (!this.breadcrumbEl) return;
        this.breadcrumbEl.innerHTML = '<span class="breadcrumb-item">파일을 선택하세요</span>';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderTabBar(paneId) {
        const pane = this.panes[paneId];
        pane.tabBarEl.innerHTML = '';

        pane.tabOrder.forEach(tabId => {
            const tab = this.tabs.get(tabId);
            if (!tab) return;

            const tabEl = document.createElement('div');
            tabEl.className = 'pane-tab';
            tabEl.draggable = true;
            tabEl.dataset.tabId = tabId;
            if (tabId === pane.activeTabId) tabEl.classList.add('active');

            // File icon
            const iconEl = document.createElement('span');
            iconEl.className = 'pane-tab-icon';
            iconEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
            tabEl.appendChild(iconEl);

            // Label
            const labelEl = document.createElement('span');
            labelEl.textContent = tab.label;
            tabEl.appendChild(labelEl);

            // Action buttons container
            const actionsEl = document.createElement('span');
            actionsEl.className = 'pane-tab-actions';

            // Refresh button (active tab only)
            if (tabId === pane.activeTabId) {
                const refreshEl = document.createElement('button');
                refreshEl.className = 'tab-action-btn refresh-btn';
                refreshEl.title = '새로고침';
                refreshEl.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
                refreshEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.refreshTab(tabId, paneId);
                });
                actionsEl.appendChild(refreshEl);
            }

            // Close button
            const closeEl = document.createElement('button');
            closeEl.className = 'tab-action-btn';
            closeEl.title = '닫기';
            closeEl.innerHTML = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            closeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.closeTab(tabId);
            });
            actionsEl.appendChild(closeEl);

            tabEl.appendChild(actionsEl);

            // Left click to switch
            tabEl.addEventListener('click', (e) => {
                if (e.target.closest('.tab-action-btn')) return;
                e.stopPropagation();
                this.setActivePane(paneId);
                this.switchTab(tabId);
            });

            // Middle click to close
            tabEl.addEventListener('mousedown', (e) => {
                if (e.button === 1) {
                    e.preventDefault();
                    this.closeTab(tabId);
                }
            });

            // Right click context menu (same as file context menu)
            tabEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.onTabContextMenu) {
                    this.onTabContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        type: 'file',
                        envId: tab.envId,
                        projectId: tab.projectId,
                        path: tab.path
                    });
                }
            });

            // -- Drag and drop --
            tabEl.addEventListener('dragstart', (e) => {
                this.draggedTabId = tabId;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', tabId);
                requestAnimationFrame(() => tabEl.classList.add('dragging'));
            });

            tabEl.addEventListener('dragend', () => {
                this.draggedTabId = null;
                tabEl.classList.remove('dragging');
                pane.tabBarEl.querySelectorAll('.drag-over-left, .drag-over-right').forEach(el => {
                    el.classList.remove('drag-over-left', 'drag-over-right');
                });
            });

            tabEl.addEventListener('dragover', (e) => {
                if (!this.draggedTabId || this.draggedTabId === tabId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const rect = tabEl.getBoundingClientRect();
                const mid = rect.left + rect.width / 2;
                tabEl.classList.toggle('drag-over-left', e.clientX < mid);
                tabEl.classList.toggle('drag-over-right', e.clientX >= mid);
            });

            tabEl.addEventListener('dragleave', () => {
                tabEl.classList.remove('drag-over-left', 'drag-over-right');
            });

            tabEl.addEventListener('drop', (e) => {
                e.preventDefault();
                tabEl.classList.remove('drag-over-left', 'drag-over-right');
                const draggedId = this.draggedTabId;
                if (!draggedId || draggedId === tabId) return;

                const rect = tabEl.getBoundingClientRect();
                const dropAfter = e.clientX >= rect.left + rect.width / 2;
                this.reorderTab(draggedId, tabId, dropAfter, paneId);
            });

            pane.tabBarEl.appendChild(tabEl);
        });
    }

    reorderTab(draggedId, targetId, dropAfter, paneId) {
        const order = this.panes[paneId].tabOrder;
        const fromIdx = order.indexOf(draggedId);
        if (fromIdx === -1) return;

        order.splice(fromIdx, 1);
        let toIdx = order.indexOf(targetId);
        if (dropAfter) toIdx++;
        order.splice(toIdx, 0, draggedId);

        this.renderTabBar(paneId);
    }

    refreshTab(tabId, paneId) {
        const tab = this.tabs.get(tabId);
        const pane = this.panes[paneId];
        if (!tab || !pane) return;

        this.saveScrollPosition(paneId);
        const scrollTop = pane.contentEl.scrollTop;

        pane.viewer.loadFile(tab.envId, tab.projectId, tab.path).then(() => {
            pane.contentEl.scrollTop = scrollTop;
        });
    }

    refreshTabsByPath(filePath) {
        for (const [tabId, tab] of this.tabs) {
            if (filePath.endsWith(tab.path)) {
                const pane = this.panes[tab.paneId];
                if (pane && pane.activeTabId === tabId) {
                    pane.viewer.refresh();
                }
            }
        }
    }
}
