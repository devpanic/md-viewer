class ManagementTab {
    constructor() {
        this.modalResolve = null;
        this.initModal();
    }

    initModal() {
        const overlay = document.getElementById('modal-overlay');
        const closeBtn = document.getElementById('modal-close');
        const cancelBtn = document.getElementById('modal-cancel');
        const confirmBtn = document.getElementById('modal-confirm');

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeModal(false);
            }
        });

        closeBtn.addEventListener('click', () => this.closeModal(false));
        cancelBtn.addEventListener('click', () => this.closeModal(false));

        confirmBtn.addEventListener('click', () => {
            const input1 = document.getElementById('modal-input');
            const input2 = document.getElementById('modal-input2');

            if (input1.style.display !== 'none' || input2.style.display !== 'none') {
                const values = [];
                if (input1.style.display !== 'none') values.push(input1.value.trim());
                if (input2.style.display !== 'none') values.push(input2.value.trim());
                this.closeModal(values.length === 1 ? values[0] : values);
            } else {
                this.closeModal(true);
            }
        });

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

            input1.style.display = 'none';
            input2.style.display = 'none';
            input1.value = '';
            input2.value = '';

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

    // --- CRUD API Methods ---

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
            if (fileBrowser) fileBrowser.loadProjectTree();
        } catch (error) {
            console.error('Error adding environment:', error);
            await this.showAlert('환경 추가에 실패했습니다: ' + error.message, '오류');
        }
    }

    async editEnvironment(envId, envName) {
        const newName = await this.showPrompt(
            '환경 이름을 수정합니다.',
            '환경 이름',
            envName || '',
            '환경 수정'
        );

        if (!newName || newName === envName) return;

        try {
            const response = await fetch('/api/environments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: envId, name: newName })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to update environment');

            await this.showAlert('환경이 수정되었습니다.');
            if (fileBrowser) fileBrowser.loadProjectTree();
        } catch (error) {
            console.error('Error updating environment:', error);
            await this.showAlert('환경 수정에 실패했습니다: ' + error.message, '오류');
        }
    }

    async deleteEnvironment(envId, envName) {
        const confirmed = await this.showConfirm(
            `정말로 "${envName}" 환경을 삭제하시겠습니까?`,
            '환경 삭제'
        );

        if (!confirmed) return;

        try {
            const response = await fetch('/api/environments', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: envId })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to delete environment');

            await this.showAlert('환경이 삭제되었습니다.');
            if (fileBrowser) fileBrowser.loadProjectTree();
        } catch (error) {
            console.error('Error deleting environment:', error);
            await this.showAlert('환경 삭제에 실패했습니다: ' + error.message, '오류');
        }
    }

    async addProject(envId) {
        if (!envId) {
            // Fallback: load config to get current env
            try {
                const resp = await fetch('/api/config');
                const config = await resp.json();
                envId = config.curr_env;
            } catch (e) {
                await this.showAlert('환경 정보를 불러올 수 없습니다.', '오류');
                return;
            }
        }

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
                body: JSON.stringify({ env_id: envId, id, name, path })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to add project');

            await this.showAlert('프로젝트가 추가되었습니다.');
            if (fileBrowser) fileBrowser.loadProjectTree();
        } catch (error) {
            console.error('Error adding project:', error);
            await this.showAlert('프로젝트 추가에 실패했습니다: ' + error.message, '오류');
        }
    }

    async editProject(envId, projectId) {
        // Load current project info
        let project = null;
        try {
            const resp = await fetch('/api/config');
            const config = await resp.json();
            const env = config.environments.find(e => e.id === envId);
            if (env) project = env.projects.find(p => p.id === projectId);
        } catch (e) {
            // ignore
        }

        const values = await this.showDoublePrompt(
            '프로젝트 정보를 수정합니다.',
            ['프로젝트 이름', '프로젝트 경로'],
            [project ? project.name : '', project ? project.path : ''],
            '프로젝트 수정'
        );

        if (!values || !values[0] || !values[1]) return;

        try {
            const response = await fetch('/api/projects', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    env_id: envId,
                    id: projectId,
                    name: values[0],
                    path: values[1]
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to update project');

            await this.showAlert('프로젝트가 수정되었습니다.');
            if (fileBrowser) fileBrowser.loadProjectTree();
        } catch (error) {
            console.error('Error updating project:', error);
            await this.showAlert('프로젝트 수정에 실패했습니다: ' + error.message, '오류');
        }
    }

    async deleteProject(envId, projectId) {
        // Get project name for confirmation message
        let projectName = projectId;
        try {
            const resp = await fetch('/api/config');
            const config = await resp.json();
            const env = config.environments.find(e => e.id === envId);
            if (env) {
                const proj = env.projects.find(p => p.id === projectId);
                if (proj) projectName = proj.name;
            }
        } catch (e) {
            // ignore
        }

        const confirmed = await this.showConfirm(
            `정말로 "${projectName}" 프로젝트를 삭제하시겠습니까?`,
            '프로젝트 삭제'
        );

        if (!confirmed) return;

        try {
            const response = await fetch('/api/projects', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    env_id: envId,
                    project_id: projectId
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to delete project');

            await this.showAlert('프로젝트가 삭제되었습니다.');
            if (fileBrowser) fileBrowser.loadProjectTree();
        } catch (error) {
            console.error('Error deleting project:', error);
            await this.showAlert('프로젝트 삭제에 실패했습니다: ' + error.message, '오류');
        }
    }
}

// Global instance
let management = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        management = new ManagementTab();
    });
} else {
    management = new ManagementTab();
}
