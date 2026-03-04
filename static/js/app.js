let wsClient;
let fileBrowser;
let markdownViewer;

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
    const viewerContainer = document.getElementById('markdown-viewer');

    fileBrowser = new FileBrowser(fileTreeContainer);
    markdownViewer = new MarkdownViewer(viewerContainer);
    wsClient = new WebSocketClient();

    fileBrowser.loadProjectTree();

    fileBrowser.on('file-selected', (data) => {
        console.log('File selected:', data);
        markdownViewer.loadFile(data.envId, data.projectId, data.path);
    });

    wsClient.on('file_changed', (data) => {
        console.log('File changed:', data.path);
        if (markdownViewer.currentPath && data.path.endsWith(markdownViewer.currentPath)) {
            markdownViewer.refresh();
        }
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

    console.log('Application initialized');
}
