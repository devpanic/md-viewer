class ContextMenu {
    constructor() {
        this.menuEl = null;
        this.items = [];
        this.currentContext = {};
        this.createMenuElement();
        this.bindGlobalEvents();
    }

    addItem({ id, label, icon, group, order, visible, handler }) {
        this.items.push({ id, label, icon: icon || '', group: group || 'default', order: order || 0, visible, handler });
        this.items.sort((a, b) => {
            if (a.group !== b.group) return a.group.localeCompare(b.group);
            return a.order - b.order;
        });
    }

    removeItem(id) {
        this.items = this.items.filter(item => item.id !== id);
    }

    show(x, y, context) {
        this.currentContext = context;
        this.menuEl.innerHTML = '';

        const visibleItems = this.items.filter(item => !item.visible || item.visible(context));
        if (visibleItems.length === 0) return;

        let lastGroup = null;
        visibleItems.forEach(item => {
            if (lastGroup !== null && item.group !== lastGroup) {
                const sep = document.createElement('div');
                sep.className = 'context-menu-separator';
                this.menuEl.appendChild(sep);
            }
            lastGroup = item.group;

            const itemEl = document.createElement('div');
            itemEl.className = 'context-menu-item';

            if (item.icon) {
                const iconEl = document.createElement('span');
                iconEl.className = 'context-menu-item-icon';
                iconEl.textContent = item.icon;
                itemEl.appendChild(iconEl);
            }

            const labelEl = document.createElement('span');
            labelEl.textContent = item.label;
            itemEl.appendChild(labelEl);

            itemEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
                item.handler(this.currentContext);
            });

            this.menuEl.appendChild(itemEl);
        });

        // Position with boundary check
        this.menuEl.style.left = x + 'px';
        this.menuEl.style.top = y + 'px';
        this.menuEl.classList.add('visible');

        requestAnimationFrame(() => {
            const rect = this.menuEl.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                this.menuEl.style.left = (window.innerWidth - rect.width - 4) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                this.menuEl.style.top = (window.innerHeight - rect.height - 4) + 'px';
            }
        });
    }

    hide() {
        this.menuEl.classList.remove('visible');
    }

    createMenuElement() {
        this.menuEl = document.createElement('div');
        this.menuEl.className = 'context-menu';
        document.body.appendChild(this.menuEl);
    }

    bindGlobalEvents() {
        document.addEventListener('click', () => this.hide());
        document.addEventListener('contextmenu', () => this.hide());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });
    }
}
