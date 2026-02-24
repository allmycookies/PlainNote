/* public/assets/js/modules/ui.js */

export function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function formatText(text) {
    return escapeHtml(text);
}

export function renderColumns(items, config, dom) {
    if (!dom.projections) return;

    const fmt = new Intl.DateTimeFormat(config.locale, {
        day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'
    });

    const createHTML = (i) => {
        let meta = '';
        if(i.recur) {
            meta = `<div class="card-meta">↻ Wiederkehrend</div>`;
        } else if(i.start) {
            meta = `<div class="card-meta">📅 ${fmt.format(i.start)}</div>`;
        }
        
        let descHtml = '';
        if(i.description) {
            descHtml = `<div class="card-desc">${escapeHtml(i.description)}</div>`;
        }
        
        const markerClass = i.marker > 0 ? `marker-${i.marker}` : '';

        // Add draggable attribute
        return `<div class="card prio-${i.prio} ${markerClass}" 
                     data-id="${i.id}" 
                     draggable="true" 
                     style="cursor:grab" 
                     title="${escapeHtml(i.description)}">
                    <div class="card-title">${formatText(i.title)}</div>
                    ${descHtml}
                    ${meta}
                </div>`;
    };

    const sortFn = (list, colId) => {
            const mode = config.sorts[colId];
            if(!mode || mode === 'default') return list; // Preserve text order

            return list.sort((a,b) => {
                if(mode === 'prio') {
                    // Prio Descending (5 to 1) or Ascending? Usually Prio 1 is highest importance.
                    // Let's implement High to Low (1 first)
                    return a.prio - b.prio; 
                }
                // Date Sort
                return mode === 'asc' ? a.start - b.start : b.start - a.start;
            });
    };

    // --- Dynamic Column Rendering ---
    
    // Clear existing lanes
    dom.projections.innerHTML = '';
    
    // Fallback if no columns
    const columns = config.columns || [
        { id: 'c1', name: 'Aufgaben', token: 'a' },
        { id: 'c2', name: 'Notizen', token: 'n' },
        { id: 'c3', name: 'Termine', token: 't' }
    ];

    columns.forEach(col => {
        // Create Lane Container
        const lane = document.createElement('div');
        lane.className = 'lane';
        lane.dataset.token = col.token;
        lane.dataset.colId = col.id;

        // Filter items for this column
        // Parser logic assigns item.type = col.token
        let colItems = items.filter(i => i.type === col.token);

        // Sort items
        colItems = sortFn(colItems, col.id);

        // Determine sort button state
        const sortState = config.sorts[col.id] || 'default';
        let sortIcon = '⇅';
        if(sortState === 'asc') sortIcon = '⬇ 📅';
        if(sortState === 'prio') sortIcon = '⚠ Prio';

        // Header HTML
        const headHTML = `
            <div class="lane-head">
                <h3 title="${escapeHtml(col.name)} [${col.token}]">${escapeHtml(col.name)}</h3>
                <button data-sort="${col.id}" class="tool-btn" title="Sortieren">${sortIcon}</button>
            </div>
            <div class="lane-content">
                ${colItems.map(createHTML).join('')}
            </div>
        `;
        
        lane.innerHTML = headHTML;
        dom.projections.appendChild(lane);
    });

    // Update Sort Event Logic (delegated in app.js, but we need to ensure config keys match)
    // The app.js click handler looks for data-sort attribute, which we set to col.id.
    // The App.js logic toggles: default -> asc -> desc -> default.
    // We might want to adapt: default -> prio -> asc -> default for flexibility?
    // For now, let's keep simple sorting logic in App.js compatible with this.
}