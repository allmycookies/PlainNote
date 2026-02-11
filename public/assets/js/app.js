/* public/assets/js/app.js */

export class App {
    constructor() {
        const data = window.SERVER_DATA || {};
        this.slug = data.slug;
        this.content = data.content || '';
        this.updatedAt = data.updated_at || null; // Optimistic Locking Ref
        this.allSlugs = data.allSlugs || [];
        
        // Config + Defaults
        this.defaultConfig = {
            locale: 'de-DE', 
            view: 'week', 
            sorts: {},
            theme: 'dark', 
            calHeight: 50, 
            defDuration: 20, 
            ganttMinWidth: 60,
            calStartHour: 0, 
            calEndHour: 24,
            visibleDays: [1,2,3,4,5,6,0],
            prioColors: ['#ff4d4d', '#ff9e4d', '#ffd24d', '#4dff88', '#4d9eff']
        };
        this.config = { ...this.defaultConfig, ...(data.config || {}) };

        this.dom = {
            editor: document.getElementById('editor'),
            status: document.getElementById('save-status'),
            tasks: document.getElementById('render-tasks'),
            notes: document.getElementById('render-notes'),
            dates: document.getElementById('render-dates'),
            calRender: document.getElementById('calendar-render'),
            genPreview: document.getElementById('gen-preview')
        };
        this.calState = { refDate: new Date() };

        if(this.dom.editor) {
            this.dom.editor.value = this.content;
            this.applyGlobalSettings();
            this.bindEvents();
            this.bindModalEvents();
            this.bindSettingsEvents();
            this.parseAndRender();
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    applyGlobalSettings() {
        const root = document.documentElement;
        const c = this.config;
        
        // Theme Logic
        if(c.theme === 'light') {
            root.style.setProperty('--bg-dark', '#f5f5f5');
            root.style.setProperty('--bg-panel', '#ffffff');
            root.style.setProperty('--border', '#e0e0e0');
            root.style.setProperty('--text-main', '#333333');
            root.style.setProperty('--text-muted', '#666666');
            if(this.dom.editor) this.dom.editor.style.color = '#333';
        } else {
            root.style.setProperty('--bg-dark', '#1e1e1e');
            root.style.setProperty('--bg-panel', '#252526');
            root.style.setProperty('--border', '#3e3e42');
            root.style.setProperty('--text-main', '#d4d4d4');
            root.style.setProperty('--text-muted', '#858585');
            if(this.dom.editor) this.dom.editor.style.color = '#ce9178';
        }

        // Prio Colors
        if(c.prioColors && c.prioColors.length === 5) {
            c.prioColors.forEach((col, i) => {
                root.style.setProperty(`--prio-${i+1}`, col);
            });
        }

        // Layout
        if(c.calHeight) {
            root.style.setProperty('--cal-height', `${c.calHeight}%`);
        }
    }

    bindEvents() {
        let timeout;
        // Editor Input with Debounce
        this.dom.editor.addEventListener('input', () => {
            this.content = this.dom.editor.value;
            this.parseAndRender();
            this.dom.status.textContent = '...';
            clearTimeout(timeout);
            timeout = setTimeout(() => this.save(), 1000);
        });
        
        // Global Click Handling (Delegation)
        document.body.addEventListener('click', (e) => {
            // Sort Buttons
            const sortBtn = e.target.closest('button[data-sort]');
            if(sortBtn) this.toggleSort(sortBtn.dataset.sort);

            // View Switcher (Gantt / Week)
            const viewBtn = e.target.closest('.view-btn');
            if(viewBtn) {
                this.config.view = viewBtn.dataset.view;
                this.parseAndRender();
                this.save();
            }

            // Calendar Navigation
            if(e.target.closest('#cal-prev')) this.changeWeek(-7);
            if(e.target.closest('#cal-next')) this.changeWeek(7);
            if(e.target.closest('#cal-today')) {
                this.calState.refDate = new Date();
                this.parseAndRender();
            }

            // Item Highlight (Line Jump)
            const itemTarget = e.target.closest('.card, .cal-event, .cal-strip, .g-bar-item, .g-task-row');
            if(itemTarget && itemTarget.dataset.id) {
                this.highlightLine(parseInt(itemTarget.dataset.id));
            }

            // Toolbar Pickers
            if(e.target.id === 'btn-s-date') document.getElementById('pick-s-date').showPicker();
            if(e.target.id === 'btn-s-time') document.getElementById('pick-s-time').showPicker();
            if(e.target.id === 'btn-e-date') document.getElementById('pick-e-date').showPicker();
            if(e.target.id === 'btn-e-time') document.getElementById('pick-e-time').showPicker();
        });

        // Picker Change Events
        document.getElementById('pick-s-date')?.addEventListener('change', (e) => this.insertAtCursor(`[s ${e.target.value}]`));
        document.getElementById('pick-s-time')?.addEventListener('change', (e) => this.insertAtCursor(`[s ${e.target.value}]`));
        document.getElementById('pick-e-date')?.addEventListener('change', (e) => this.insertAtCursor(`[e ${e.target.value}]`));
        document.getElementById('pick-e-time')?.addEventListener('change', (e) => this.insertAtCursor(`[e ${e.target.value}]`));
    }

    bindModalEvents() {
        const toggle = (id, show) => {
            const el = document.getElementById(id);
            if(show) el.classList.add('open'); 
            else el.classList.remove('open');
        };

        // Modal Open Buttons
        document.getElementById('btn-recur')?.addEventListener('click', () => { 
            toggle('modal-recur', true); 
            this.updateGenPreview(); 
        });
        document.getElementById('btn-help')?.addEventListener('click', () => toggle('modal-help', true));
        document.getElementById('btn-settings')?.addEventListener('click', () => { 
            this.populateSettingsForm(); 
            toggle('modal-settings', true); 
        });

        // Close Buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => toggle(e.target.closest('.modal-overlay').id, false));
        });

        // Generator Logic (Live Preview)
        document.querySelectorAll('#modal-recur input, #modal-recur select').forEach(el => 
            el.addEventListener('input', () => this.updateGenPreview()));
        
        document.getElementById('btn-insert-recur')?.addEventListener('click', () => {
            const tag = this.dom.genPreview.textContent;
            toggle('modal-recur', false);
            this.insertAtCursor(' ' + tag);
        });

        // Conflict Modal Actions
        document.getElementById('btn-conflict-overwrite')?.addEventListener('click', () => {
             // Wir übernehmen den Zeitstempel des Servers, damit der nächste Save durchgeht
             this.updatedAt = document.getElementById('conflict-server-ts').dataset.ts;
             document.getElementById('modal-conflict').classList.remove('open');
             this.save(); // Erneut speichern (überschreiben)
        });

        document.getElementById('btn-conflict-load')?.addEventListener('click', () => {
             // Server Inhalt laden
             this.content = document.getElementById('conflict-server-content').value;
             this.updatedAt = document.getElementById('conflict-server-ts').dataset.ts;
             this.dom.editor.value = this.content;
             this.parseAndRender();
             document.getElementById('modal-conflict').classList.remove('open');
             this.dom.status.textContent = 'Server-Version geladen';
        });
    }

    bindSettingsEvents() {
        // Range Slider Live Update
        document.getElementById('set-cal-height')?.addEventListener('input', (e) => {
            document.getElementById('val-cal-height').textContent = e.target.value + '%';
        });

        // Save Settings
        document.getElementById('btn-save-settings')?.addEventListener('click', () => {
            this.config.theme = document.getElementById('set-theme').value;
            this.config.calHeight = parseInt(document.getElementById('set-cal-height').value);
            this.config.defDuration = parseInt(document.getElementById('set-def-dur').value);
            this.config.ganttMinWidth = parseInt(document.getElementById('set-gantt-min').value);
            this.config.calStartHour = parseInt(document.getElementById('set-cal-start').value);
            this.config.calEndHour = parseInt(document.getElementById('set-cal-end').value);
            
            const days = [];
            document.querySelectorAll('.set-day-chk:checked').forEach(el => days.push(parseInt(el.value)));
            this.config.visibleDays = days;

            const colors = [];
            for(let i=1; i<=5; i++) colors.push(document.getElementById(`set-p${i}`).value);
            this.config.prioColors = colors;

            this.applyGlobalSettings();
            this.parseAndRender();
            this.save();
            document.getElementById('modal-settings').classList.remove('open');
        });

        // Reset Settings
        document.getElementById('btn-reset-settings')?.addEventListener('click', () => {
            if(!confirm('Einstellungen wirklich zurücksetzen?')) return;
            this.config = { ...this.defaultConfig };
            this.populateSettingsForm();
            this.applyGlobalSettings();
            this.parseAndRender();
            this.save();
        });
    }

    populateSettingsForm() {
        const c = this.config;
        document.getElementById('set-theme').value = c.theme || 'dark';
        document.getElementById('set-cal-height').value = c.calHeight || 50;
        document.getElementById('val-cal-height').textContent = (c.calHeight||50) + '%';
        document.getElementById('set-def-dur').value = c.defDuration || 20;
        document.getElementById('set-gantt-min').value = c.ganttMinWidth || 60;
        document.getElementById('set-cal-start').value = c.calStartHour ?? 0;
        document.getElementById('set-cal-end').value = c.calEndHour ?? 24;
        
        // Days Checkboxes
        document.querySelectorAll('.set-day-chk').forEach(el => {
            el.checked = (c.visibleDays || []).includes(parseInt(el.value));
        });

        // Color Inputs
        if(c.prioColors) {
            c.prioColors.forEach((col, i) => {
                const el = document.getElementById(`set-p${i+1}`);
                if(el) el.value = col;
            });
        }
    }

    updateGenPreview() {
        let tag = "";
        const days = Array.from(document.querySelectorAll('.day-chk:checked')).map(el => el.value);
        
        if(days.length > 0) {
            tag = `[w ${days.join(',')}]`;
        } else {
            const intNum = document.getElementById('gen-interval-num').value;
            const intType = document.getElementById('gen-interval-type').value;
            if(intNum) {
                tag = `[w +${intNum}${intType}]`;
            } else {
                const fixDay = document.getElementById('gen-fix-day').value;
                const fixMonth = document.getElementById('gen-fix-month').value;
                if(fixDay) {
                    tag = `[w ${fixDay.padStart(2,'0')}${fixMonth ? '.'+fixMonth : ''}]`;
                }
            }
        }
        
        const bisDate = document.getElementById('gen-end-date').value;
        if(bisDate && tag) tag += ` [bis ${bisDate}]`;
        
        this.dom.genPreview.textContent = tag || "[w ...]";
    }

    insertAtCursor(text) {
        const el = this.dom.editor;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;
        el.value = val.substring(0, start) + text + val.substring(end);
        el.selectionStart = el.selectionEnd = start + text.length;
        el.focus();
        this.content = el.value;
        this.parseAndRender();
        this.save();
    }

    highlightLine(lineIndex) {
        const textarea = this.dom.editor;
        const lines = textarea.value.split(/\r?\n/);
        if(lineIndex >= lines.length) return;
        
        let startPos = 0;
        for(let i=0; i < lineIndex; i++) startPos += lines[i].length + 1;
        const endPos = startPos + lines[lineIndex].length;
        
        textarea.focus();
        textarea.setSelectionRange(startPos, endPos);
        
        const lineHeight = 24; // Geschätzte Zeilenhöhe
        const scrollPos = (lineIndex * lineHeight) - (textarea.clientHeight / 2);
        textarea.scrollTop = scrollPos > 0 ? scrollPos : 0;
    }

    changeWeek(days) {
        const d = new Date(this.calState.refDate);
        d.setDate(d.getDate() + days);
        this.calState.refDate = d;
        this.parseAndRender();
    }

    async save() {
        try {
            const payload = { 
                content: this.content, 
                config: this.config,
                last_synced: this.updatedAt // Optimistic Locking
            };
            
            const res = await fetch(`/api/save/${this.slug}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            if(res.status === 409) {
                // Konflikt erkannt -> Modal anzeigen
                const serverData = await res.json();
                this.handleConflict(serverData);
                return;
            }

            if(res.ok) {
                const json = await res.json();
                this.updatedAt = json.updated_at; // Update local ref
                this.dom.status.textContent = 'Gespeichert';
            }
        } catch (e) { 
            console.error(e); 
            this.dom.status.textContent = 'Fehler!'; 
        }
    }

    handleConflict(data) {
        this.dom.status.textContent = 'Konflikt!';
        document.getElementById('conflict-server-content').value = data.server_content;
        
        const tsEl = document.getElementById('conflict-server-ts');
        tsEl.textContent = new Date(data.server_updated_at).toLocaleString();
        tsEl.dataset.ts = data.server_updated_at;
        
        document.getElementById('modal-conflict').classList.add('open');
    }

    toggleSort(type) {
        const current = this.config.sorts[type] || 'default';
        this.config.sorts[type] = current === 'default' ? 'asc' : (current === 'asc' ? 'desc' : 'default');
        this.parseAndRender();
        this.save();
    }

    // -------------------------------------------------------------------------
    // CORE PARSING LOGIC
    // -------------------------------------------------------------------------

    parseAndRender() {
        const lines = this.content.split(/\r?\n/);
        const items = [];
        const todayStr = new Date().toISOString().split('T')[0]; 
        const defDur = (this.config.defDuration || 20) * 60000;
        
        lines.forEach((line, idx) => {
            const trim = line.trim();
            // Regex Update: Akzeptiert [] und [-] am Anfang
            if(!trim.match(/^(\[\]|\[-\])/)) return;

            const item = {
                id: idx,
                raw: trim,
                title: trim,
                type: 'a', // Default: Task
                prio: 0,
                start: null,
                end: null,
                recur: null,
                recurUntil: null
            };

            // 1. Typ erkennen
            if(/\[n\]/i.test(trim)) item.type = 'n';
            else if(/\[t\]/i.test(trim)) item.type = 't';

            // 2. Priorität
            const pMatch = trim.match(/\[p([1-5])\]/i);
            if(pMatch) item.prio = parseInt(pMatch[1]);

            // 3. Wiederholung
            const wMatch = trim.match(/\[w\s+([^\]]+)\]/i);
            if(wMatch) item.recur = wMatch[1].toLowerCase().replace(/\s/g, '');

            const bMatch = trim.match(/\[bis\s+([\d-]+)\]/i);
            if(bMatch) item.recurUntil = new Date(bMatch[1] + 'T23:59:59');

            // 4. Datum & Zeit Parsing Helper
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

            // Datumsformat normalisieren (dd.mm.yyyy -> yyyy-mm-dd)
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

            // Logik für fehlende Daten auffüllen
            const hasExplicitStart = (sTime !== null) || (trim.match(/\[s/i));
            const hasExplicitEnd = (eTime !== null) || (trim.match(/\[e/i));

            if (!sDateStr && eDateStr) sDateStr = eDateStr;
            if (!eDateStr && sDateStr) eDateStr = sDateStr;
            if (!sDateStr && !item.recur) sDateStr = todayStr;
            if (!eDateStr && !item.recur) eDateStr = todayStr;
            
            // Bei Recurrence und fehlendem Startdatum -> Heute annehmen als Basis
            if (item.recur && !sDateStr) sDateStr = todayStr;
            if (item.recur && !eDateStr) eDateStr = todayStr;

            let defaultETime = "00:00";
            if(sDateStr && !eTime) defaultETime = "17:00"; // Wenn Datum da, aber keine Endzeit -> 17 Uhr

            const finalSTime = sTime || "00:00";
            const finalETime = eTime || defaultETime;

            item.start = new Date(`${sDateStr}T${finalSTime}:00`);
            item.end = new Date(`${eDateStr}T${finalETime}:00`);

            // Dauer berechnen / korrigieren
            if (hasExplicitStart && !hasExplicitEnd) {
                item.end = new Date(item.start.getTime() + defDur);
            } else if (hasExplicitEnd && !hasExplicitStart) {
                item.start = new Date(item.end.getTime() - defDur);
            } else if (!hasExplicitStart && !hasExplicitEnd) {
                item.end = new Date(item.start.getTime() + defDur);
            }

            // Cleanup Title (Entfernt auch [-] und [])
            item.title = item.title
                .replace(/^(\[\]|\[-\])\s*/, '')
                .replace(/\[[ant]\]/gi, '')
                .replace(/\[p[1-5]\]/gi, '')
                .replace(/\[[se](z|t)?\s*[\d\-\.:]+\s*\]/gi, '')
                .replace(/\[w\s+[^\]]+\]/gi, '')
                .replace(/\[bis\s+[^\]]+\]/gi, '')
                .trim();
                
            if(!isNaN(item.start)) {
                items.push(item);
            }
        });

        this.renderColumns(items);
        this.renderCalendar(items);
    }

    renderColumns(items) {
        const fmt = new Intl.DateTimeFormat(this.config.locale, { 
            day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'
        });
        
        const createHTML = (i) => {
            let meta = '';
            if(i.recur) {
                meta = `<div class="card-meta">↻ Wiederkehrend</div>`;
            } else if(i.start) {
                meta = `<div class="card-meta">📅 ${fmt.format(i.start)}</div>`;
            }
            
            return `<div class="card prio-${i.prio} type-${i.type}" data-id="${i.id}" style="cursor:pointer">
                        <div class="card-title">${this.escapeHtml(i.title)}</div>
                        ${meta}
                    </div>`;
        };
        
        const sortFn = (list, type) => {
             const mode = this.config.sorts[type];
             if(!mode || mode === 'default') return list;
             
             return list.sort((a,b) => {
                 if(type === 'tasks') {
                     // Tasks nach Prio sortieren
                     return mode === 'asc' ? a.prio - b.prio : b.prio - a.prio;
                 }
                 // Andere nach Datum
                 return mode === 'asc' ? a.start - b.start : b.start - a.start;
             });
        };

        const tasks = items.filter(i => i.type === 'a');
        const notes = items.filter(i => i.type === 'n');
        const dates = items.filter(i => i.type === 't');

        this.dom.tasks.innerHTML = sortFn(tasks, 'tasks').map(createHTML).join('');
        this.dom.notes.innerHTML = sortFn(notes, 'notes').map(createHTML).join('');
        this.dom.dates.innerHTML = sortFn(dates, 'dates').map(createHTML).join('');
        
        // Buttons aktualisieren
        ['tasks', 'notes', 'dates'].forEach(k => {
             const btn = document.querySelector(`button[data-sort="${k}"]`);
             if(btn) {
                 const m = this.config.sorts[k];
                 btn.innerHTML = m === 'asc' ? '⬆' : (m === 'desc' ? '⬇' : '⇅');
             }
        });
    }

    expandItems(items, rangeStart, rangeEnd) {
        const expanded = [];
        items.forEach(item => {
            // Keine Wiederholung? -> Einfach prüfen ob im Zeitraum
            if (!item.recur) {
                if (item.end >= rangeStart && item.start <= rangeEnd) {
                    expanded.push(item);
                }
                return;
            }

            // Wiederholungs-Logik
            let cursor = new Date(Math.max(rangeStart.getTime(), item.start.getTime()));
            cursor.setHours(0,0,0,0);
            
            let limit = new Date(rangeEnd);
            if(item.recurUntil && item.recurUntil < limit) limit = item.recurUntil;

            const duration = item.end.getTime() - item.start.getTime();
            const startHours = item.start.getHours();
            const startMins = item.start.getMinutes();

            while (cursor <= limit) {
                let match = false;
                
                // A) Wochentage (mo,di,fr)
                if (/^[a-z,]+$/.test(item.recur)) {
                    const dayName = cursor.toLocaleDateString('de-DE', {weekday:'short'}).toLowerCase().substring(0,2);
                    if (item.recur.includes(dayName)) match = true;
                }
                // B) Intervalle (+2w, +3t)
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
                // C) Fixer Tag (24.12)
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
                    newItem.isVirtual = true; // Markierung für UI
                    expanded.push(newItem);
                }
                cursor.setDate(cursor.getDate() + 1);
            }
        });
        return expanded;
    }

    renderCalendar(items) {
        this.ensureNavControls();
        this.updateViewButtons();
        
        const validItems = items.filter(i => i.start && i.end);
        
        if(this.config.view === 'week') {
            this.renderWeekView(validItems);
        } else {
            this.renderGanttView(validItems);
        }
    }

    ensureNavControls() {
        if(document.getElementById('cal-prev')) return;
        
        const ctrls = document.querySelector('.cal-controls');
        const div = document.createElement('div');
        div.innerHTML = `
            <button id="cal-prev" class="cal-nav-btn">&lt;</button>
            <button id="cal-today" class="cal-nav-btn">Heute</button>
            <button id="cal-next" class="cal-nav-btn">&gt;</button>
            <span id="cal-label" style="font-weight:bold; margin-left:10px"></span>
        `;
        ctrls.prepend(div);
    }
    
    updateViewButtons() {
        document.querySelectorAll('.view-btn').forEach(btn => 
            btn.classList.toggle('active', btn.dataset.view === this.config.view));
    }

    renderWeekView(items) {
        const container = this.dom.calRender;
        const ref = this.calState.refDate;
        
        // Wochenstart berechnen (Montag)
        const day = ref.getDay();
        const diff = ref.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(ref); 
        monday.setDate(diff); 
        monday.setHours(0,0,0,0);
        
        const sunday = new Date(monday); 
        sunday.setDate(monday.getDate() + 6); 
        sunday.setHours(23,59,59,999);

        // Config Vars
        const visibleDaysIdx = this.config.visibleDays || [1,2,3,4,5,6,0];
        const startH = this.config.calStartHour ?? 0;
        const endH = this.config.calEndHour ?? 24;
        const totalH = endH - startH;

        const visibleItems = this.expandItems(items, monday, sunday);
        
        // Header Label setzen
        const fmt = new Intl.DateTimeFormat(this.config.locale, { day:'2-digit', month:'2-digit', year: 'numeric' });
        document.getElementById('cal-label').textContent = `${fmt.format(monday)} - ${fmt.format(sunday)}`;

        if(visibleDaysIdx.length === 0) {
            container.innerHTML = '<div style="padding:20px">Keine Tage ausgewählt.</div>';
            return;
        }

        // --- GRID HEADER BAUEN ---
        let html = `<div class="week-header" style="grid-template-columns: 50px repeat(${visibleDaysIdx.length}, 1fr);">
                        <div class="day-head">Zeit</div>`;
                        
        const daysToRender = [];
        for(let i=0; i<7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            if(visibleDaysIdx.includes(d.getDay())) {
                daysToRender.push(d);
            }
        }
        
        const fmtDay = new Intl.DateTimeFormat(this.config.locale, { weekday:'short', day:'2-digit' });
        daysToRender.forEach(d => {
             const isToday = d.toDateString() === new Date().toDateString();
             html += `<div class="day-head ${isToday?'today':''}">${fmtDay.format(d)}</div>`;
        });
        html += '</div>';

        // --- GRID BODY BAUEN ---
        html += `<div class="week-grid" style="grid-template-columns: 50px repeat(${visibleDaysIdx.length}, 1fr);">
                    <div class="time-col" style="height: ${totalH * 60}px;">`;
                    
        for(let h=startH; h<endH; h++) {
            html += `<div class="time-label">${h}:00</div>`;
        }
        html += '</div>';

        // Spalten rendern
        daysToRender.forEach(d => {
            const currentDayStart = new Date(d); currentDayStart.setHours(0,0,0,0);
            const currentDayEnd = new Date(d); currentDayEnd.setHours(23,59,59,999);
            
            html += `<div class="day-col" style="height: ${totalH * 60}px;">`;
            
            // Events filtern
            const dayItemsRaw = visibleItems.filter(item => item.start < currentDayEnd && item.end > currentDayStart);
            const mainEvents = [];
            const stripEvents = [];

            // Aufteilen in Haupt-Events und Streifen (Fortsetzungen)
            dayItemsRaw.forEach(item => {
                const visStart = item.start < currentDayStart ? currentDayStart : item.start;
                const visEnd = item.end > currentDayEnd ? currentDayEnd : item.end;
                const durationMins = (visEnd - visStart) / 60000;

                if (item.start < currentDayStart) {
                    stripEvents.push({ ...item, visStart, visEnd, durationMins });
                } else {
                    mainEvents.push({ ...item, visStart, visEnd, durationMins, isHead: true });
                }
            });

            // Layout Berechnung (Packing)
            mainEvents.sort((a,b) => a.visStart - b.visStart);
            const columns = [];
            mainEvents.forEach(ev => {
                let placed = false;
                for (let i = 0; i < columns.length; i++) {
                    if (ev.visStart >= columns[i][columns[i].length - 1].visEnd) {
                        columns[i].push(ev);
                        ev.colIndex = i;
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    columns.push([ev]);
                    ev.colIndex = columns.length - 1;
                }
            });

            const numCols = columns.length;
            
            // Rendering Main Events
            mainEvents.forEach(item => {
                let startMinsTotal = (item.visStart.getHours() * 60) + item.visStart.getMinutes();
                let top = startMinsTotal - (startH * 60);
                let height = item.durationMins;

                // Clipping
                if (top < 0) { height += top; top = 0; }
                if (top + height > (totalH * 60)) height = (totalH * 60) - top;

                const widthPercent = 96 / numCols;
                const leftPercent = (item.colIndex * widthPercent) + 1;
                
                if (height > 0) {
                    html += `<div class="cal-event type-${item.type} ${item.isVirtual?'recurring':''}" data-id="${item.id}"
                                  style="top:${top}px; height:${height}px; width:${widthPercent}%; left:${leftPercent}%;"
                                  title="${this.escapeHtml(item.title)}">
                                  ${this.escapeHtml(item.title)}
                             </div>`;
                }
            });

            // Rendering Strips
            stripEvents.sort((a,b) => a.visStart - b.visStart);
            const stripCols = [];
            stripEvents.forEach(ev => {
                let placed = false;
                for(let i=0; i<stripCols.length; i++) {
                    if (ev.visStart >= stripCols[i][stripCols[i].length-1].visEnd) {
                        stripCols[i].push(ev); ev.stripIndex = i; placed = true; break;
                    }
                }
                if(!placed) { stripCols.push([ev]); ev.stripIndex = stripCols.length - 1; }
            });

            stripEvents.forEach((item, idx) => { // stripIndex könnte man auch nutzen, hier vereinfacht
                let startMinsTotal = (item.visStart.getHours() * 60) + item.visStart.getMinutes();
                let top = startMinsTotal - (startH * 60);
                let height = (item.visEnd - item.visStart) / 60000;
                
                if(top < 0) { height += top; top = 0; }
                if(top + height > (totalH * 60)) height = (totalH * 60) - top;
                
                const rightPos = (item.stripIndex * 27) + 2;

                if (height > 0) {
                    html += `<div class="cal-strip" data-id="${item.id}"
                                  style="top:${top}px; height:${height}px; width:25px; right:${rightPos}px;"
                                  title="${this.escapeHtml(item.title)} (Fortsetzung)">
                                  ${this.escapeHtml(item.title)}
                             </div>`;
                }
            });

            html += '</div>'; // End day-col
        });
        
        html += '</div>'; // End week-grid
        container.innerHTML = html;
        
        // Scroll to Start Hour (if not 0)
        if(container.scrollTop === 0) {
            const scrollH = 8 - startH;
            if(scrollH > 0) container.scrollTop = scrollH * 60;
        }
    }

    renderGanttView(items) {
        const container = this.dom.calRender;
        document.getElementById('cal-label').textContent = "Projektablauf (30 Tage Vorschau)";
        
        const today = new Date(); 
        today.setHours(0,0,0,0);
        
        const future = new Date(today); 
        future.setDate(today.getDate() + 30);
        
        const visibleItems = this.expandItems(items, today, future)
            .filter(i => i.type === 'a')
            .sort((a,b) => a.start - b.start);

        if(visibleItems.length === 0) {
            container.innerHTML = '<div style="padding:20px; color:#888">Keine Aufgaben im Zeitraum.</div>';
            return;
        }

        let minT = visibleItems[0].start.getTime();
        let maxT = visibleItems[0].end.getTime();
        
        visibleItems.forEach(t => { 
            if(t.start.getTime() < minT) minT = t.start.getTime(); 
            if(t.end.getTime() > maxT) maxT = t.end.getTime(); 
        });
        
        const startDate = new Date(minT); 
        startDate.setHours(0,0,0,0);
        
        const endDate = new Date(maxT); 
        endDate.setDate(endDate.getDate() + 1);
        
        const gridMin = startDate.getTime();
        const totalDuration = endDate.getTime() - gridMin;
        const totalDays = Math.ceil(totalDuration / 86400000);
        
        const minW = this.config.ganttMinWidth || 60;
        const pxPerDay = Math.max(minW, (container.clientWidth - 200) / totalDays);
        const finalTotalWidth = totalDays * pxPerDay;
        const pxPerMs = finalTotalWidth / totalDuration;

        let html = `<div class="gantt-wrapper">
                        <div class="g-sidebar">
                            <div class="g-header-title">Aufgaben</div>
                            ${visibleItems.map(t => 
                                `<div class="g-task-row" data-id="${t.id}" style="cursor:pointer">
                                    ${this.escapeHtml(t.title)}
                                </div>`
                            ).join('')}
                        </div>
                        <div class="g-timeline-area">
                            <div class="g-timeline-header" style="width: ${finalTotalWidth}px">`;
                            
        for(let i=0; i<totalDays; i++) {
            const d = new Date(startDate); 
            d.setDate(startDate.getDate() + i);
            html += `<div style="position:absolute; left:${i*pxPerDay}px; width:${pxPerDay}px; font-size:0.7rem; border-left:1px solid #555; padding-left:4px;">
                        ${d.toLocaleDateString([], {weekday:'short', day:'2-digit'})}
                     </div>`;
        }
        
        html += `</div>
                 <div class="g-body" style="width: ${finalTotalWidth}px">
                    ${visibleItems.map(t => {
                        const left = (t.start.getTime() - gridMin) * pxPerMs;
                        const width = (t.end.getTime() - t.start.getTime()) * pxPerMs;
                        return `<div class="g-body-row">
                                    <div class="g-bar-item" data-id="${t.id}" style="left:${left}px; width:${width}px; cursor:pointer;">
                                        ${this.escapeHtml(t.title)}
                                    </div>
                                </div>`;
                    }).join('')}
                 </div>
              </div>
           </div>`;
           
        container.innerHTML = html;
    }
}

new App();