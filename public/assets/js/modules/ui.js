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
    return escapeHtml(text); // Old >> replace logic removed
}

export function renderColumns(items, config, dom) {
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

        return `<div class="card prio-${i.prio} type-${i.type} ${markerClass}" data-id="${i.id}" style="cursor:pointer" title="${escapeHtml(i.description)}">
                    <div class="card-title">${formatText(i.title)}</div>
                    ${descHtml}
                    ${meta}
                </div>`;
    };

    const sortFn = (list, type) => {
            const mode = config.sorts[type];
            if(!mode || mode === 'default') return list;

            return list.sort((a,b) => {
                if(type === 'tasks') {
                    return mode === 'asc' ? a.prio - b.prio : b.prio - a.prio;
                }
                return mode === 'asc' ? a.start - b.start : b.start - a.start;
            });
    };

    const tasks = items.filter(i => i.type === 'a');
    const notes = items.filter(i => i.type === 'n');
    const dates = items.filter(i => i.type === 't');

    if(dom.tasks) dom.tasks.innerHTML = sortFn(tasks, 'tasks').map(createHTML).join('');
    if(dom.notes) dom.notes.innerHTML = sortFn(notes, 'notes').map(createHTML).join('');
    if(dom.dates) dom.dates.innerHTML = sortFn(dates, 'dates').map(createHTML).join('');

    ['tasks', 'notes', 'dates'].forEach(k => {
            const btn = document.querySelector(`button[data-sort="${k}"]`);
            if(btn) {
                const m = config.sorts[k];
                btn.innerHTML = m === 'asc' ? '⬆' : (m === 'desc' ? '⬇' : '⇅');
            }
    });
}