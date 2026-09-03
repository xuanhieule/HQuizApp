class QuizApp {
    constructor() {
        this.questions = [];
        this.treeManager = null;
        this.localFiles = {};
        this.localImages = {}; // Bộ nhớ chứa ảnh để load offline
        this.currentFileNode = null;
        this.STORAGE_KEY = 'QUIZ_PROGRESS_STATE';

        this.emptyState = document.getElementById('empty-state');
        this.quizForm = document.getElementById('quiz-form');
        this.container = document.getElementById('quiz-container');
        this.actionsPanel = document.getElementById('quiz-actions');
        this.scoreBoard = document.getElementById('score-board');
        this.breadcrumb = document.getElementById('quiz-breadcrumb');
        this.statusBadge = document.getElementById('quiz-status-badge');
        this.resetBtn = document.getElementById('reset-btn');
        this.submitBtn = document.getElementById('submit-btn');
        this.sidebar = document.querySelector('.sidebar');
        this.menuToggle = document.getElementById('menu-toggle');

        this.init();
    }

    async init() {
        this.treeManager = new TreeManager('tree-root', (node) => {
            this.loadFile(node);
            this.setMobileMenu(false);
        });

        if (this.menuToggle) {
            this.menuToggle.addEventListener('click', () => {
                this.setMobileMenu(!this.sidebar.classList.contains('menu-open'));
            });
        }
        
        const btnOpenFolder = document.getElementById('btn-open-folder');
        const folderInput = document.getElementById('folder-input');
        if (btnOpenFolder && folderInput) {
            btnOpenFolder.addEventListener('click', () => folderInput.click());
            folderInput.addEventListener('change', (e) => this.handleLocalFolder(e));
        }

        await this.loadQuestionIndexCSV();

        this.quizForm.addEventListener('change', () => {
            this.updateProgress();
            this.saveState();
        });
        this.quizForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.resetBtn.addEventListener('click', () => this.resetQuiz());

        await this.restoreStateOnLoad();
    }

    setMobileMenu(isOpen) {
        if (!this.sidebar || !this.menuToggle) return;
        this.sidebar.classList.toggle('menu-open', isOpen);
        this.menuToggle.setAttribute('aria-expanded', String(isOpen));
        this.menuToggle.setAttribute('aria-label', isOpen ? 'Đóng menu bài thi' : 'Mở menu bài thi');
    }

    handleLocalFolder(event) {
        const files = Array.from(event.target.files);
        if (!files.length) return;

        this.localFiles = {};
        this.localImages = {};
        const pathList = [];

        files.forEach(f => {
            let relativePath = f.webkitRelativePath.replace(/\\/g, '/');
            const qIndex = relativePath.toLowerCase().indexOf('question/');
            if (qIndex !== -1) {
                relativePath = relativePath.substring(qIndex);
            } else {
                relativePath = 'question/' + relativePath.substring(relativePath.indexOf('/') + 1);
            }
            
            if (f.name.toLowerCase().endsWith('.csv')) {
                pathList.push(relativePath);
                this.localFiles[relativePath] = f;
            } else if (f.type.startsWith('image/') || f.name.match(/\.(png|jpe?g|gif|webp)$/i)) {
                // Lưu lại các file ảnh người dùng đã quét
                this.localImages[relativePath] = f;
            }
        });

        if (pathList.length === 0) {
            alert("Không tìm thấy file .csv nào trong thư mục vừa chọn!");
            return;
        }

        const treeRoot = this.treeManager.buildTreeFromPathList(pathList);
        this.treeManager.render(treeRoot);
        
        this.emptyState.style.display = 'block';
        this.quizForm.style.display = 'none';

        this.restoreStateOnLoad();
    }

    async loadQuestionIndexCSV() {
        let csvContent = '';
        try { 
            const res = await fetch('question/questions_index.csv'); 
            if (res.ok) { csvContent = await res.text(); } 
        } catch (e) {}
        
        if (!csvContent && window.QUESTIONS_INDEX_CSV) { csvContent = window.QUESTIONS_INDEX_CSV; }
        if (!csvContent) return;
        
        const parsedRows = CSVParser.parse(csvContent);
        const pathList = parsedRows.map(r => r.path || Object.values(r)[1] || '').filter(Boolean);
        const treeRoot = this.treeManager.buildTreeFromPathList(pathList);
        this.treeManager.render(treeRoot);
    }

    async loadFile(fileNode, isNewSelection = true) {
        try {
            this.currentFileNode = fileNode;
            this.statusBadge.textContent = 'Đang tải...';
            const pathParts = fileNode.fullPath.split(/[\\/]/).filter(Boolean);
            this.breadcrumb.textContent = pathParts.length > 1 ? pathParts[pathParts.length - 2] : fileNode.name;

            let csvText = '';

            if (this.localFiles && this.localFiles[fileNode.fullPath]) {
                csvText = await this.localFiles[fileNode.fullPath].text();
            } else {
                try { const res = await fetch(fileNode.fullPath); if (res.ok) { csvText = await res.text(); } } catch (e) {}
                if (!csvText && window.QUESTIONS_DATABASE && window.QUESTIONS_DATABASE[fileNode.fullPath]) {
                    csvText = window.QUESTIONS_DATABASE[fileNode.fullPath];
                }
            }

            this.questions = CSVParser.parse(csvText);
            if (!this.questions.length) {
                alert('Tệp CSV câu hỏi trống hoặc không đúng định dạng.');
                return;
            }

            this.renderQuestions();
            this.statusBadge.textContent = `${this.questions.length} câu hỏi`;

            if (isNewSelection) {
                localStorage.removeItem(this.STORAGE_KEY);
                this.saveState();
            }
        } catch (error) {
            console.error(error);
            this.statusBadge.textContent = 'Lỗi nạp tệp';
            alert(`Không thể nạp bài thi: ${fileNode.fullPath}`);
        }
    }

    renderQuestions() {
        this.emptyState.style.display = 'none';
        this.quizForm.style.display = 'block';

        // Khởi tạo Image Resolver (Nạp ảnh offline bằng Blob, hoặc online bằng đường dẫn)
        const csvFolderPath = this.currentFileNode.fullPath.substring(0, this.currentFileNode.fullPath.lastIndexOf('/'));
        const imageResolver = (imageName) => {
            if (!imageName) return '';
            const imageFullPath = csvFolderPath + '/' + imageName.trim();
            
            // Nếu chạy Offline (Người dùng đã chọn Folder ở menu trái)
            if (this.localImages && this.localImages[imageFullPath]) {
                return URL.createObjectURL(this.localImages[imageFullPath]); // Dựng link ảo cho ảnh
            }
            // Nếu chạy Server / Online
            return imageFullPath;
        };

        this.container.innerHTML = this.questions.map((q, idx) => {
            const renderer = QuestionRendererFactory.getRenderer(q.type);
            return renderer.render(q, idx, imageResolver);
        }).join('');

        this.actionsPanel.style.display = 'flex';
        this.scoreBoard.textContent = `Tiến độ: 0/${this.questions.length} câu`;
        this.updateProgress();
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = 'Nộp Bài';
    }

    updateProgress(formData = new FormData(this.quizForm)) {
        const answeredCount = this.questions.reduce((count, q) => {
            const renderer = QuestionRendererFactory.getRenderer(q.type);
            return count + (renderer.isAnswered(q, formData) ? 1 : 0);
        }, 0);
        this.scoreBoard.textContent = `Tiến độ: ${answeredCount}/${this.questions.length} câu`;
    }

    saveState() {
        if (!this.currentFileNode) return;

        const formData = new FormData(this.quizForm);
        const answers = {};

        for (let [key, value] of formData.entries()) {
            if (answers[key]) {
                if (Array.isArray(answers[key])) {
                    answers[key].push(value);
                } else {
                    answers[key] = [answers[key], value];
                }
            } else {
                answers[key] = value;
            }
        }

        const state = {
            fullPath: this.currentFileNode.fullPath,
            name: this.currentFileNode.name,
            answers: answers,
            isSubmitted: this.submitBtn.disabled,
            scoreHtml: this.scoreBoard.innerHTML
        };

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }

    async restoreStateOnLoad() {
        const savedString = localStorage.getItem(this.STORAGE_KEY);
        if (!savedString) return;

        try {
            const state = JSON.parse(savedString);
            if (!state || !state.fullPath) return;

            this.treeManager.setActiveByPath(state.fullPath);

            const node = { name: state.name || 'Bài thi', fullPath: state.fullPath };
            await this.loadFile(node, false);

            if (state.answers) {
                Object.keys(state.answers).forEach(name => {
                    const val = state.answers[name];
                    const inputs = this.quizForm.querySelectorAll(`[name="${name}"]`);
                    inputs.forEach(input => {
                        if (Array.isArray(val)) {
                            if (val.includes(input.value)) input.checked = true;
                        } else {
                            if (input.value === val) input.checked = true;
                        }
                    });
                });
            }

            if (state.isSubmitted) {
                const formData = new FormData(this.quizForm);
                this.evaluateAnswers(formData);
                this.scoreBoard.innerHTML = state.scoreHtml || '';
                this.submitBtn.textContent = 'Đã Hoàn Thành';
                this.submitBtn.disabled = true;
            } else {
                this.updateProgress();
            }
        } catch (e) {
            console.error("Lỗi khôi phục trạng thái F5:", e);
        }
    }

    handleSubmit(event) {
        event.preventDefault();
        const formData = new FormData(this.quizForm);
        this.evaluateAnswers(formData);
        this.saveState();
    }

    evaluateAnswers(formData) {
        let correctCount = 0;

        this.questions.forEach(q => {
            const renderer = QuestionRendererFactory.getRenderer(q.type);
            const result = renderer.evaluate(q, formData);
            const feedbackEl = document.getElementById(`feedback-${q.id}`);

            if (result.isCorrect) {
                correctCount++;
                feedbackEl.className = 'feedback show correct';
                feedbackEl.innerHTML = `<strong>✓ Chính xác!</strong> ${DOMUtils.escapeHTML(result.explanation || '')}`;
            } else {
                feedbackEl.className = 'feedback show incorrect';
                feedbackEl.innerHTML = `<strong>✗ Chưa chính xác!</strong><br><span><strong>Đáp án đúng:</strong> <em>${DOMUtils.escapeHTML(result.correctAnswers)}</em></span><br>${result.explanation ? `<span><strong>Giải thích:</strong> ${DOMUtils.escapeHTML(result.explanation)}</span>` : ''}`;
            }
        });

        const total = this.questions.length;
        const percent = Math.round((correctCount / total) * 100);
        this.scoreBoard.innerHTML = `Kết quả: <span style="color: var(--primary-color);">${correctCount}/${total} (${percent}%)</span>`;
        
        this.submitBtn.textContent = 'Đã Hoàn Thành';
        this.submitBtn.disabled = true;
    }

    resetQuiz() {
        this.quizForm.reset();
        document.querySelectorAll('.feedback').forEach(el => {
            el.className = 'feedback';
            el.innerHTML = '';
        });
        this.scoreBoard.textContent = `Tiến độ: 0/${this.questions.length} câu`;
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = 'Nộp Bài';

        this.saveState();
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new QuizApp(); });