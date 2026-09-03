class QuestionRendererFactory {
    static getRenderer(type) {
        switch (type.toLowerCase()) {
            case 'single': return new SingleChoiceQuestion();
            case 'multiple': return new MultipleChoiceQuestion();
            case 'matrix': return new MatrixQuestion();
            default: throw new Error(`Loại '${type}' không hỗ trợ.`);
        }
    }
}

class BaseQuestion {
    render(q, index, imageResolver) {}
    evaluate(q, formData) {}
    applyAnswerFeedback(q, formData) {}
    isAnswered(q, formData) {
        return formData.getAll(`q_${q.id}`).length > 0;
    }
    
    // Hàm sinh mã HTML cho hình ảnh (nếu có)
    getImageHtml(q, imageResolver) {
        if (!q.image || q.image.trim() === '') return '';
        const imgSrc = imageResolver ? imageResolver(q.image.trim()) : q.image.trim();
        if (!imgSrc) return '';
        return `<div class="question-image-container"><img src="${imgSrc}" class="question-img" alt="Hình ảnh minh họa" onerror="this.style.display='none';"></div>`;
    }
}

class SingleChoiceQuestion extends BaseQuestion {
    render(q, index, imageResolver) {
        const imageHtml = this.getImageHtml(q, imageResolver);
        const options = q.options.split('|').map(opt => opt.trim());
        const optionsHtml = options.map(opt => `<li class="option-item"><label><input type="radio" name="q_${q.id}" value="${DOMUtils.escapeHTML(opt)}" required><span>${DOMUtils.escapeHTML(opt)}</span></label></li>`).join('');
        const compactClass = options.length >= 3 && options.every(opt => opt.length <= 18) ? ' options-compact' : '';
        return `<div class="question-card" id="q-card-${q.id}"><div class="question-header"><div class="question-title"><strong>Câu ${index + 1}:</strong> ${DOMUtils.escapeHTML(q.question)}</div><span class="badge">Chọn 1 đáp án</span></div>${imageHtml}<ul class="options-list${compactClass}">${optionsHtml}</ul><div class="feedback" id="feedback-${q.id}"></div></div>`;
    }
    evaluate(q, formData) {
        const selected = formData.get(`q_${q.id}`);
        const isCorrect = selected && selected.trim().toLowerCase() === q.correct_answers.trim().toLowerCase();
        return { isCorrect, userAnswers: selected || 'Chưa chọn', correctAnswers: q.correct_answers, explanation: q.explanation };
    }
    applyAnswerFeedback(q, formData) {
        const selected = formData.get(`q_${q.id}`);
        const correctAnswer = q.correct_answers.trim().toLowerCase();
        this.getInputs(q.id).forEach(input => {
            const label = input.closest('label');
            const isCorrectAnswer = input.value.trim().toLowerCase() === correctAnswer;
            const isSelectedWrong = input.checked && input.value.trim().toLowerCase() !== correctAnswer;
            label.classList.toggle('answer-correct', !isSelectedWrong && isCorrectAnswer);
            label.classList.toggle('answer-incorrect', isSelectedWrong);
        });
    }
    getInputs(questionId) {
        return Array.from(document.querySelectorAll(`input[name="q_${questionId}"]`));
    }
}

class MultipleChoiceQuestion extends BaseQuestion {
    render(q, index, imageResolver) {
        const imageHtml = this.getImageHtml(q, imageResolver);
        const options = q.options.split('|').map(opt => opt.trim());
        const optionsHtml = options.map(opt => `<li class="option-item"><label><input type="checkbox" name="q_${q.id}" value="${DOMUtils.escapeHTML(opt)}"><span>${DOMUtils.escapeHTML(opt)}</span></label></li>`).join('');
        const compactClass = options.length >= 3 && options.every(opt => opt.length <= 18) ? ' options-compact' : '';
        return `<div class="question-card" id="q-card-${q.id}"><div class="question-header"><div class="question-title"><strong>Câu ${index + 1}:</strong> ${DOMUtils.escapeHTML(q.question)}</div><span class="badge">Chọn nhiều đáp án</span></div>${imageHtml}<ul class="options-list${compactClass}">${optionsHtml}</ul><div class="feedback" id="feedback-${q.id}"></div></div>`;
    }
    evaluate(q, formData) {
        const selected = formData.getAll(`q_${q.id}`).map(s => s.trim().toLowerCase()).sort();
        const expected = q.correct_answers.split('|').map(s => s.trim().toLowerCase()).sort();
        const isCorrect = selected.length === expected.length && selected.every((val, idx) => val === expected[idx]);
        return { isCorrect, userAnswers: selected.join(', ') || 'Chưa chọn', correctAnswers: q.correct_answers.split('|').join(', '), explanation: q.explanation };
    }
    applyAnswerFeedback(q, formData) {
        const expected = new Set(q.correct_answers.split('|').map(answer => answer.trim().toLowerCase()));
        this.getInputs(q.id).forEach(input => {
            const answer = input.value.trim().toLowerCase();
            const isCorrectAnswer = expected.has(answer);
            const isSelectedWrong = input.checked && !isCorrectAnswer;
            const label = input.closest('label');
            label.classList.toggle('answer-correct', !isSelectedWrong && isCorrectAnswer);
            label.classList.toggle('answer-incorrect', isSelectedWrong);
        });
    }
    getInputs(questionId) {
        return Array.from(document.querySelectorAll(`input[name="q_${questionId}"]`));
    }
}

class MatrixQuestion extends BaseQuestion {
    parseOptions(optString) {
        const parts = optString.split('///'); let cols = []; let rows = [];
        parts.forEach(part => {
            const trimmed = part.trim();
            if (trimmed.startsWith('COLS:')) cols = trimmed.replace('COLS:', '').split('|').map(c => c.trim());
            else if (trimmed.startsWith('ROWS:')) rows = trimmed.replace('ROWS:', '').split('|').map(r => r.trim());
        });
        return { cols, rows };
    }
    render(q, index, imageResolver) {
        const imageHtml = this.getImageHtml(q, imageResolver);
        const { cols, rows } = this.parseOptions(q.options);
        const tableHeader = `<tr><th>Nội dung</th>${cols.map(c => `<th>${DOMUtils.escapeHTML(c)}</th>`).join('')}</tr>`;
        const tableBody = rows.map((rowText, rIdx) => {
            const rowInputs = cols.map(colText => `<td class="center"><input type="radio" name="q_${q.id}_row_${rIdx}" value="${DOMUtils.escapeHTML(colText)}" data-row="${DOMUtils.escapeHTML(rowText)}" required></td>`).join('');
            return `<tr><td>${DOMUtils.escapeHTML(rowText)}</td>${rowInputs}</tr>`;
        }).join('');
        return `<div class="question-card" id="q-card-${q.id}"><div class="question-header"><div class="question-title"><strong>Câu ${index + 1}:</strong> ${DOMUtils.escapeHTML(q.question)}</div><span class="badge">Dạng bảng</span></div>${imageHtml}<div class="table-responsive"><table class="matrix-table"><thead>${tableHeader}</thead><tbody>${tableBody}</tbody></table></div><div class="feedback" id="feedback-${q.id}"></div></div>`;
    }
    evaluate(q, formData) {
        const { rows } = this.parseOptions(q.options);
        const expectedMap = {};
        q.correct_answers.split('|').forEach(pair => {
            const [row, col] = pair.split(':').map(p => p.trim().toLowerCase());
            if (row && col) expectedMap[row] = col;
        });
        let isAllCorrect = true;
        rows.forEach((rowText, rIdx) => {
            const selectedCol = formData.get(`q_${q.id}_row_${rIdx}`);
            const expectedCol = expectedMap[rowText.trim().toLowerCase()];
            if (!selectedCol || selectedCol.trim().toLowerCase() !== expectedCol) isAllCorrect = false;
        });
        return { isCorrect: isAllCorrect, userAnswers: 'Theo ma trận', correctAnswers: q.correct_answers, explanation: q.explanation };
    }
    applyAnswerFeedback(q, formData) {
        const { rows } = this.parseOptions(q.options);
        const expectedMap = {};
        q.correct_answers.split('|').forEach(pair => {
            const [row, col] = pair.split(':').map(p => p.trim().toLowerCase());
            if (row && col) expectedMap[row] = col;
        });

        rows.forEach((rowText, rowIndex) => {
            const selected = formData.get(`q_${q.id}_row_${rowIndex}`);
            if (!selected) return;

            const isCorrect = selected.trim().toLowerCase() === expectedMap[rowText.trim().toLowerCase()];
            const input = Array.from(document.querySelectorAll(`input[name="q_${q.id}_row_${rowIndex}"]`))
                .find(option => option.value === selected);
            if (input) input.closest('td').classList.add(isCorrect ? 'answer-correct' : 'answer-incorrect');
        });
    }
    isAnswered(q, formData) {
        const { rows } = this.parseOptions(q.options);
        return rows.length > 0 && rows.every((rowText, rIdx) => formData.get(`q_${q.id}_row_${rIdx}`));
    }
}