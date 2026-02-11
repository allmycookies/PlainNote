/* public/assets/js/modules/editor.js */

export function bindEditorEvents(dom, callbacks) {
    let timeout;
    const editor = dom.editor;
    const backdrop = dom.highlights; // Wird von app.js übergeben oder hier ermittelt

    // Initial Highlight Render
    if(editor && backdrop) {
        updateHighlight(editor.value, backdrop);
    }

    // Input with Debounce for Saving, Instant for Highlight
    editor.addEventListener('input', () => {
        // 1. Instant Visual Update
        if(backdrop) updateHighlight(editor.value, backdrop);

        // 2. Debounced Logic (Saving/Parsing)
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            callbacks.onInput(editor.value);
        }, 150);
    });

    // Scroll Sync: Textarea scrollt -> Backdrop scrollt mit
    if(backdrop) {
        const handleScroll = () => {
            backdrop.parentElement.scrollTop = editor.scrollTop;
            backdrop.parentElement.scrollLeft = editor.scrollLeft;
        };
        editor.addEventListener('scroll', handleScroll);
        // Initial sync
        handleScroll();
    }

    // Picker Events
    document.getElementById('pick-s-date')?.addEventListener('change', (e) => {
        insertAtCursor(dom, `[s${e.target.value}]`, callbacks.onInput);
    });
    document.getElementById('pick-s-time')?.addEventListener('change', (e) => {
        insertAtCursor(dom, `[s${e.target.value}]`, callbacks.onInput);
    });
    document.getElementById('pick-e-date')?.addEventListener('change', (e) => {
        insertAtCursor(dom, `[e${e.target.value}]`, callbacks.onInput);
    });
    document.getElementById('pick-e-time')?.addEventListener('change', (e) => {
        insertAtCursor(dom, `[e${e.target.value}]`, callbacks.onInput);
    });
}

/**
 * Fügt Text an der Cursor-Position ein und aktualisiert Highlight + Callback
 */
export function insertAtCursor(dom, text, updateCallback) {
    const el = dom.editor;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;

    const newVal = val.substring(0, start) + text + val.substring(end);
    el.value = newVal;
    
    // Cursor neu setzen
    el.selectionStart = el.selectionEnd = start + text.length;
    el.focus();

    // Highlight sofort aktualisieren
    if(dom.highlights) {
        updateHighlight(newVal, dom.highlights);
    }

    // Callback feuern (Speichern)
    updateCallback(el.value);
}

/**
 * Highlight Logic: Text -> HTML mit Spans
 */
function updateHighlight(text, container) {
    // 1. HTML Escape (Sicherheit & Rendering)
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2. Syntax Replacement Rules (Reihenfolge ist wichtig!)

    // Descriptions (Zeilen die mit << beginnen)
    // gm = global + multiline
    html = html.replace(/^(&lt;&lt;.*)$/gm, '<span class="hl-desc">$1</span>');

    // Entry Tags [-] oder []
    html = html.replace(/(\[-\]|\[\])/g, '<span class="hl-tag">$1</span>');

    // Types [a], [n], [t]
    html = html.replace(/(\[[ant]\])/gi, '<span class="hl-tag">$1</span>');

    // Priority [p1]-[p5]
    html = html.replace(/(\[p[1-5]\])/gi, '<span class="hl-prio">$1</span>');

    // Markers [m1]-[m9]
    html = html.replace(/(\[m[1-9]\])/gi, '<span class="hl-marker">$1</span>');

    // Times [s12:00], [e14:30], [sz...], [et...]
    html = html.replace(/(\[(?:s|e)(?:z|t)?\d{1,2}:\d{2}\])/gi, '<span class="hl-time">$1</span>');

    // Dates [s2026-02-11], [e01.01.]
    html = html.replace(/(\[(?:s|e)[\d\.-]{6,}\])/gi, '<span class="hl-date">$1</span>');

    // Recurring & Until [w ...], [bis ...]
    html = html.replace(/(\[(?:w|bis)\s+[^\]]+\])/gi, '<span class="hl-recur">$1</span>');

    // 3. Trailing Newline Fix
    // Wenn das letzte Zeichen ein Newline ist, rendert HTML das oft nicht.
    // Ein Leerzeichen erzwingt die neue Zeile im Hintergrund-Div.
    if (text.slice(-1) === '\n') {
        html += ' '; 
    }

    container.innerHTML = html;
}

export function highlightLine(dom, lineIndex) {
    const textarea = dom.editor;
    const lines = textarea.value.split(/\r?\n/);
    if(lineIndex >= lines.length) return;

    let startPos = 0;
    for(let i=0; i < lineIndex; i++) startPos += lines[i].length + 1;
    const endPos = startPos + lines[lineIndex].length;

    textarea.focus();
    textarea.setSelectionRange(startPos, endPos);

    const lineHeight = 24; // Ca. Zeilenhöhe in Pixeln (muss zum CSS passen)
    const scrollPos = (lineIndex * lineHeight) - (textarea.clientHeight / 2);
    
    // Scrollen (Listener syncronisiert das Backdrop automatisch)
    textarea.scrollTop = scrollPos > 0 ? scrollPos : 0;
}