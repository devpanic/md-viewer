let wsClient;
let fileBrowser;
let tabManager;
let contextMenu;

// Theme system
const themes = {
    green:   { accent: '#5ec4a0', dim: '#49a886', glow: 'rgba(94, 196, 160, 0.15)', glowStrong: 'rgba(94, 196, 160, 0.25)', shadow: '0 0 20px rgba(94, 196, 160, 0.12)' },
    purple:  { accent: '#a78bfa', dim: '#8b6fe0', glow: 'rgba(167, 139, 250, 0.15)', glowStrong: 'rgba(167, 139, 250, 0.25)', shadow: '0 0 20px rgba(167, 139, 250, 0.12)' },
    blue:    { accent: '#60a5fa', dim: '#4a8fe0', glow: 'rgba(96, 165, 250, 0.15)', glowStrong: 'rgba(96, 165, 250, 0.25)', shadow: '0 0 20px rgba(96, 165, 250, 0.12)' },
    rose:    { accent: '#f0718d', dim: '#d65a76', glow: 'rgba(240, 113, 141, 0.15)', glowStrong: 'rgba(240, 113, 141, 0.25)', shadow: '0 0 20px rgba(240, 113, 141, 0.12)' },
    amber:   { accent: '#e8a44a', dim: '#c88a35', glow: 'rgba(232, 164, 74, 0.15)', glowStrong: 'rgba(232, 164, 74, 0.25)', shadow: '0 0 20px rgba(232, 164, 74, 0.12)' },
    cyan:    { accent: '#56c8d8', dim: '#42aebb', glow: 'rgba(86, 200, 216, 0.15)', glowStrong: 'rgba(86, 200, 216, 0.25)', shadow: '0 0 20px rgba(86, 200, 216, 0.12)' },
    indigo:  { accent: '#818cf8', dim: '#6a75e0', glow: 'rgba(129, 140, 248, 0.15)', glowStrong: 'rgba(129, 140, 248, 0.25)', shadow: '0 0 20px rgba(129, 140, 248, 0.12)' },
    emerald: { accent: '#34d399', dim: '#2ab880', glow: 'rgba(52, 211, 153, 0.15)', glowStrong: 'rgba(52, 211, 153, 0.25)', shadow: '0 0 20px rgba(52, 211, 153, 0.12)' },
};

function setTheme(name) {
    const t = themes[name];
    if (!t) return;
    const r = document.documentElement.style;
    r.setProperty('--accent', t.accent);
    r.setProperty('--accent-dim', t.dim);
    r.setProperty('--accent-glow', t.glow);
    r.setProperty('--accent-glow-strong', t.glowStrong);
    r.setProperty('--shadow-glow', t.shadow);
    localStorage.setItem('md-viewer-theme', name);
    updateThemeSwatches(name);
}

function updateThemeSwatches(activeName) {
    document.querySelectorAll('.theme-swatch').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === activeName);
    });
}

function initThemePicker() {
    const container = document.getElementById('theme-swatches');
    if (!container) return;

    Object.keys(themes).forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'theme-swatch';
        btn.dataset.theme = name;
        btn.title = name;
        btn.style.background = themes[name].accent;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            setTheme(name);
        });
        container.appendChild(btn);
    });

    // Restore saved theme
    const saved = localStorage.getItem('md-viewer-theme') || 'green';
    setTheme(saved);

    // Toggle dropdown
    const pickerBtn = document.getElementById('theme-picker-btn');
    const dropdown = document.getElementById('theme-dropdown');

    pickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initialize();
});

function initialize() {
    // Initialize Mermaid with configuration
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            fontSize: 18,
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis',
                padding: 20,
            },
            sequence: {
                useMaxWidth: true,
                diagramMarginX: 50,
                diagramMarginY: 30,
            },
        });
    }

    const fileTreeContainer = document.getElementById('file-tree');

    fileBrowser = new FileBrowser(fileTreeContainer);
    wsClient = new WebSocketClient();

    // Initialize TabManager
    tabManager = new TabManager();
    tabManager.init();

    // Initialize ContextMenu
    contextMenu = new ContextMenu();

    // File context menu items
    contextMenu.addItem({
        id: 'open-in-pane-1',
        label: 'Pane 1에서 열기',
        icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
        group: 'open',
        order: 1,
        visible: (ctx) => ctx.type === 'file',
        handler: (ctx) => tabManager.openTabInPane(ctx.envId, ctx.projectId, ctx.path, '1')
    });

    contextMenu.addItem({
        id: 'open-in-pane-2',
        label: 'Pane 2에서 열기',
        icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
        group: 'open',
        order: 2,
        visible: (ctx) => ctx.type === 'file',
        handler: (ctx) => {
            if (!tabManager.isSplit) {
                tabManager.toggleSplitView();
            }
            tabManager.openTabInPane(ctx.envId, ctx.projectId, ctx.path, '2');
        }
    });

    contextMenu.addItem({
        id: 'copy-file-path',
        label: '경로 복사',
        icon: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        group: 'actions',
        order: 1,
        visible: (ctx) => ctx.type === 'file',
        handler: (ctx) => {
            navigator.clipboard.writeText(ctx.path).catch(() => {});
        }
    });

    // Environment context menu items
    contextMenu.addItem({
        id: 'env-add-project',
        label: '프로젝트 추가',
        icon: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        group: 'env-actions',
        order: 1,
        visible: (ctx) => ctx.type === 'environment',
        handler: (ctx) => {
            if (management) management.addProject(ctx.envId);
        }
    });

    contextMenu.addItem({
        id: 'env-rename',
        label: '환경 이름 변경',
        icon: '<svg viewBox="0 0 24 24"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
        group: 'env-actions',
        order: 2,
        visible: (ctx) => ctx.type === 'environment',
        handler: (ctx) => {
            if (management) management.editEnvironment(ctx.envId, ctx.envName);
        }
    });

    contextMenu.addItem({
        id: 'env-delete',
        label: '환경 삭제',
        icon: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        group: 'env-danger',
        order: 1,
        visible: (ctx) => ctx.type === 'environment',
        danger: true,
        handler: (ctx) => {
            if (management) management.deleteEnvironment(ctx.envId, ctx.envName);
        }
    });

    // Project context menu items
    contextMenu.addItem({
        id: 'project-edit',
        label: '프로젝트 수정',
        icon: '<svg viewBox="0 0 24 24"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
        group: 'project-actions',
        order: 1,
        visible: (ctx) => ctx.type === 'project',
        handler: (ctx) => {
            if (management) management.editProject(ctx.envId, ctx.projectId);
        }
    });

    contextMenu.addItem({
        id: 'project-copy-path',
        label: '경로 복사',
        icon: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        group: 'project-actions',
        order: 2,
        visible: (ctx) => ctx.type === 'project',
        handler: (ctx) => {
            if (ctx.projectPath) {
                navigator.clipboard.writeText(ctx.projectPath).catch(() => {});
            }
        }
    });

    contextMenu.addItem({
        id: 'project-delete',
        label: '프로젝트 삭제',
        icon: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        group: 'project-danger',
        order: 1,
        visible: (ctx) => ctx.type === 'project',
        danger: true,
        handler: (ctx) => {
            if (management) management.deleteProject(ctx.envId, ctx.projectId);
        }
    });

    fileBrowser.loadProjectTree();

    fileBrowser.on('file-selected', (data) => {
        console.log('File selected:', data);
        tabManager.openTab(data.envId, data.projectId, data.path);
    });

    fileBrowser.on('file-context-menu', (data) => {
        contextMenu.show(data.x, data.y, data);
    });

    fileBrowser.on('env-context-menu', (data) => {
        contextMenu.show(data.x, data.y, data);
    });

    fileBrowser.on('project-context-menu', (data) => {
        contextMenu.show(data.x, data.y, data);
    });

    wsClient.on('file_changed', (data) => {
        console.log('File changed:', data.path, data.env_id, data.project_id);
        tabManager.refreshTabsByPath(data.path);
    });

    wsClient.on('file_created', (data) => {
        console.log('File created:', data.path, data.env_id, data.project_id);
        fileBrowser.refreshProject(data.env_id, data.project_id);
    });

    wsClient.on('file_deleted', (data) => {
        console.log('File deleted:', data.path, data.env_id, data.project_id);
        fileBrowser.refreshProject(data.env_id, data.project_id);
    });

    wsClient.on('connected', () => {
        console.log('WebSocket connected');
    });

    wsClient.on('disconnected', () => {
        console.log('WebSocket disconnected');
    });

    // Sidebar toggle
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const toggleIcon = document.getElementById('sidebar-toggle-icon');

    if (localStorage.getItem('sidebar-collapsed') === 'true') {
        sidebar.classList.add('collapsed');
        toggleIcon.innerHTML = '<polyline points="9 18 15 12 9 6"/>';
    }

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        toggleIcon.innerHTML = isCollapsed
            ? '<polyline points="9 18 15 12 9 6"/>'
            : '<polyline points="15 18 9 12 15 6"/>';
        localStorage.setItem('sidebar-collapsed', isCollapsed);
    });

    // Sidebar footer: Add Environment button
    document.getElementById('add-env-btn').addEventListener('click', () => {
        if (management) management.addEnvironment();
    });

    // Theme picker
    initThemePicker();

    console.log('Application initialized');
}
