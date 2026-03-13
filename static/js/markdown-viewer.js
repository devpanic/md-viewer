class MarkdownViewer {
    constructor(container) {
        this.container = container;
        this.currentPath = null;
        this.currentEnvId = null;
        this.currentProjectId = null;
        this.onLinkClick = null;
    }

    async loadFile(envId, projectId, path) {
        this.currentEnvId = envId;
        this.currentProjectId = projectId;
        this.currentPath = path;
        this.container.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const cleanPath = path.replace(/^\//, '');
            const response = await fetch(`/api/render/${envId}/${projectId}/${encodeURIComponent(cleanPath)}`);

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

        this.wrapCodeBlocks(content);
        this.highlightCode(content);
        this.renderMath(content);
        await this.renderMermaid(content);
        this.interceptLinks(content);
    }

    wrapCodeBlocks(content) {
        content.querySelectorAll('pre').forEach((pre) => {
            // Skip if already wrapped
            if (pre.parentElement && pre.parentElement.classList.contains('code-block')) return;

            const code = pre.querySelector('code');
            if (!code) return;

            // Detect language from class
            let lang = '';
            const classList = code.className || '';
            const match = classList.match(/language-(\w+)/);
            if (match) lang = match[1];

            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block';

            // Create header
            const header = document.createElement('div');
            header.className = 'code-block-header';

            const langLabel = document.createElement('span');
            langLabel.className = 'code-block-lang';
            langLabel.textContent = lang || 'code';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'code-block-copy';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => {
                const text = code.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.textContent = 'Copied!';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy';
                        copyBtn.classList.remove('copied');
                    }, 2000);
                }).catch(() => {});
            });

            header.appendChild(langLabel);
            header.appendChild(copyBtn);

            // Wrap
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(header);
            wrapper.appendChild(pre);
        });
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

            if (href && (href.endsWith('.md') || href.includes('.md#'))) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();

                    const [filePath, anchor] = href.split('#');
                    const targetPath = this.resolveRelativePath(this.currentPath, filePath);

                    console.log('Link clicked:', href, '-> resolved to:', targetPath);

                    const loadPromise = this.onLinkClick
                        ? this.onLinkClick(this.currentEnvId, this.currentProjectId, targetPath)
                        : this.loadFile(this.currentEnvId, this.currentProjectId, targetPath);

                    loadPromise.then(() => {
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
        if (relativePath.startsWith('/')) {
            return relativePath;
        }

        const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));

        if (relativePath.startsWith('./')) {
            relativePath = relativePath.substring(2);
        }

        let parts = currentDir ? currentDir.split('/').filter(p => p !== '') : [];

        const relParts = relativePath.split('/');
        for (const part of relParts) {
            if (part === '..') {
                parts.pop();
            } else if (part !== '.' && part !== '') {
                parts.push(part);
            }
        }

        return '/' + parts.join('/');
    }

    async refresh() {
        if (this.currentPath && this.currentEnvId && this.currentProjectId) {
            await this.loadFile(this.currentEnvId, this.currentProjectId, this.currentPath);
        }
    }
}
