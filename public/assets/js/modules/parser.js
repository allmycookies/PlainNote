/* public/assets/js/modules/parser.js */

const lineCache = new Map();
let lastConfigHash = '';

function getConfigHash(config) {
    // Hash includes column definitions to invalidate cache on setting change
    const colStr = JSON.stringify(config.columns || []);
    return `${config.defDuration}-${config.locale}-${colStr}`;
}

export function parseContent(content, config) {
    const lines = content.split(/\r?\n/);
    const items = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const defDur = (config.defDuration || 20) * 60000;

    // Clear cache if config changed
    const currentHash = getConfigHash(config);
    if (currentHash !== lastConfigHash) {
        lineCache.clear();
        lastConfigHash = currentHash;
    }

    lines.forEach((line, idx) => {
        const trim = line.trim();
        
        // 1. Check for Description (starts with <<)
        if (trim.startsWith('<<')) {
            if (items.length > 0) {
                const lastItem = items[items.length - 1];
                const descText = trim.substring(2).trim();
                if (lastItem.description) {
                    lastItem.description += "\n" + descText;
                } else {
                    lastItem.description = descText;
                }
            }
            return;
        }

        // 2. Check for Task/Item start
        // Must start with [-] or [] OR a valid column token if logic allows.
        // Convention: Start with [-] or []
        if(!trim.match(/^(\[\]|\[-\])/)) return;

        // Cache Key
        const cacheKey = trim + '|' + todayStr;

        let itemData;
        if (lineCache.has(cacheKey)) {
            itemData = { ...lineCache.get(cacheKey) }; 
        } else {
            itemData = parseLineInternal(trim, config, todayStr, defDur);
            lineCache.set(cacheKey, { ...itemData }); 
        }

        if (itemData) {
            items.push({
                ...itemData,
                id: idx,
                description: '' // Init description
            });
        }
    });
    return items;
}

function parseLineInternal(trim, config, todayStr, defDur) {
    const item = {
        raw: trim,
        title: trim,
        type: null, // Will be set to column ID or token
        columnConfig: null,
        prio: 0,
        marker: 0, 
        start: null,
        end: null,
        recur: null,
        recurUntil: null
    };

    // Determine Type/Column based on Dynamic Config
    if (config.columns && config.columns.length > 0) {
        for (const col of config.columns) {
            // Escape special regex chars in token
            const esc = col.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`\\[${esc}\\]`, 'i');
            if (re.test(trim)) {
                item.type = col.token;
                item.columnConfig = col;
                break;
            }
        }
    }
    
    // Fallback: If no column matched, assign to first column (Inbox behavior)
    if (!item.type && config.columns && config.columns.length > 0) {
        item.type = config.columns[0].token;
        item.columnConfig = config.columns[0];
    }
    
    // Fallback (Legacy) if no columns defined (should be handled by defaultConfig but safety first)
    if (!item.type) item.type = 'a';

    const pMatch = trim.match(/\[p([1-5])\]/i);
    if(pMatch) item.prio = parseInt(pMatch[1]);
    
    const mMatch = trim.match(/\[m([1-9])\]/i);
    if(mMatch) item.marker = parseInt(mMatch[1]);

    const wMatch = trim.match(/\[w\s+([^\]]+)\]/i);
    if(wMatch) item.recur = wMatch[1].toLowerCase().replace(/\s/g, '');

    const bMatch = trim.match(/\[bis\s+([\d-]+)\]/i);
    if(bMatch) item.recurUntil = new Date(bMatch[1] + 'T23:59:59');

    const extract = (prefix, regex) => {
        const r = new RegExp(`\\[${prefix}\\s*(${regex})\\s*\\]`, 'i');
        const m = trim.match(r);
        return m ? m[1] : null;
    };
    const patDate = "[\\d\\.-]+";
    const patTime = "\\d{1,2}:\\d{2}";

    let sDateStr = extract('s', patDate);
    let sTime = extract('s', patTime) || extract('sz', patTime);
    let eDateStr = extract('e', patDate);
    let eTime = extract('e', patTime) || extract('et', patTime);

    const normDate = (d) => {
        if(!d) return null;
        if(d.includes('.')) {
            const parts = d.split('.');
            if(parts.length === 2) return `${new Date().getFullYear()}-${parts[1]}-${parts[0]}`;
            if(parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return d;
    }
    sDateStr = normDate(sDateStr);
    eDateStr = normDate(eDateStr);

    const hasExplicitStart = (sTime !== null) || (trim.match(/\[s/i));
    const hasExplicitEnd = (eTime !== null) || (trim.match(/\[e/i));

    if (!sDateStr && eDateStr) sDateStr = eDateStr;
    if (!eDateStr && sDateStr) eDateStr = sDateStr;
    
    if (!sDateStr && !item.recur) sDateStr = todayStr;
    if (!eDateStr && !item.recur) eDateStr = todayStr;
    
    if (item.recur && !sDateStr) sDateStr = todayStr;
    if (item.recur && !eDateStr) eDateStr = todayStr;

    let defaultETime = "00:00";
    if(sDateStr && !eTime) defaultETime = "17:00";

    const finalSTime = sTime || "00:00";
    const finalETime = eTime || defaultETime;

    item.start = new Date(`${sDateStr}T${finalSTime}:00`);
    item.end = new Date(`${eDateStr}T${finalETime}:00`);

    if (hasExplicitStart && !hasExplicitEnd) {
        item.end = new Date(item.start.getTime() + defDur);
    } else if (hasExplicitEnd && !hasExplicitStart) {
        item.start = new Date(item.end.getTime() - defDur);
    } else if (!hasExplicitStart && !hasExplicitEnd) {
        item.end = new Date(item.start.getTime() + defDur);
    }

    // Clean Title: Remove known tags AND dynamic column tokens
    let cleanTitle = item.title
        .replace(/^(\[\]|\[-\])\s*/, '')
        //.replace(/\[[ant]\]/gi, '') // Legacy hardcoded removal replaced below
        .replace(/\[p[1-5]\]/gi, '')
        .replace(/\[m[1-9]\]/gi, '') 
        .replace(/\[[se](z|t)?\s*[\d\-\.:]+\s*\]/gi, '')
        .replace(/\[w\s+[^\]]+\]/gi, '')
        .replace(/\[bis\s+[^\]]+\]/gi, '');

    // Remove dynamic column tokens from title
    if (config.columns) {
        config.columns.forEach(col => {
            const esc = col.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`\\[${esc}\\]`, 'gi');
            cleanTitle = cleanTitle.replace(re, '');
        });
    }

    item.title = cleanTitle.trim();

    if(isNaN(item.start)) return null;

    return item;
}

export function expandItems(items, rangeStart, rangeEnd) {
    const expanded = [];
    items.forEach(item => {
        if (!item.recur) {
            if (item.end >= rangeStart && item.start <= rangeEnd) {
                expanded.push(item);
            }
            return;
        }

        let cursor = new Date(Math.max(rangeStart.getTime(), item.start.getTime()));
        cursor.setHours(0,0,0,0);

        let limit = new Date(rangeEnd);
        if(item.recurUntil && item.recurUntil < limit) limit = item.recurUntil;

        const duration = item.end.getTime() - item.start.getTime();
        const startHours = item.start.getHours();
        const startMins = item.start.getMinutes();

        while (cursor <= limit) {
            let match = false;

            if (/^[a-z,]+$/.test(item.recur)) {
                const dayName = cursor.toLocaleDateString('de-DE', {weekday:'short'}).toLowerCase().substring(0,2);
                if (item.recur.includes(dayName)) match = true;
            }
            else if (item.recur.startsWith('+')) {
                const val = parseInt(item.recur.substring(1));
                const unit = item.recur.slice(-1);
                const diffMs = cursor.getTime() - new Date(item.start).setHours(0,0,0,0);
                const diffDays = Math.round(diffMs / 86400000);

                if (diffDays >= 0) {
                    if (unit === 't' && diffDays % val === 0) match = true;
                    if (unit === 'w' && diffDays % (val*7) === 0) match = true;
                    if (unit === 'm') {
                        const mDiff = (cursor.getFullYear() - item.start.getFullYear()) * 12 + (cursor.getMonth() - item.start.getMonth());
                        if (mDiff >= 0 && mDiff % val === 0 && cursor.getDate() === item.start.getDate()) match = true;
                    }
                }
            }
            else {
                const parts = item.recur.split('.');
                if (parts.length === 1 && cursor.getDate() === parseInt(parts[0])) match = true;
                else if (parts.length === 2 && cursor.getDate() === parseInt(parts[0]) && (cursor.getMonth()+1) === parseInt(parts[1])) match = true;
            }

            if (match) {
                const newItem = { ...item };
                const newStart = new Date(cursor);
                newStart.setHours(startHours, startMins, 0);
                newItem.start = newStart;
                newItem.end = new Date(newStart.getTime() + duration);
                newItem.isVirtual = true;
                expanded.push(newItem);
            }
            cursor.setDate(cursor.getDate() + 1);
        }
    });
    return expanded;
}