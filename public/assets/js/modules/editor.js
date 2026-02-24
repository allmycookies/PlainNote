/* public/assets/js/modules/editor.js */

export function bindEditorEvents(dom, callbacks) {
    let timeout;
    const editor = dom.editor;
    const backdrop = dom.highlights;

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

    // Keydown Listener für Shortcuts
    editor.addEventListener('keydown', (e) => {
        // Prüfen ob STRG gedrückt ist, aber nicht Shift oder Alt
        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            
            // STRG + 1: Neue Item Zeile "[]"
            if (e.key === '1') {
                e.preventDefault();
                insertNewLineWithPrefix(dom, '[]', callbacks.onInput);
            }
            
            // STRG + 2: Neue Beschreibung "<<"
            if (e.key === '2') {
                e.preventDefault();
                insertNewLineWithPrefix(dom, '<<', callbacks.onInput);
            }

            // STRG + 3: Aktuelles Datum [sJJJJ-MM-TT]
            if (e.key === '3') {
                e.preventDefault();
                const tag = `[s${getLocalISOString()}]`;
                insertAtCursor(dom, tag, callbacks.onInput);
            }

            // STRG + 4: Aktuelle Zeit [sHH:mm]
            if (e.key === '4') {
                e.preventDefault();
                const now = new Date();
                const timeStr = now.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
                const tag = `[s${timeStr}]`;
                insertAtCursor(dom, tag, callbacks.onInput);
            }

            // STRG + 5: Picker Modal öffnen
            if (e.key === '5') {
                e.preventDefault();
                if (callbacks.onCtrl5) {
                    callbacks.onCtrl5();
                }
            }

            // STRG + 6: Token links vom Cursor löschen
            if (e.key === '6') {
                e.preventDefault();
                removeLastToken(dom, callbacks.onInput);
            }

            // STRG + 7: Planungs-Modus (Time Blocking)
            if (e.key === '7') {
                e.preventDefault();
                const sel = editor.selectionStart;
                const val = editor.value;
                const lineStart = val.lastIndexOf('\n', sel - 1) + 1;
                let lineEnd = val.indexOf('\n', sel);
                if (lineEnd === -1) lineEnd = val.length;
                
                const lineText = val.substring(lineStart, lineEnd);
                
                // Toleranter Regex für Datum
                const dateMatch = lineText.match(/\[s(\d{4}[-.]\d{1,2}[-.]\d{1,2})\]/);
                
                if (dateMatch) {
                    if (callbacks.onCtrl7) {
                        callbacks.onCtrl7(lineText, dateMatch[1], lineStart, lineEnd);
                    }
                } else {
                    alert("Bitte erst ein Datum mit [sYYYY-MM-DD] in dieser Zeile definieren.");
                }
            }
        }
    });

    // Scroll Sync
    if(backdrop) {
        const handleScroll = () => {
            backdrop.parentElement.scrollTop = editor.scrollTop;
            backdrop.parentElement.scrollLeft = editor.scrollLeft;
        };
        editor.addEventListener('scroll', handleScroll);
        handleScroll();
    }

    // Picker Events
    const attachPicker = (id, prefix) => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            insertAtCursor(dom, `[${prefix}${e.target.value}]`, callbacks.onInput);
        });
    };
    attachPicker('pick-s-date', 's');
    attachPicker('pick-s-time', 's');
    attachPicker('pick-e-date', 'e');
    attachPicker('pick-e-time', 'e');
}

/**
 * Zwingt das Highlighting zur Aktualisierung
 */
export function refreshHighlights(dom) {
    if(dom.editor && dom.highlights) {
        updateHighlight(dom.editor.value, dom.highlights);
    }
}

export function insertAtCursor(dom, text, updateCallback) {
    const el = dom.editor;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;

    const newVal = val.substring(0, start) + text + val.substring(end);
    el.value = newVal;
    
    el.selectionStart = el.selectionEnd = start + text.length;
    el.focus();

    if(dom.highlights) updateHighlight(newVal, dom.highlights);
    if(updateCallback) updateCallback(el.value);
}

function removeLastToken(dom, updateCallback) {
    const el = dom.editor;
    const pos = el.selectionStart;
    const val = el.value;
    const textBefore = val.substring(0, pos);

    const regex = /\[[^\]]*\]\s?$/;
    const match = textBefore.match(regex);

    if (match) {
        const lengthToRemove = match[0].length;
        const newPos = pos - lengthToRemove;
        
        const newVal = val.substring(0, newPos) + val.substring(pos);
        
        el.value = newVal;
        el.selectionStart = el.selectionEnd = newPos;
        
        if(dom.highlights) updateHighlight(newVal, dom.highlights);
        if(updateCallback) updateCallback(newVal);
    }
}

function insertNewLineWithPrefix(dom, prefix, updateCallback) {
    const el = dom.editor;
    const start = el.selectionStart;
    const val = el.value;
    
    const prevChar = val.charAt(start - 1);
    const isAtLineStart = (prevChar === '\n' || start === 0);
    
    let textToInsert = prefix + ' ';
    if (!isAtLineStart) textToInsert = '\n' + textToInsert;
    
    insertAtCursor(dom, textToInsert, updateCallback);
}

function getLocalISOString() {
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function updateHighlight(text, container) {
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Formatierung: //m1// -> span class hl-m1 (Hintergrundfarbe)
    // Regex für //m1// bis //m9//
    html = html.replace(/^(\/\/m([1-9])\/\/)(.*)$/gm, 
        '<span class="hl-fmt">$1</span><span class="hl-m$2">$3</span>');

    html = html.replace(/^(&lt;&lt;.*)$/gm, '<span class="hl-desc">$1</span>');
    html = html.replace(/(\[-\]|\[\])/g, '<span class="hl-tag">$1</span>');
    html = html.replace(/(\[[abcdefghijklmnopqrstuvwxyz]\])/gi, '<span class="hl-tag">$1</span>');
    html = html.replace(/(\[p[1-5]\])/gi, '<span class="hl-prio">$1</span>');
    html = html.replace(/(\[m[1-9]\])/gi, '<span class="hl-marker">$1</span>');
    html = html.replace(/(\[(?:s|e)(?:z|t)?\d{1,2}:\d{2}\])/gi, '<span class="hl-time">$1</span>');
    html = html.replace(/(\[(?:s|e)[\d\.-]{6,}\])/gi, '<span class="hl-date">$1</span>');
    html = html.replace(/(\[(?:w|bis)\s+[^\]]+\])/gi, '<span class="hl-recur">$1</span>');

    if (text.slice(-1) === '\n') html += ' '; 
    container.innerHTML = html;
}

export function highlightLine(dom, rawLineIndex) {
    if (rawLineIndex === undefined || rawLineIndex === null || isNaN(rawLineIndex)) return;
    
    const lineIndex = Math.floor(Number(rawLineIndex));
    if (lineIndex < 0) return;

    const textarea = dom.editor;
    const lines = textarea.value.split(/\r?\n/);
    
    if (lineIndex >= lines.length) return;

    let startPos = 0;
    for(let i = 0; i < lineIndex; i++) {
        const len = lines[i] ? lines[i].length : 0;
        startPos += len + 1; // +1 für Umbruch
    }

    const targetLine = lines[lineIndex];
    const targetLen = targetLine ? targetLine.length : 0;
    const endPos = startPos + targetLen;

    textarea.focus();
    try {
        textarea.setSelectionRange(startPos, endPos);
        const lineHeight = 24; 
        const scrollPos = (lineIndex * lineHeight) - (textarea.clientHeight / 2);
        textarea.scrollTop = scrollPos > 0 ? scrollPos : 0;
    } catch(e) {
        console.warn("Selection error:", e);
    }
}