class MarkdownViewer {
    constructor(container) {
        this.container = container;
        this.currentPath = null;
    }

    async loadFile(path) {
        this.currentPath = path;
        this.container.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const response = await fetch('/api/render/' + encodeURIComponent(path.replace(/^\//, '')));

            if (!response.ok) {
                throw new Error('Failed to load file');
            }

            const html = await response.text();
            await this.render(html);
        } catch (e) {
            console.error('Failed to load file:', e);
            this.container.innerHTML = '<div class="error">Failed to load file</div>';
        }
    }

    async render(html) {
        this.container.innerHTML = '<div class="markdown-content">' + html + '</div>';
        await this.enhance();
    }

    async enhance() {
        const content = this.container.querySelector('.markdown-content');
        if (!content) return;

        this.highlightCode(content);
        this.renderMath(content);
        await this.renderMermaid(content);
        this.interceptLinks(content);
    }

    highlightCode(content) {
        if (typeof hljs === 'undefined') {
            console.warn('highlight.js not loaded');
            return;
        }

        content.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    renderMath(content) {
        if (typeof renderMathInElement === 'undefined') {
            console.warn('KaTeX auto-render not loaded');
            return;
        }

        try {
            renderMathInElement(content, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false,
                output: 'html'
            });
        } catch (e) {
            console.error('Failed to render math:', e);
        }
    }

    async renderMermaid(content) {
        if (typeof mermaid === 'undefined') {
            console.warn('Mermaid not loaded');
            return;
        }

        try {
            const mermaidBlocks = content.querySelectorAll('.mermaid');
            if (mermaidBlocks.length > 0) {
                // Mermaid 10.x uses the run() API instead of init()
                await mermaid.run({
                    nodes: mermaidBlocks,
                });
            }
        } catch (e) {
            console.error('Failed to render Mermaid:', e);
        }
    }

    interceptLinks(content) {
        const links = content.querySelectorAll('a[href]');

        links.forEach(link => {
            const href = link.getAttribute('href');

            // Check if it's a markdown file link
            if (href && (href.endsWith('.md') || href.includes('.md#'))) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();

                    // Extract anchor if present
                    const [filePath, anchor] = href.split('#');

                    // Resolve relative path based on current file path
                    const targetPath = this.resolveRelativePath(this.currentPath, filePath);

                    console.log('Link clicked:', href, '-> resolved to:', targetPath);

                    // Load the target file
                    this.loadFile(targetPath).then(() => {
                        // Scroll to anchor if present
                        if (anchor) {
                            setTimeout(() => {
                                const element = document.getElementById(anchor);
                                if (element) {
                                    element.scrollIntoView({ behavior: 'smooth' });
                                }
                            }, 100);
                        }
                    });
                });
            }
        });
    }

    resolveRelativePath(currentPath, relativePath) {
        // Handle absolute paths (starting with /)
        if (relativePath.startsWith('/')) {
            return relativePath;
        }

        // Get directory of current file
        const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));

        // Handle ./ prefix
        if (relativePath.startsWith('./')) {
            relativePath = relativePath.substring(2);
        }

        // Start from current directory, filter out empty strings
        let parts = currentDir ? currentDir.split('/').filter(p => p !== '') : [];

        // Process each part of relative path
        const relParts = relativePath.split('/');
        for (const part of relParts) {
            if (part === '..') {
                // Go up one directory
                parts.pop();
            } else if (part !== '.' && part !== '') {
                // Add to path
                parts.push(part);
            }
        }

        // Join and return with leading slash
        return '/' + parts.join('/');
    }

    async refresh() {
        if (this.currentPath) {
            await this.loadFile(this.currentPath);
        }
    }
}
