/* public/assets/js/app.js */

import { save } from './modules/api.js';
import { parseContent, expandItems } from './modules/parser.js'; 
import { renderColumns } from './modules/ui.js';
import { renderCalendar } from './modules/calendar.js';
import { bindEditorEvents, highlightLine, insertAtCursor, refreshHighlights } from './modules/editor.js';
import { WindowManager } from './modules/window-manager.js';

export class App {
    constructor() {
        const data = window.SERVER_DATA || {};
        this.slug = data.slug;
        this.content = data.content || '';
        this.updatedAt = data.updated_at || null;
        this.allSlugs = data.allSlugs || [];
        this.defaultConfig = {
            locale: 'de-DE', 
            view: 'week', 
            sorts: {},
            theme: 'dark', 
            calHeight: 50,
            editorWidth: 60,
            minColWidth: 250,
            defDuration: 20, 
            ganttMinWidth: 60,
            calStartHour: 0, 
            calEndHour: 24,
            visibleDays: [1,2,3,4,5,6,0],
            prioColors: ['#ff4d4d', '#ff9e4d', '#ffd24d', '#4dff88', '#4d9eff'],
            markerColors: ['#e06c75', '#d19a66', '#e5c07b', '#98c379', '#56b6c2', '#61afef', '#c678dd', '#be5046', '#abb2bf'],
            columns: [
                { id: 'c1', name: 'Aufgaben', token: 'a', showInCalendar: true },
                { id: 'c2', name: 'Notizen', token: 'n', showInCalendar: false },
                { id: 'c3', name: 'Termine', token: 't', showInCalendar: true }
            ]
        };
        this.config = { ...this.defaultConfig, ...(data.config || {}) };
        
        if(!this.config.columns || this.config.columns.length === 0) {
            this.config.columns = this.defaultConfig.columns;
        }

        this.dom = {
            editor: document.getElementById('editor'),
            highlights: document.getElementById('editor-highlights'),
            status: document.getElementById('save-status'),
            projections: document.getElementById('projections-pane'),
            calRender: document.getElementById('calendar-render'),
            genPreview: document.getElementById('gen-preview'),
            banner: document.getElementById('update-banner')
        };

        this.calState = { refDate: new Date() };
        this.quickCal = { displayDate: new Date(), selectedDate: new Date(), existing: null };
        this.planState = {
            lineText: '', lineStart: 0, lineEnd: 0, dateStr: '',
            startMin: 0, endMin: 0, isDragging: false, isResizing: false,
            isCreating: false, startDragY: 0, startDragMin: 0, createStartMin: 0
        };
        
        // Window Manager initialisieren
        this.windowManager = new WindowManager(this);
        
        this.saveTimeout = null;
        this.lastInputTime = 0; 
        this.checkInterval = null;

        if(this.dom.editor) {
            this.dom.editor.value = this.content;
            this.applyGlobalSettings();
            this.initEvents();
            this.runPipeline();
            this.initHeartbeat();
            this.initDragAndDrop();
            this.initResizers();
        }
    }

    applyGlobalSettings() {
        const root = document.documentElement;
        const c = this.config;
        
        // Nur anwenden, wenn Kanban nicht detached ist, sonst überschreibt WM das
        if (!this.windowManager.isDetached('kanban')) {
            const edW = c.editorWidth || 60;
            root.style.setProperty('--editor-width', `${edW}%`);
        }
        
        const colMin = c.minColWidth || 250;
        root.style.setProperty('--col-min-width', `${colMin}px`);
        if(c.theme === 'light') {
            root.style.setProperty('--bg-dark', '#f5f5f5');
            root.style.setProperty('--bg-panel', '#ffffff');
            root.style.setProperty('--border', '#e0e0e0');
            root.style.setProperty('--text-main', '#333333');
            root.style.setProperty('--text-muted', '#666666');
        } else {
            root.style.setProperty('--bg-dark', '#1e1e1e');
            root.style.setProperty('--bg-panel', '#252526');
            root.style.setProperty('--border', '#3e3e42');
            root.style.setProperty('--text-main', '#d4d4d4');
            root.style.setProperty('--text-muted', '#858585');
        }

        if(c.prioColors && c.prioColors.length === 5) {
            c.prioColors.forEach((col, i) => {
                root.style.setProperty(`--prio-${i+1}`, col);
            });
        }
        
        if(c.markerColors && c.markerColors.length === 9) {
            c.markerColors.forEach((col, i) => {
                root.style.setProperty(`--marker-${i+1}`, col);
            });
        }

        if(c.calHeight) {
            root.style.setProperty('--cal-height', `${c.calHeight}%`);
        }
    }

    getLineInfo(editor) {
        const pos = editor.selectionStart;
        const val = editor.value;
        const start = val.lastIndexOf('\n', pos - 1) + 1;
        let end = val.indexOf('\n', pos);
        if (end === -1) end = val.length;
        return { start, end, text: val.substring(start, end) };
    }

    updateQuickModalFields(type) {
        const existing = this.quickCal.existing ? this.quickCal.existing[type] : null;
        const now = new Date();

        if (existing) {
            if(existing.date) {
               let d = new Date(existing.date);
               if(isNaN(d.getTime()) && existing.date.includes('.')) {
                   const parts = existing.date.split('.');
                   const y = parts[2] || now.getFullYear();
                   d = new Date(`${y}-${parts[1]}-${parts[0]}`);
               }
               
               if(!isNaN(d.getTime())) {
                   this.quickCal.displayDate = d;
                   this.quickCal.selectedDate = d;
               } else {
                   this.quickCal.displayDate = now;
                   this.quickCal.selectedDate = now;
               }
            } else {
                this.quickCal.displayDate = now;
                this.quickCal.selectedDate = now;
            }

            if(existing.time) {
                document.getElementById('quick-time').value = existing.time;
            } else {
                document.getElementById('quick-time').value = '';
            }
        } else {
            this.quickCal.displayDate = now;
            this.quickCal.selectedDate = now;
            document.getElementById('quick-time').value = now.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
        }
        this.renderQuickCalendar();
    }

    initResizers() {
        const resizerX = document.getElementById('resizer-editor');
        const resizerY = document.getElementById('resizer-calendar');
        let isDraggingX = false;
        let isDraggingY = false;

        if (resizerX) {
            resizerX.addEventListener('mousedown', (e) => {
                isDraggingX = true;
                document.body.classList.add('is-resizing');
                resizerX.classList.add('active');
                e.preventDefault();
            });
        }

        if (resizerY) {
            resizerY.addEventListener('mousedown', (e) => {
                isDraggingY = true;
                document.body.classList.add('is-resizing');
                resizerY.classList.add('active');
                e.preventDefault();
            });
        }

        window.addEventListener('mousemove', (e) => {
            if (isDraggingX) {
                const totalWidth = window.innerWidth;
                let newWidthPct = (e.clientX / totalWidth) * 100;
                newWidthPct = Math.max(10, Math.min(newWidthPct, 90));
                this.config.editorWidth = Math.round(newWidthPct);
                document.documentElement.style.setProperty('--editor-width', `${this.config.editorWidth}%`);

                const setEdW = document.getElementById('set-editor-width');
                if (setEdW) setEdW.value = this.config.editorWidth;
                const valEdW = document.getElementById('val-editor-width');
                if (valEdW) valEdW.textContent = this.config.editorWidth + '%';
            }

            if (isDraggingY) {
                const totalHeight = window.innerHeight;
                let newHeightPct = ((totalHeight - e.clientY) / totalHeight) * 100;
                newHeightPct = Math.max(10, Math.min(newHeightPct, 90));
                this.config.calHeight = Math.round(newHeightPct);
                document.documentElement.style.setProperty('--cal-height', `${this.config.calHeight}%`);

                const setCalH = document.getElementById('set-cal-height');
                if (setCalH) setCalH.value = this.config.calHeight;
                const valCalH = document.getElementById('val-cal-height');
                if (valCalH) valCalH.textContent = this.config.calHeight + '%';
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDraggingX || isDraggingY) {
                isDraggingX = false;
                isDraggingY = false;
                document.body.classList.remove('is-resizing');
                if (resizerX) resizerX.classList.remove('active');
                if (resizerY) resizerY.classList.remove('active');

                this.triggerSave();
            }
        });
    }

    initEvents() {
        bindEditorEvents(this.dom, {
            onInput: (newContent) => {
                this.content = newContent;
                this.lastInputTime = Date.now();
                this.dom.status.textContent = '...';
                this.dom.banner.classList.remove('show');
 
               this.runPipeline();
                clearTimeout(this.saveTimeout);
                this.saveTimeout = setTimeout(() => this.triggerSave(), 1000);
            },
            onCtrl5: () => {
                const info = this.getLineInfo(this.dom.editor);
                const parse = (prefix) => {
                    const dateRe = new RegExp(`\\[${prefix}(\\d{4}-\\d{2}-\\d{2}|\\d{2}\\.\\d{2}\\.(\\d{4})?)\\]`, 'i');
                    const dateM = info.text.match(dateRe);
                    
                    const timeRe = new RegExp(`\\[${prefix}(\\d{1,2}:\\d{2})\\]`, 'i');
                    const timeM = info.text.match(timeRe);

                    return { 
                        date: dateM ? dateM[1] : null, 
                        time: timeM ? timeM[1] : null 
                    };
                };
                
                this.quickCal.existing = {
                    s: parse('s'),
                    e: parse('e')
                };
                document.getElementById('quick-type-start').checked = true;
                document.getElementById('modal-quick-insert').classList.add('open');
                this.updateQuickModalFields('s');
            },
            onCtrl7: (lineText, dateStr, lineStart, lineEnd) => {
                this.initPlanningMode(lineText, dateStr, lineStart, lineEnd);
            }
        });

        // Global Click Handler
        document.body.addEventListener('click', (e) => {
            // Detach Buttons
            if(e.target.closest('#btn-detach-kanban')) this.windowManager.detach('kanban');
            if(e.target.closest('#btn-detach-cal')) this.windowManager.detach('calendar');
            if(e.target.closest('#btn-detach-gantt')) this.windowManager.detach('gantt');

            // Print Action für Editor
            if(e.target.closest('#btn-print-text')) {
                this.windowManager.print();
            }

            const sortBtn = e.target.closest('button[data-sort]');
            if(sortBtn) {
                const type = sortBtn.dataset.sort;
                const current = this.config.sorts[type] || 'default';
                this.config.sorts[type] = current === 'default' ? 'asc' : (current === 'asc' ? 'desc' : 'default');
                this.runPipeline();
                this.triggerSave();
            }

            const viewBtn = e.target.closest('.view-btn');
            if(viewBtn) {
                this.config.view = viewBtn.dataset.view;
                this.runPipeline();
                this.triggerSave();
            }

            if(e.target.closest('#cal-prev')) {
                const d = new Date(this.calState.refDate);
                d.setDate(d.getDate() - 7);
                this.calState.refDate = d;
                this.runPipeline();
            }
            if(e.target.closest('#cal-next')) {
                const d = new Date(this.calState.refDate);
                d.setDate(d.getDate() + 7);
                this.calState.refDate = d;
                this.runPipeline();
            }
            if(e.target.closest('#cal-today')) {
                this.calState.refDate = new Date();
                this.runPipeline();
            }
            if(e.target.closest('#qc-prev')) {
                this.quickCal.displayDate.setMonth(this.quickCal.displayDate.getMonth() - 1);
                this.renderQuickCalendar();
            }
            if(e.target.closest('#qc-next')) {
                this.quickCal.displayDate.setMonth(this.quickCal.displayDate.getMonth() + 1);
                this.renderQuickCalendar();
            }
            const qDay = e.target.closest('.quick-cal-day');
            if(qDay && !qDay.classList.contains('empty')) {
                const y = parseInt(qDay.dataset.year);
                const m = parseInt(qDay.dataset.month);
                const d = parseInt(qDay.dataset.day);
                this.quickCal.selectedDate = new Date(y, m, d);
                this.renderQuickCalendar();
            }

            const itemTarget = e.target.closest('.card, .cal-event, .cal-strip, .g-bar-item, .g-task-row');
            if(itemTarget && itemTarget.dataset.id) {
                highlightLine(this.dom, parseInt(itemTarget.dataset.id));
            }

            if(e.target.id === 'btn-s-date') document.getElementById('pick-s-date').showPicker();
            if(e.target.id === 'btn-s-time') document.getElementById('pick-s-time').showPicker();
            if(e.target.id === 'btn-e-date') document.getElementById('pick-e-date').showPicker();
            if(e.target.id === 'btn-e-time') document.getElementById('pick-e-time').showPicker();
            
            if(e.target.id === 'btn-load-remote') {
                 window.location.reload();
            }
            
            if(e.target.closest('.btn-remove-col')) {
                e.target.closest('.col-setting-row').remove();
            }
            if(e.target.id === 'btn-add-col') {
                this.appendColumnSettingRow();
            }
        });
        
        document.getElementById('set-editor-width')?.addEventListener('input', (e) => {
            // Nur aktualisieren wenn Kanban attached ist
            if(!this.windowManager.isDetached('kanban')) {
                document.getElementById('val-editor-width').textContent = e.target.value + '%';
                document.documentElement.style.setProperty('--editor-width', `${e.target.value}%`);
            }
        });
        document.getElementById('set-col-min-width')?.addEventListener('input', (e) => {
            document.documentElement.style.setProperty('--col-min-width', `${e.target.value}px`);
        });
        this.bindModalEvents();
    }

    // ... (restliche Methoden unverändert, werden aus dem vorherigen Stand übernommen)
    initDragAndDrop() {
        this.dom.projections.addEventListener('dragstart', (e) => {
            if(e.target.classList.contains('card')) {
                e.dataTransfer.setData('text/plain', e.target.dataset.id);
                e.dataTransfer.effectAllowed = 'move';
                const lane = e.target.closest('.lane');
                if(lane) e.dataTransfer.setData('source-token', lane.dataset.token);
            }
        });
        this.dom.projections.addEventListener('dragover', (e) => {
            const lane = e.target.closest('.lane');
            if(lane) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                lane.classList.add('drag-over');
   
         }
        });
        this.dom.projections.addEventListener('dragleave', (e) => {
            const lane = e.target.closest('.lane');
            if(lane) lane.classList.remove('drag-over');
        });
        this.dom.projections.addEventListener('drop', (e) => {
            e.preventDefault();
            const lane = e.target.closest('.lane');
            if(!lane) return;

            lane.classList.remove('drag-over');
            
            const lineId = parseInt(e.dataTransfer.getData('text/plain'));
       
            const sourceToken = e.dataTransfer.getData('source-token');
            const targetToken = lane.dataset.token;

            if(sourceToken === targetToken) return;

            this.moveItemToColumn(lineId, targetToken);
        });
    }

    moveItemToColumn(lineId, targetToken) {
        if(isNaN(lineId)) return;

        const lines = this.content.split(/\r?\n/);
        if(lineId >= lines.length) return;

        let line = lines[lineId];
        let newLine = line;
        let replaced = false;
        for(const col of this.config.columns) {
            const esc = col.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`\\[${esc}\\]`, 'i');
            if(re.test(newLine)) {
                newLine = newLine.replace(re, `[${targetToken}]`);
                replaced = true;
                break;
            }
        }

        if(!replaced) {
            newLine = newLine + ` [${targetToken}]`;
        }

        lines[lineId] = newLine;
        const newContent = lines.join('\n');

        this.dom.editor.value = newContent;
        this.content = newContent;
        this.lastInputTime = Date.now();
        refreshHighlights(this.dom);
        this.runPipeline();
        this.triggerSave();
    }
    
    renderQuickCalendar() {
        const grid = document.getElementById('quick-calendar-grid');
        const title = document.getElementById('quick-calendar-title');
        const ref = this.quickCal.displayDate;
        
        const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
        title.textContent = `${monthNames[ref.getMonth()]} ${ref.getFullYear()}`;
        
        const y = ref.getFullYear(), m = ref.getMonth();
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        
        const startOffset = (firstDay === 0 ? 6 : firstDay - 1);
        let html = '';
        const dayHeads = ['Mo','Di','Mi','Do','Fr','Sa','So'];
        dayHeads.forEach(d => html += `<div class="quick-cal-th">${d}</div>`);
        for(let i=0; i<startOffset; i++) {
            html += `<div class="quick-cal-day empty"></div>`;
        }
        
        const now = new Date();
        const sel = this.quickCal.selectedDate;

        for(let d=1; d<=daysInMonth; d++) {
            let classes = ['quick-cal-day'];
            if(y === now.getFullYear() && m === now.getMonth() && d === now.getDate()) classes.push('today');
            if(y === sel.getFullYear() && m === sel.getMonth() && d === sel.getDate()) classes.push('selected');
            
            html += `<div class="${classes.join(' ')}" data-year="${y}" data-month="${m}" data-day="${d}">${d}</div>`;
        }
        
        grid.innerHTML = html;
        const pad = (n) => n.toString().padStart(2, '0');
        document.getElementById('quick-date-hidden').value = `${sel.getFullYear()}-${pad(sel.getMonth()+1)}-${pad(sel.getDate())}`;
    }

    initPlanningMode(lineText, dateStr, lineStart, lineEnd) {
        this.planState.lineText = lineText;
        this.planState.dateStr = dateStr;
        this.planState.lineStart = lineStart;
        this.planState.lineEnd = lineEnd;
        
        const sTime = lineText.match(/\[s(\d{2}:\d{2})\]/);
        const eTime = lineText.match(/\[e(\d{2}:\d{2})\]/);
        if (sTime) {
            const parts = sTime[1].split(':');
            this.planState.startMin = parseInt(parts[0])*60 + parseInt(parts[1]);
        } else {
            this.planState.startMin = -1;
        }

        if (eTime) {
            const parts = eTime[1].split(':');
            this.planState.endMin = parseInt(parts[0])*60 + parseInt(parts[1]);
        } else {
             if(this.planState.startMin !== -1) {
                 this.planState.endMin = this.planState.startMin + (this.config.defDuration || 20);
             } else {
                 this.planState.endMin = -1;
             }
        }

        document.getElementById('plan-date-title').textContent = new Date(dateStr).toLocaleDateString('de-DE', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
        document.getElementById('modal-planning').classList.add('open');
        this.renderPlanningGrid();
    }

    renderPlanningGrid() {
        const container = document.getElementById('plan-render-area');
        const startH = this.config.calStartHour ?? 0;
        const endH = this.config.calEndHour ?? 24;
        const totalMin = (endH - startH) * 60;
        let html = `<div class="plan-time-grid">`;

        for (let h = startH; h < endH; h++) {
            const top = (h - startH) * 60;
            html += `<div class="plan-hour-line" style="top:${(top / totalMin) * 100}%"></div>`;
            html += `<div class="plan-time-label" style="top:${(top / totalMin) * 100}%">${h}:00</div>`;
            for(let q=15; q<60; q+=15) {
                 html += `<div class="plan-quarter-line" style="top:${((top+q) / totalMin) * 100}%"></div>`;
            }
        }
        
        const allItems = parseContent(this.content, this.config);
        const targetDateStart = new Date(this.planState.dateStr + 'T00:00:00');
        const targetDateEnd = new Date(this.planState.dateStr + 'T23:59:59');
        const dayEvents = expandItems(allItems, targetDateStart, targetDateEnd).filter(ev => {
            return ev.start >= targetDateStart && ev.end <= targetDateEnd;
        });
        dayEvents.forEach(ev => {
            const startM = ev.start.getHours()*60 + ev.start.getMinutes();
            const endM = ev.end.getHours()*60 + ev.end.getMinutes();
            
            const viewStart = startH * 60;
            const viewEnd = endH * 60;
            if (endM <= viewStart || startM >= viewEnd) return;
            
            const renderStart = Math.max(startM, viewStart) - viewStart;
            const renderEnd = Math.min(endM, viewEnd) - viewStart;
            const height = renderEnd - renderStart;

            const topPct = (renderStart / totalMin) * 100;
            const heightPct = (height / totalMin) * 100;
            
            html += `<div class="plan-block" style="top:${topPct}%; height:${heightPct}%;">
                        ${ev.title}
                     </div>`;
        });
        if (this.planState.startMin !== -1 && this.planState.endMin !== -1) {
             const viewStart = startH * 60;
             const activeStart = Math.max(this.planState.startMin, viewStart) - viewStart;
             const duration = this.planState.endMin - this.planState.startMin;
             const topPct = (activeStart / totalMin) * 100;
             const heightPct = (duration / totalMin) * 100;
             
             let classes = "plan-active-block";
             const mMatch = this.planState.lineText.match(/\[m(\d)\]/);
             if(mMatch) classes += ` marker-${mMatch[1]}`;
             const pMatch = this.planState.lineText.match(/\[p(\d)\]/);
             if(pMatch) classes += ` prio-${pMatch[1]}`;
             let title = this.planState.lineText.replace(/\[.*?\]/g, '').trim();

             html += `<div id="plan-active-el" class="${classes}" style="top:${topPct}%; height:${heightPct}%;">
                        <span>${title || "Neuer Termin"}</span>
                        <div class="resize-handle"></div>
                      </div>`;
        }

        html += `</div>`; 
        container.innerHTML = html;

        this.attachPlanningEvents(container, totalMin, startH);
    }

    attachPlanningEvents(container, totalMin, startH) {
        const activeEl = document.getElementById('plan-active-el');
        const getMinutesFromY = (y) => {
            const rect = container.getBoundingClientRect();
            const relY = y - rect.top;
            const pct = relY / rect.height;
            let mins = (pct * totalMin) + (startH * 60);
            return Math.round(mins / 15) * 15;
        };
        const onMouseDown = (e) => {
            if (e.target.classList.contains('resize-handle')) {
                this.planState.isResizing = true;
                this.planState.startDragY = e.clientY;
                e.stopPropagation();
            } else if (e.target.id === 'plan-active-el' || e.target.closest('#plan-active-el')) {
                this.planState.isDragging = true;
                this.planState.startDragMin = getMinutesFromY(e.clientY);
                this.planState.origStart = this.planState.startMin;
            } else {
                this.planState.isCreating = true;
                const clickMin = getMinutesFromY(e.clientY);
                this.planState.createStartMin = clickMin;
                this.planState.startMin = clickMin;
                this.planState.endMin = clickMin + 15; 
                this.renderPlanningGrid(); 
                this.planState.isCreating = false;
                this.planState.isResizing = true;
            }
        };
        const onMouseMove = (e) => {
            if (this.planState.isDragging) {
                const currentMin = getMinutesFromY(e.clientY);
                const diff = currentMin - this.planState.startDragMin;
                const duration = this.planState.endMin - this.planState.startMin;
                
                let newStart = this.planState.origStart + diff;
                if (newStart < (startH*60)) newStart = (startH*60);
                
                this.planState.startMin = newStart;
                this.planState.endMin = newStart + duration;
                this.updateActiveBlockVisual(totalMin, startH);
            }
            else if (this.planState.isResizing) {
                const currentMin = getMinutesFromY(e.clientY);
                if (currentMin > this.planState.startMin) {
                    this.planState.endMin = currentMin;
                    this.updateActiveBlockVisual(totalMin, startH);
                }
            }
        };
        const onMouseUp = () => {
            this.planState.isDragging = false;
            this.planState.isResizing = false;
            this.planState.isCreating = false;
        };

        container.onmousedown = onMouseDown;
        window.onmousemove = onMouseMove; 
        window.onmouseup = onMouseUp;
    }

    updateActiveBlockVisual(totalMin, startH) {
        const el = document.getElementById('plan-active-el');
        if(!el) return;
        const viewStart = startH * 60;
        const renderStart = Math.max(this.planState.startMin, viewStart) - viewStart;
        const duration = this.planState.endMin - this.planState.startMin;
        el.style.top = (renderStart / totalMin) * 100 + '%';
        el.style.height = (duration / totalMin) * 100 + '%';
    }

    savePlanning() {
        const formatTime = (mins) => {
            const h = Math.floor(mins / 60).toString().padStart(2,'0');
            const m = (mins % 60).toString().padStart(2,'0');
            return `${h}:${m}`;
        };

        const sStr = `[s${formatTime(this.planState.startMin)}]`;
        const eStr = `[e${formatTime(this.planState.endMin)}]`;
        let newLine = this.planState.lineText;
        
        if (/\[s\d{2}:\d{2}\]/.test(newLine)) {
            newLine = newLine.replace(/\[s\d{2}:\d{2}\]/, sStr);
        } else {
            newLine += ` ${sStr}`;
        }

        if (/\[e\d{2}:\d{2}\]/.test(newLine)) {
            newLine = newLine.replace(/\[e\d{2}:\d{2}\]/, eStr);
        } else {
            newLine += ` ${eStr}`;
        }
        
        newLine = newLine.replace(/\s+/g, ' ');
        const fullVal = this.dom.editor.value;
        const newVal = fullVal.substring(0, this.planState.lineStart) + newLine + fullVal.substring(this.planState.lineEnd);
        
        this.dom.editor.value = newVal;
        refreshHighlights(this.dom);
        
        this.content = newVal;
        this.lastInputTime = Date.now();
        this.runPipeline();
        this.triggerSave();
        
        document.getElementById('modal-planning').classList.remove('open');
    }

    bindModalEvents() {
        const toggle = (id, show) => {
            const el = document.getElementById(id);
            if(show) el.classList.add('open'); 
            else el.classList.remove('open');
        };

        document.getElementById('btn-recur')?.addEventListener('click', () => { 
            toggle('modal-recur', true); 
            this.updateGenPreview(); 
        });
        document.getElementById('btn-help')?.addEventListener('click', () => toggle('modal-help', true));
        document.getElementById('btn-settings')?.addEventListener('click', () => { 
            this.populateSettingsForm(); 
            toggle('modal-settings', true); 
        });
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => toggle(e.target.closest('.modal-overlay').id, false));
        });
        document.querySelectorAll('#modal-recur input, #modal-recur select').forEach(el => 
            el.addEventListener('input', () => this.updateGenPreview()));
        document.getElementById('btn-insert-recur')?.addEventListener('click', () => {
            const tag = this.dom.genPreview.textContent;
            toggle('modal-recur', false);
            insertAtCursor(this.dom, ' ' + tag, (val) => {
                this.content = val;
                this.lastInputTime = Date.now();
              
  this.runPipeline();
                this.triggerSave();
            });
        });
        document.getElementById('btn-quick-cancel')?.addEventListener('click', () => {
            toggle('modal-quick-insert', false);
            this.dom.editor.focus();
        });
        document.querySelectorAll('input[name="quick-type"]').forEach(el => {
            el.addEventListener('change', (e) => {
                this.updateQuickModalFields(e.target.value);
            });
        });
        document.getElementById('btn-quick-ok')?.addEventListener('click', () => {
            const type = document.querySelector('input[name="quick-type"]:checked').value;
            const dateVal = document.getElementById('quick-date-hidden').value;
            const timeVal = document.getElementById('quick-time').value;

            let newTags = "";
            if(dateVal) newTags += `[${type}${dateVal}]`;
  
            if(dateVal && timeVal) newTags += " ";
            if(timeVal) newTags += `[${type}${timeVal}]`;

            toggle('modal-quick-insert', false);
            
            if(newTags || (!dateVal && !timeVal)) {
                const info = this.getLineInfo(this.dom.editor); 
                let line = info.text;

      
      const removeRe = new RegExp(`\\[${type}[\\d\\.\\-:]+\\]`, 'gi');
                line = line.replace(removeRe, '');
                line = line.replace(/\s{2,}/g, ' ').trim();
                if(newTags) {
                    line = line + " " + newTags;
                }
                
                const val = this.dom.editor.value;
                const newVal = val.substring(0, info.start) + line + val.substring(info.end);
                
                this.dom.editor.value = newVal;
                refreshHighlights(this.dom);
                this.content = newVal;
                this.lastInputTime = Date.now();
                this.runPipeline();
                this.triggerSave();
            }
        });
        document.getElementById('btn-plan-save')?.addEventListener('click', () => {
            this.savePlanning();
        });
        document.getElementById('btn-save-settings')?.addEventListener('click', () => {
            this.config.theme = document.getElementById('set-theme').value;
            this.config.calHeight = parseInt(document.getElementById('set-cal-height').value);
            this.config.defDuration = parseInt(document.getElementById('set-def-dur').value);
            this.config.ganttMinWidth = parseInt(document.getElementById('set-gantt-min').value);
            this.config.calStartHour = parseInt(document.getElementById('set-cal-start').value);
            this.config.calEndHour = parseInt(document.getElementById('set-cal-end').value);
            
 
           this.config.editorWidth = parseInt(document.getElementById('set-editor-width').value);
            this.config.minColWidth = parseInt(document.getElementById('set-col-min-width').value);

            const days = [];
            document.querySelectorAll('.set-day-chk:checked').forEach(el => days.push(parseInt(el.value)));
            this.config.visibleDays = days;
            const colors = [];
            for(let i=1; i<=5; i++) colors.push(document.getElementById(`set-p${i}`).value);
            this.config.prioColors = colors;

            const mColors = [];
            for(let i=1; i<=9; i++) mColors.push(document.getElementById(`set-m${i}`).value);
            this.config.markerColors = mColors;

            const newCols = [];
            document.querySelectorAll('.col-setting-row').forEach((row, index) => {
                const name = row.querySelector('.col-name').value;
                const token = row.querySelector('.col-token').value.replace(/[\[\]]/g, '');
                const showInCal = row.querySelector('.col-cal').checked;
                if(name && token) {
             
        newCols.push({
                        id: 'c' + (index + 1),
                        name: name,
                        token: token,
              
          showInCalendar: showInCal
                    });
                }
            });
            this.config.columns = newCols;

            this.applyGlobalSettings();
            this.runPipeline();
            this.triggerSave();
            toggle('modal-settings', false);
        });

        document.getElementById('btn-reset-settings')?.addEventListener('click', () => {
            if(!confirm('Einstellungen wirklich zurücksetzen?')) return;
            this.config = { ...this.defaultConfig };
            this.populateSettingsForm();
            this.applyGlobalSettings();
            this.runPipeline();
            this.triggerSave();
        });
        document.getElementById('btn-conflict-overwrite')?.addEventListener('click', () => {
             this.updatedAt = document.getElementById('conflict-server-ts').dataset.ts;
             document.getElementById('modal-conflict').classList.remove('open');
             this.triggerSave();
        });
        document.getElementById('btn-conflict-load')?.addEventListener('click', () => {
             this.content = document.getElementById('conflict-server-content').value;
             this.updatedAt = document.getElementById('conflict-server-ts').dataset.ts;
             this.dom.editor.value = this.content;
             this.runPipeline();
             document.getElementById('modal-conflict').classList.remove('open');
             this.dom.status.textContent = 'Server-Version geladen';
          
   this.dom.banner.classList.remove('show');
        });
        document.getElementById('set-cal-height')?.addEventListener('input', (e) => {
            document.getElementById('val-cal-height').textContent = e.target.value + '%';
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
        
        document.getElementById('set-editor-width').value = c.editorWidth || 60;
        document.getElementById('val-editor-width').textContent = (c.editorWidth || 60) + '%';
        document.getElementById('set-col-min-width').value = c.minColWidth || 250;
        document.querySelectorAll('.set-day-chk').forEach(el => {
            el.checked = (c.visibleDays || []).includes(parseInt(el.value));
        });
        if(c.prioColors) {
            c.prioColors.forEach((col, i) => {
                const el = document.getElementById(`set-p${i+1}`);
                if(el) el.value = col;
            });
        }
        if(c.markerColors) {
            c.markerColors.forEach((col, i) => {
                const el = document.getElementById(`set-m${i+1}`);
                if(el) el.value = col;
            });
        }

        const container = document.getElementById('settings-cols-container');
        container.innerHTML = '';
        (c.columns || []).forEach(col => {
            this.appendColumnSettingRow(col.name, col.token, col.showInCalendar);
        });
    }

    appendColumnSettingRow(name = '', token = '', showInCal = true) {
        const container = document.getElementById('settings-cols-container');
        const div = document.createElement('div');
        div.className = 'col-setting-row gen-row';
        div.style.gap = '5px';
        div.innerHTML = `
            <input type="text" class="gen-input col-name" placeholder="Name" value="${name}" style="flex:2">
            <span style="color:#666">[</span>
            <input type="text" class="gen-input col-token" placeholder="Token" value="${token}" style="flex:1; text-align:center">
            <span style="color:#666">]</span>
            <label style="display:flex; align-items:center; cursor:pointer;"
title="Im Kalender anzeigen">
                <input type="checkbox" class="col-cal" ${showInCal ?
'checked' : ''}>
                <span style="font-size:0.8rem; margin-left:3px">Cal</span>
            </label>
            <button class="btn-danger btn-remove-col" style="padding:2px 8px;">&times;</button>
        `;
        container.appendChild(div);
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
                    tag = `[w ${fixDay.padStart(2,'0')}${fixMonth ?
'.'+fixMonth : ''}]`;
                }
            }
        }
        
        const bisDate = document.getElementById('gen-end-date').value;
        if(bisDate && tag) tag += ` [bis ${bisDate}]`;
        
        this.dom.genPreview.textContent = tag || "[w ...]";
    }

    runPipeline() {
        const items = parseContent(this.content, this.config);
        
        // Scroll Position sichern
        let scrollPos = { top: 0, left: 0 };
        if (this.dom.calRender) {
            scrollPos.top = this.dom.calRender.scrollTop;
            scrollPos.left = this.dom.calRender.scrollLeft;
        }

        renderColumns(items, this.config, this.dom);
        renderCalendar(items, this.config, this.dom, this.calState);
        
        // Scroll Position wiederherstellen
        if (this.dom.calRender) {
            this.dom.calRender.scrollTop = scrollPos.top;
            this.dom.calRender.scrollLeft = scrollPos.left;
        }

        // Update externer Fenster
        this.windowManager.broadcastUpdate();
    }

    initHeartbeat() {
        if(this.checkInterval) clearInterval(this.checkInterval);
        this.checkInterval = setInterval(async () => {
            const timeSinceInput = Date.now() - this.lastInputTime;
            if (timeSinceInput < 2000) return;

            try {
                const res = await fetch(`/api/check/${this.slug}`);
                if(res.ok) {
            
        const json = await res.json();
                    if (json.updated_at > this.updatedAt) {
                         this.dom.banner.classList.add('show');
                    } else {
                 
         this.dom.banner.classList.remove('show');
                    }
                }
            } catch(e) {
               console.warn("Heartbeat failed", e);
            }
        }, 2000);
    }

    async triggerSave() {
        const newTs = await save(this.slug, this.content, this.config, this.updatedAt, (serverData) => {
            this.dom.status.textContent = 'Konflikt!';
            document.getElementById('conflict-server-content').value = serverData.server_content;
            const tsEl = document.getElementById('conflict-server-ts');
            tsEl.textContent = new Date(serverData.server_updated_at).toLocaleString();
            tsEl.dataset.ts = serverData.server_updated_at;
    
        document.getElementById('modal-conflict').classList.add('open');
            this.dom.banner.classList.remove('show');
        });
        if(newTs) {
            this.updatedAt = newTs;
            this.dom.status.textContent = 'Gespeichert';
            this.dom.banner.classList.remove('show');
        }
    }
}

new App();