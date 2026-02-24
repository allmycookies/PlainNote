/* public/assets/js/module-client.js */
import { parseContent } from './modules/parser.js';
import { renderColumns } from './modules/ui.js';
import { renderCalendar } from './modules/calendar.js';

class ModuleApp {
    constructor() {
        this.data = window.SERVER_DATA || {};
        this.type = window.MODULE_TYPE; // 'kanban', 'calendar', 'gantt'
        this.dom = {
            projections: document.getElementById('projections-pane'),
            calRender: document.getElementById('calendar-render')
        };
        
        this.calState = { refDate: new Date() };

        // Initial Render (F5 Support)
        if (this.data.content) {
            this.run(this.data.content, this.data.config);
        }

        // Listener für Updates vom Hauptfenster
        window.addEventListener('message', (e) => {
            if (e.data.type === 'update-data') {
                this.run(e.data.content, e.data.config, e.data.forceView);
            }
        });

        // Events für Interaktion im Popup (z.B. Kalender Navigation)
        this.initEvents();

        // Melden beim Hauptfenster
        if (window.opener) {
            window.opener.postMessage({ type: 'popup-ready', module: this.type }, '*');
        }
    }

    run(content, config, forceView) {
        // Config klonen um View zu überschreiben falls nötig
        const localConfig = { ...config };
        
        // Wende Theme an
        this.applyTheme(localConfig.theme);
        this.applyCSSVars(localConfig);

        const items = parseContent(content, localConfig);

        if (this.type === 'kanban') {
            renderColumns(items, localConfig, this.dom);
        } 
        else if (this.type === 'calendar' || this.type === 'gantt') {
            // Erzwinge View basierend auf Modul-Typ
            localConfig.view = this.type === 'gantt' ? 'gantt' : 'week';
            renderCalendar(items, localConfig, this.dom, this.calState);
        }
    }

    applyTheme(theme) {
        const root = document.documentElement;
        if(theme === 'light') {
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
    }

    applyCSSVars(c) {
        const root = document.documentElement;
        if(c.prioColors) c.prioColors.forEach((col, i) => root.style.setProperty(`--prio-${i+1}`, col));
        if(c.markerColors) c.markerColors.forEach((col, i) => root.style.setProperty(`--marker-${i+1}`, col));
    }

    initEvents() {
        document.body.addEventListener('click', (e) => {
            // Kalender Navigation
            if(e.target.closest('#cal-prev')) {
                const d = new Date(this.calState.refDate);
                d.setDate(d.getDate() - 7);
                this.calState.refDate = d;
                // Re-Render mit aktuellen Daten aus Window-Scope (müssen wir speichern?)
                // Einfachheitshalber: Wir warten auf nächstes Update oder nutzen cached data
                // Besser: Wir speichern den letzten Content state
                if(this.lastContent && this.lastConfig) {
                    this.run(this.lastContent, this.lastConfig);
                } else {
                    // Fallback auf Server Data
                    this.run(this.data.content, this.data.config);
                }
            }
            if(e.target.closest('#cal-next')) {
                const d = new Date(this.calState.refDate);
                d.setDate(d.getDate() + 7);
                this.calState.refDate = d;
                if(this.lastContent) this.run(this.lastContent, this.lastConfig);
                else this.run(this.data.content, this.data.config);
            }
            if(e.target.closest('#cal-today')) {
                this.calState.refDate = new Date();
                if(this.lastContent) this.run(this.lastContent, this.lastConfig);
                else this.run(this.data.content, this.data.config);
            }
        });
    }

    // Override run um Daten zu cachen für Navigation
    run(content, config, forceView) {
        this.lastContent = content;
        this.lastConfig = config;
        super.run ? super.run(content, config, forceView) : this._runInternal(content, config, forceView);
    }

    _runInternal(content, config, forceView) {
        const localConfig = { ...config };
        this.applyTheme(localConfig.theme);
        this.applyCSSVars(localConfig);
        
        if (this.type === 'gantt') localConfig.view = 'gantt';
        else if (this.type === 'calendar') localConfig.view = 'week';

        const items = parseContent(content, localConfig);

        if (this.type === 'kanban') {
            renderColumns(items, localConfig, this.dom);
        } else {
            renderCalendar(items, localConfig, this.dom, this.calState);
        }
    }
}

new ModuleApp();