class DOMUtils { 
    static escapeHTML(str) { 
        if (!str) return ''; 
        const div = document.createElement('div'); div.textContent = str; return div.innerHTML; 
    } 
}
class CSVParser { 
    static parse(csvText) { 
        if (!csvText) return []; const rows = []; let currentRow = []; let currentCell = ''; let insideQuotes = false;
        for (let i = 0; i < csvText.length; i++) { 
            const char = csvText[i]; const nextChar = csvText[i + 1]; 
            if (char === '"') { if (insideQuotes && nextChar === '"') { currentCell += '"'; i++; } else { insideQuotes = !insideQuotes; } } 
            else if (char === ',' && !insideQuotes) { currentRow.push(currentCell.trim()); currentCell = ''; } 
            else if ((char === '\r' || char === '\n') && !insideQuotes) { if (char === '\r' && nextChar === '\n') i++; currentRow.push(currentCell.trim()); if (currentRow.some(cell => cell.length > 0)) { rows.push(currentRow); } currentRow = []; currentCell = ''; } 
            else { currentCell += char; } 
        }
        if (currentCell.length > 0 || currentRow.length > 0) { currentRow.push(currentCell.trim()); if (currentRow.some(cell => cell.length > 0)) { rows.push(currentRow); } }
        if (rows.length < 2) return []; const headers = rows[0].map(h => h.toLowerCase()); return rows.slice(1).map(row => { const entry = {}; headers.forEach((h, idx) => { entry[h] = row[idx] || ''; }); return entry; }); 
    } 
}