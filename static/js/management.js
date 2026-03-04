class ManagementTab {
    constructor() {
        this.config = null;
        this.currentEnv = null;
        this.modalResolve = null;
        this.initModal();
        this.init();
    }

    initModal() {
        const overlay = document.getElementById('modal-overlay');
        const closeBtn = document.getElementById('modal-close');
        const cancelBtn = document.getElementById('modal-cancel');
        const confirmBtn = document.getElementById('modal-confirm');

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeModal(false);
            }
        });

        // Close button
        closeBtn.addEventListener('click', () => this.closeModal(false));

        // Cancel button
        cancelBtn.addEventListener('click', () => this.closeModal(false));

        // Confirm button
        confirmBtn.addEventListener('click', () => {
            const input1 = document.getElementById('modal-input');
            const input2 = document.getElementById('modal-input2');

            if (input1.style.display !== 'none' || input2.style.display !== 'none') {
                // Input mode
                const values = [];
                if (input1.style.display !== 'none') values.push(input1.value.trim());
                if (input2.style.display !== 'none') values.push(input2.value.trim());
                this.closeModal(values.length === 1 ? values[0] : values);
            } else {
                // Confirm mode
                this.closeModal(true);
            }
        });

        // Enter key support
        document.getElementById('modal-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        });
        document.getElementById('modal-input2').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        });
    }

    showModal(title, message, inputs = []) {
        return new Promise((resolve) => {
            this.modalResolve = resolve;

            const overlay = document.getElementById('modal-overlay');
            const titleEl = document.getElementById('modal-title');
            const messageEl = document.getElementById('modal-message');
            const input1 = document.getElementById('modal-input');
            const input2 = document.getElementById('modal-input2');
            const cancelBtn = document.getElementById('modal-cancel');

            titleEl.textContent = title;
            messageEl.textContent = message;

            // Reset inputs
            input1.style.display = 'none';
            input2.style.display = 'none';
            input1.value = '';
            input2.value = '';

            // Show inputs if needed
            if (inputs.length > 0) {
                input1.style.display = 'block';
                input1.placeholder = inputs[0].placeholder || '';
                input1.value = inputs[0].value || '';

                if (inputs.length > 1) {
                    input2.style.display = 'block';
                    input2.placeholder = inputs[1].placeholder || '';
                    input2.value = inputs[1].value || '';
                }

                cancelBtn.style.display = 'block';
                setTimeout(() => input1.focus(), 100);
            } else {
                cancelBtn.style.display = inputs.cancelable !== false ? 'block' : 'none';
            }

            overlay.classList.add('show');
        });
    }

    closeModal(result) {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.remove('show');

        if (this.modalResolve) {
            this.modalResolve(result);
            this.modalResolve = null;
        }
    }

    showAlert(message, title = '알림') {
        return this.showModal(title, message, { cancelable: false });
    }

    async showConfirm(message, title = '확인') {
        return await this.showModal(title, message);
    }

    async showPrompt(message, placeholder = '', defaultValue = '', title = '입력') {
        return await this.showModal(title, message, [{ placeholder, value: defaultValue }]);
    }

    async showDoublePrompt(message, placeholders = [], defaultValues = [], title = '입력') {
        return await this.showModal(title, message, [
            { placeholder: placeholders[0] || '', value: defaultValues[0] || '' },
            { placeholder: placeholders[1] || '', value: defaultValues[1] || '' }
        ]);
    }

    init() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Environment actions (view only - no switching)
        // Switching is done in the files tab by expanding environments/projects

        document.getElementById('add-env-btn').addEventListener('click', () => this.addEnvironment());
        document.getElementById('edit-env-btn').addEventListener('click', () => this.editEnvironment());
        document.getElementById('delete-env-btn').addEventListener('click', () => this.deleteEnvironment());

        // Project actions
        document.getElementById('add-project-btn').addEventListener('click', () => this.addProject());

        // Load initial config
        this.loadConfig();
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // If switching to management tab, reload config
        if (tabName === 'management') {
            this.loadConfig();
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error('Failed to load config');

            this.config = await response.json();
            this.currentEnv = this.config.environments.find(e => e.id === this.config.curr_env);

            this.renderEnvironments();
            this.renderProjects();
        } catch (error) {
            console.error('Error loading config:', error);
            this.showAlert('설정을 불러오는데 실패했습니다.', 'error');
        }
    }

    renderEnvironments() {
        const select = document.getElementById('env-select');
        select.innerHTML = this.config.environments.map(env =>
            `<option value="${env.id}" ${env.id === this.config.curr_env ? 'selected' : ''}>
                ${env.name}
            </option>`
        ).join('');
    }

    renderProjects() {
        const projectsList = document.getElementById('projects-list');

        if (!this.currentEnv || this.currentEnv.projects.length === 0) {
            projectsList.innerHTML = '<p class="empty-message">프로젝트가 없습니다.</p>';
            return;
        }

        projectsList.innerHTML = this.currentEnv.projects.map(project => `
            <div class="project-item" data-project-id="${project.id}">
                <div class="project-info">
                    <div class="project-name">${project.name}</div>
                    <div class="project-path">${project.path}</div>
                </div>
                <div class="project-actions">
                    <button class="icon-btn icon-btn-sm icon-btn-edit" data-action="edit" title="수정">✎</button>
                    <button class="icon-btn icon-btn-sm icon-btn-delete" data-action="delete" title="삭제">×</button>
                </div>
            </div>
        `).join('');

        // Add event listeners for project actions
        projectsList.querySelectorAll('.project-item').forEach(item => {
            const projectId = item.dataset.projectId;

            item.querySelector('[data-action="edit"]').addEventListener('click', () => {
                this.editProject(projectId);
            });

            item.querySelector('[data-action="delete"]').addEventListener('click', () => {
                this.deleteProject(projectId);
            });
        });
    }


    async addEnvironment() {
        const values = await this.showDoublePrompt(
            '새 환경을 추가합니다.',
            ['환경 ID (예: office, home)', '환경 이름'],
            ['', ''],
            '환경 추가'
        );

        if (!values || !values[0] || !values[1]) return;

        try {
            const response = await fetch('/api/environments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: values[0], name: values[1] })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to add environment');

            await this.showAlert('환경이 추가되었습니다.');
            this.loadConfig();
        } catch (error) {
            console.error('Error adding environment:', error);
            await this.showAlert('환경 추가에 실패했습니다: ' + error.message, '오류');
        }
    }

    async editEnvironment() {
        if (!this.currentEnv) return;

        const newName = await this.showPrompt(
            '환경 이름을 수정합니다.',
            '환경 이름',
            this.currentEnv.name,
            '환경 수정'
        );

        if (!newName || newName === this.currentEnv.name) return;

        try {
            const response = await fetch('/api/environments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: this.currentEnv.id, name: newName })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to update environment');

            await this.showAlert('환경이 수정되었습니다.');
            this.loadConfig();
        } catch (error) {
            console.error('Error updating environment:', error);
            await this.showAlert('환경 수정에 실패했습니다: ' + error.message, '오류');
        }
    }

    async deleteEnvironment() {
        if (!this.currentEnv) return;

        const confirmed = await this.showConfirm(
            `정말로 "${this.currentEnv.name}" 환경을 삭제하시겠습니까?`,
            '환경 삭제'
        );

        if (!confirmed) return;

        try {
            const response = await fetch('/api/environments', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: this.currentEnv.id })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to delete environment');

            await this.showAlert('환경이 삭제되었습니다.');
            this.loadConfig();
        } catch (error) {
            console.error('Error deleting environment:', error);
            await this.showAlert('환경 삭제에 실패했습니다: ' + error.message, '오류');
        }
    }

    async addProject() {
        if (!this.currentEnv) return;

        const id = await this.showPrompt(
            '프로젝트 ID를 입력하세요.',
            '프로젝트 ID (예: my-project)',
            '',
            '프로젝트 추가 (1/3)'
        );
        if (!id) return;

        const name = await this.showPrompt(
            '프로젝트 이름을 입력하세요.',
            '프로젝트 이름',
            '',
            '프로젝트 추가 (2/3)'
        );
        if (!name) return;

        const path = await this.showPrompt(
            '프로젝트 경로를 입력하세요.',
            '프로젝트 경로',
            '',
            '프로젝트 추가 (3/3)'
        );
        if (!path) return;

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    env_id: this.currentEnv.id,
                    id,
                    name,
                    path
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to add project');

            await this.showAlert('프로젝트가 추가되었습니다.');
            this.loadConfig();
        } catch (error) {
            console.error('Error adding project:', error);
            await this.showAlert('프로젝트 추가에 실패했습니다: ' + error.message, '오류');
        }
    }

    async editProject(projectId) {
        if (!this.currentEnv) return;

        const project = this.currentEnv.projects.find(p => p.id === projectId);
        if (!project) return;

        const values = await this.showDoublePrompt(
            '프로젝트 정보를 수정합니다.',
            ['프로젝트 이름', '프로젝트 경로'],
            [project.name, project.path],
            '프로젝트 수정'
        );

        if (!values || !values[0] || !values[1]) return;

        try {
            const response = await fetch('/api/projects', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    env_id: this.currentEnv.id,
                    id: projectId,
                    name: values[0],
                    path: values[1]
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to update project');

            await this.showAlert('프로젝트가 수정되었습니다.');
            this.loadConfig();
        } catch (error) {
            console.error('Error updating project:', error);
            await this.showAlert('프로젝트 수정에 실패했습니다: ' + error.message, '오류');
        }
    }

    async deleteProject(projectId) {
        if (!this.currentEnv) return;

        const project = this.currentEnv.projects.find(p => p.id === projectId);
        if (!project) return;

        const confirmed = await this.showConfirm(
            `정말로 "${project.name}" 프로젝트를 삭제하시겠습니까?`,
            '프로젝트 삭제'
        );

        if (!confirmed) return;

        try {
            const response = await fetch('/api/projects', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    env_id: this.currentEnv.id,
                    project_id: projectId
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to delete project');

            await this.showAlert('프로젝트가 삭제되었습니다.');
            this.loadConfig();
        } catch (error) {
            console.error('Error deleting project:', error);
            await this.showAlert('프로젝트 삭제에 실패했습니다: ' + error.message, '오류');
        }
    }

}

// Global instance - initialize after DOM is ready
let management = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        management = new ManagementTab();
    });
} else {
    // DOM is already ready
    management = new ManagementTab();
}
