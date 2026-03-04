let wsClient;
let fileBrowser;
let tabManager;
let contextMenu;

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

    contextMenu.addItem({
        id: 'open-in-pane-1',
        label: 'Pane 1에서 열기',
        group: 'open',
        order: 1,
        visible: (ctx) => ctx.type === 'file',
        handler: (ctx) => tabManager.openTabInPane(ctx.envId, ctx.projectId, ctx.path, '1')
    });

    contextMenu.addItem({
        id: 'open-in-pane-2',
        label: 'Pane 2에서 열기',
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

    fileBrowser.loadProjectTree();

    fileBrowser.on('file-selected', (data) => {
        console.log('File selected:', data);
        tabManager.openTab(data.envId, data.projectId, data.path);
    });

    fileBrowser.on('file-context-menu', (data) => {
        contextMenu.show(data.x, data.y, data);
    });

    wsClient.on('file_changed', (data) => {
        console.log('File changed:', data.path);
        tabManager.refreshTabsByPath(data.path);
    });

    wsClient.on('file_created', (data) => {
        console.log('File created:', data.path);
        fileBrowser.loadProjectTree();
    });

    wsClient.on('file_deleted', (data) => {
        console.log('File deleted:', data.path);
        fileBrowser.loadProjectTree();
    });

    wsClient.on('tree_updated', () => {
        console.log('Tree updated');
        fileBrowser.loadProjectTree();
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
        toggleIcon.innerHTML = '&rsaquo;';
    }

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        toggleIcon.innerHTML = isCollapsed ? '&rsaquo;' : '&lsaquo;';
        localStorage.setItem('sidebar-collapsed', isCollapsed);
    });

    console.log('Application initialized');
}
