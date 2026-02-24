/* public/assets/js/modules/window-manager.js */

export class WindowManager {
    constructor(appInstance) {
        this.app = appInstance;
        this.popups = {
            kanban: null,
            calendar: null,
            gantt: null
        };
        
        this.localElements = {
            kanban: document.getElementById('projections-pane'),
            calendar: document.getElementById('calendar-pane'),
            resizerX: document.getElementById('resizer-editor')
        };
        
        window.addEventListener('message', (event) => {
            if (event.data.type === 'popup-ready') {
                this.syncToPopup(event.source, event.data.module);
            }
        });

        setInterval(() => this.checkClosedPopups(), 1000);
    }

    detach(moduleType) {
        if (this.popups[moduleType] && !this.popups[moduleType].closed) {
            this.popups[moduleType].focus();
            return;
        }

        const width = 1000;
        const height = 800;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        // KORREKTUR: Nutze BASE_PATH für korrekte URL-Bildung
        const baseUrl = (window.BASE_PATH || '').replace(/\/$/, '');
        const url = `${baseUrl}/view/${moduleType}/${this.app.slug}`;
        
        const win = window.open(url, `PlainNote_${moduleType}`, 
            `width=${width},height=${height},top=${top},left=${left},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`);

        if (!win) {
            alert("Popup blockiert.");
            return;
        }

        this.popups[moduleType] = win;
        this.updateLocalVisibility();
    }

    updateLocalVisibility() {
        // Kanban Logic: Wenn abgedockt, Editor auf volle Breite
        if (this.isDetached('kanban')) {
            if(this.localElements.kanban) this.localElements.kanban.style.display = 'none';
            document.documentElement.style.setProperty('--editor-width', '100%');
            if(this.localElements.resizerX) this.localElements.resizerX.style.display = 'none';
        } else {
            if(this.localElements.kanban) this.localElements.kanban.style.display = 'flex';
            document.documentElement.style.setProperty('--editor-width', `${this.app.config.editorWidth}%`);
            if(this.localElements.resizerX) this.localElements.resizerX.style.display = 'block';
        }

        // Calendar/Gantt Logic
        const calDetached = this.isDetached('calendar');
        const ganttDetached = this.isDetached('gantt');
        
        if (calDetached || ganttDetached) {
            if(this.localElements.calendar) this.localElements.calendar.style.display = 'none';
        } else {
            if(this.localElements.calendar) this.localElements.calendar.style.display = 'flex';
        }
        
        window.dispatchEvent(new Event('resize'));
    }

    isDetached(type) {
        return this.popups[type] && !this.popups[type].closed;
    }

    checkClosedPopups() {
        let changed = false;
        ['kanban', 'calendar', 'gantt'].forEach(type => {
            if (this.popups[type] && this.popups[type].closed) {
                this.popups[type] = null;
                changed = true;
            }
        });
        if (changed) {
            this.updateLocalVisibility();
            this.app.runPipeline(); 
        }
    }

    broadcastUpdate() {
        ['kanban', 'calendar', 'gantt'].forEach(type => {
            if (this.isDetached(type)) {
                this.syncToPopup(this.popups[type], type);
            }
        });
    }

    syncToPopup(win, type) {
        win.postMessage({
            type: 'update-data',
            content: this.app.content,
            config: this.app.config,
            forceView: type === 'gantt' ? 'gantt' : (type === 'calendar' ? 'week' : null)
        }, '*');
    }

    print() {
        // Druck-Klasse setzen und nach kurzer Pause drucken
        document.body.classList.add('print-view-editor');
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('print-view-editor');
            }, 500); 
        }, 100);
    }
}