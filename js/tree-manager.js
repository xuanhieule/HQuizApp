class TreeManager {
    constructor(containerId, onSelectFileCallback) {
        this.container = document.getElementById(containerId);
        this.onSelectFile = onSelectFileCallback;
        this.activeNodeEl = null;

        this.svgChevronRight = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        this.svgChevronDown = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        this.svgFolder = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"></path></svg>`;
        this.svgFile = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h8l4 4v13H6z"></path><path d="M14 3.5v4h4"></path><path d="M9 12h6M9 16h6"></path></svg>`;
    }

    buildTreeFromPathList(pathList) {
        const root = { name: 'question', type: 'folder', children: {} };

        pathList.forEach(rawPath => {
            if (!rawPath) return;
            let cleanPath = rawPath.replace(/\\/g, '/').trim();
            if (cleanPath.startsWith('question/')) {
                cleanPath = cleanPath.substring('question/'.length);
            }

            const parts = cleanPath.split('/').filter(p => p.length > 0);
            let current = root;

            parts.forEach((part, index) => {
                const isLast = (index === parts.length - 1);
                const isFile = isLast && part.toLowerCase().endsWith('.csv');

                if (isFile) {
                    // Mặc định lấy tên file (bỏ đuôi .csv)
                    let displayName = part.replace('.csv', ''); 
                    
                    // Nếu file tên CHÍNH XÁC là 'question.csv', thì lấy tên của thư mục cha để hiển thị cho gọn
                    if (part.toLowerCase() === 'question.csv' && parts.length > 1) {
                         displayName = parts[parts.length - 2];
                    }

                    current.children[part] = {
                        name: displayName,
                        type: 'file',
                        fullPath: rawPath.replace(/\\/g, '/').trim()
                    };
                } else {
                    if (!current.children[part]) {
                        current.children[part] = { name: part, type: 'folder', children: {} };
                    }
                    current = current.children[part];
                }
            });
        });
        return root;
    }

    render(treeRoot) {
        this.container.innerHTML = '';
        if (!treeRoot || !Object.keys(treeRoot.children).length) {
            this.container.innerHTML = '<div class="tree-loading">Không có dữ liệu menu.</div>';
            return;
        }
        const rootList = this.createSubTree(treeRoot.children, true);
        this.container.appendChild(rootList);
    }

    createSubTree(childrenObj, isRootLevel = false) {
        const ul = document.createElement('ul');
        ul.className = isRootLevel ? 'tree-list tree-root-list' : 'tree-list';

        // THUẬT TOÁN NATURAL SORT: Nhận diện chữ số trong chuỗi để sắp xếp đúng (question2 trước question10)
        const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

        const keys = Object.keys(childrenObj).sort((a, b) => {
            const itemA = childrenObj[a];
            const itemB = childrenObj[b];
            
            // Ưu tiên hiển thị thư mục ở trên, file ở dưới
            if (itemA.type !== itemB.type) return itemA.type === 'folder' ? -1 : 1;
            
            // So sánh tên hiển thị bằng Natural Sort
            return collator.compare(itemA.name, itemB.name);
        });

        keys.forEach(key => {
            const node = childrenObj[key];
            const li = document.createElement('li');
            li.className = `tree-node tree-${node.type}`;

            if (node.type === 'folder') {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'tree-item tree-folder-header';

                const toggleSpan = document.createElement('span');
                toggleSpan.className = 'tree-toggle';
                toggleSpan.innerHTML = this.svgChevronRight;

                const iconSpan = document.createElement('span');
                iconSpan.className = 'tree-icon';
                iconSpan.innerHTML = this.svgFolder;

                const labelSpan = document.createElement('span');
                labelSpan.className = 'tree-label';
                labelSpan.textContent = node.name;

                itemDiv.appendChild(toggleSpan);
                itemDiv.appendChild(iconSpan);
                itemDiv.appendChild(labelSpan);
                li.appendChild(itemDiv);

                const subUl = this.createSubTree(node.children, false);
                subUl.className = 'tree-list tree-branch collapsed';
                li.appendChild(subUl);

                itemDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isCollapsed = subUl.classList.toggle('collapsed');
                    toggleSpan.innerHTML = isCollapsed ? this.svgChevronRight : this.svgChevronDown;
                });

            } else {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'tree-item tree-file';
                itemDiv.dataset.path = node.fullPath; // Lưu trữ đường dẫn để phục vụ khôi phục trạng thái khi F5

                const emptyToggle = document.createElement('span');
                emptyToggle.className = 'tree-toggle invisible';
                
                const iconSpan = document.createElement('span');
                iconSpan.className = 'tree-icon';
                iconSpan.innerHTML = this.svgFile;

                const labelSpan = document.createElement('span');
                labelSpan.className = 'tree-label';
                labelSpan.textContent = node.name; 

                itemDiv.appendChild(emptyToggle);
                itemDiv.appendChild(iconSpan);
                itemDiv.appendChild(labelSpan);
                li.appendChild(itemDiv);

                itemDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.activeNodeEl) this.activeNodeEl.classList.remove('active');
                    itemDiv.classList.add('active');
                    this.activeNodeEl = itemDiv;
                    this.onSelectFile(node);
                });
            }
            ul.appendChild(li);
        });
        return ul;
    }

    setActiveByPath(fullPath) {
        const fileItems = this.container.querySelectorAll('.tree-file');
        fileItems.forEach(item => {
            if (item.dataset.path === fullPath) {
                if (this.activeNodeEl) this.activeNodeEl.classList.remove('active');
                item.classList.add('active');
                this.activeNodeEl = item;

                let branch = item.closest('.tree-branch');
                while (branch) {
                    branch.classList.remove('collapsed');
                    const header = branch.previousElementSibling;
                    if (header) {
                        const toggle = header.querySelector('.tree-toggle');
                        if (toggle) toggle.innerHTML = this.svgChevronDown;
                    }
                    branch = branch.parentElement ? branch.parentElement.closest('.tree-branch') : null;
                }
            }
        });
    }
}