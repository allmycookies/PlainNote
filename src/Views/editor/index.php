<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <!-- Viewport ist entscheidend für Mobile -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>PlainNote / <?= htmlspecialchars($slug) ?></title>
    
    <link rel="stylesheet" href="<?=$basePath?>/assets/css/style.css">
    <link rel="stylesheet" href="<?=$basePath?>/assets/css/print.css">
    
    <!-- NEU: Mobile CSS, wird nur geladen/aktiviert wenn Bildschirm < 768px -->
    <link rel="stylesheet" href="<?=$basePath?>/assets/css/mobile.css" media="(max-width: 768px)">
    
    <script>
        // Server Daten und Basis-Pfad für JS verfügbar machen
        window.SERVER_DATA = <?= json_encode($payload, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
        window.BASE_PATH = "<?=$basePath?>"; 
    </script>
    <script type="module" src="<?=$basePath?>/assets/js/app.js"></script>
</head>
<body>
    <header>
        <a href="<?=$basePath?>/" class="brand" style="margin-right:10px">PlainNote</a>
        <select id="project-selector" onchange="window.location.href=this.value">
            <option value="<?=$basePath?>/">Dashboard...</option>
            <?php foreach($payload['allSlugs'] as $s): ?>
                <option value="<?=$basePath?>/s/<?=$s?>" <?= $s === $slug ? 'selected' : '' ?>><?=htmlspecialchars($s)?></option>
            <?php endforeach; ?>
        </select>
        
        <div style="margin-left:auto; display:flex; gap:10px; align-items:center">
            
            <div style="display:flex; gap:2px; border-right:1px solid #444; padding-right:10px;">
                <button class="tool-btn icon-btn" id="btn-detach-kanban" title="Kanban abdocken">⧉ K</button>
                <button class="tool-btn icon-btn" id="btn-detach-cal" title="Kalender abdocken">⧉ C</button>
                <button class="tool-btn icon-btn" id="btn-detach-gantt" title="Gantt abdocken">⧉ G</button>
            </div>

            <div style="display:flex; gap:2px; border-right:1px solid #444; padding-right:10px;">
                <button class="tool-btn icon-btn" id="btn-print-text" title="Text drucken">🖨 T</button>
                <!-- Print Buttons für Module entfernt, da nicht unterstützt -->
            </div>

            <div id="save-status" style="font-size:0.8rem; color:#888">Bereit</div>
            <a href="<?=$basePath?>/" class="btn-secondary" style="padding:2px 8px; font-size:0.8rem; text-decoration:none">Exit</a>
        </div>
    </header>

    <main>
        <section class="editor-pane">
            <div class="resizer-x" id="resizer-editor"></div>
            <div class="editor-toolbar">
                <div class="tool-group">
                    <label>Start</label>
                    <button id="btn-s-date" class="tool-btn">📅</button>
                    <button id="btn-s-time" class="tool-btn">🕒</button>
                </div>
                <div class="tool-group">
                    <label>Ende</label>
                    <button id="btn-e-date" class="tool-btn">📅</button>
                    <button id="btn-e-time" class="tool-btn">🕒</button>
                </div>
                <div class="tool-group" style="margin-left:auto">
                    <button id="btn-recur" class="tool-btn">↻</button>
                    <button id="btn-settings" class="tool-btn">⚙</button>
                    <button id="btn-help" class="tool-btn">?</button>
                </div>

                <input type="date" id="pick-s-date" style="display:none">
                <input type="time" id="pick-s-time" style="display:none">
                <input type="date" id="pick-e-date" style="display:none">
                <input type="time" id="pick-e-time" style="display:none">
            </div>
            <div id="update-banner" class="update-notification">
                <span>⚠ Es gibt eine neuere Version dieses Projekts.</span>
                <button id="btn-load-remote" class="btn-update-load">Neue Einträge laden</button>
            </div>

            <div class="editor-wrapper">
                <div class="editor-backdrop">
                    <div class="editor-highlights" id="editor-highlights"></div>
                </div>
                <textarea id="editor" spellcheck="false" placeholder="Start typing..."></textarea>
            </div>
        </section>

        <section class="projections-pane" id="projections-pane"></section>
    </main>
    
    <footer id="calendar-pane">
        <div class="resizer-y" id="resizer-calendar"></div>
        <div class="cal-controls">
            <span>Ansicht:</span>
            <button class="view-btn" data-view="gantt">Gantt</button>
            <button class="view-btn" data-view="week">Woche</button>
        </div>
        <div id="calendar-render"></div>
    </footer>

    <!-- Modals (Kurzform für Übersichtlichkeit, Inhalt bleibt gleich) -->
    <div id="modal-planning" class="modal-overlay">
        <div class="modal" style="width: 800px; height: 90vh; max-width: 98%;">
            <div class="modal-header">
                <span id="plan-date-title">Planung</span>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body" style="padding:0; position:relative; overflow:hidden;">
                 <div class="plan-container" id="plan-render-area"></div>
            </div>
            <div class="modal-footer">
                <span style="font-size:0.8rem; color:#888; margin-right:auto;">Ziehen: Erstellen/Verschieben. Unten: Größe.</span>
                <button class="modal-close btn-secondary">Abbrechen</button>
                <button id="btn-plan-save" class="btn-primary">Übernehmen</button>
            </div>
        </div>
    </div>

    <div id="modal-quick-insert" class="modal-overlay">
        <div class="modal" style="width: 400px;">
            <div class="modal-header">
                <span>Zeitstempel einfügen</span>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="gen-section">
                    <label class="gen-label">Typ</label>
                    <div class="radio-group">
                        <label><input type="radio" name="quick-type" value="s" id="quick-type-start" checked> Start</label>
                        <label><input type="radio" name="quick-type" value="e" id="quick-type-end"> Ende</label>
                    </div>
                </div>
                <div class="gen-section">
                    <label class="gen-label">Datum</label>
                    <div id="quick-calendar-wrapper">
                        <div class="quick-cal-header">
                            <button class="quick-cal-btn" id="qc-prev">&lt;</button>
                            <span class="quick-cal-title" id="quick-calendar-title"></span>
                            <button class="quick-cal-btn" id="qc-next">&gt;</button>
                        </div>
                        <div class="quick-cal-grid" id="quick-calendar-grid"></div>
                    </div>
                    <input type="hidden" id="quick-date-hidden">
                </div>
                <div class="gen-section">
                    <label class="gen-label">Uhrzeit</label>
                    <input type="time" id="quick-time" class="gen-input">
                </div>
            </div>
            <div class="modal-footer">
                <button id="btn-quick-cancel" class="btn-secondary">Abbrechen</button>
                <button id="btn-quick-ok" class="btn-primary">OK</button>
            </div>
        </div>
    </div>

    <div id="modal-recur" class="modal-overlay">
        <div class="modal">
            <div class="modal-header">
                <span>Wiederholung erstellen</span>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="gen-section">
                    <label class="gen-label">1. Wochentage</label>
                    <div class="day-toggles">
                        <?php
                        $days = ['mo'=>'Mo','di'=>'Di','mi'=>'Mi','do'=>'Do','fr'=>'Fr','sa'=>'Sa','so'=>'So'];
                        foreach($days as $val => $label): ?>
                            <label>
                                <input type="checkbox" value="<?= $val ?>" class="chk-hidden day-chk">
                                <span class="chk-btn"><?= $label ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>
                <div class="gen-section">
                    <label class="gen-label">2. Intervall</label>
                    <div style="display:flex; gap:10px">
                        <input type="number" id="gen-interval-num" class="gen-input" placeholder="Anzahl" min="1">
                        <select id="gen-interval-type" class="gen-input">
                            <option value="t">Tage</option>
                            <option value="w">Wochen</option>
                            <option value="m">Monate</option>
                        </select>
                    </div>
                </div>
                <div class="gen-section">
                    <label class="gen-label">3. Fixer Tag</label>
                    <div style="display:flex; gap:10px">
                        <input type="number" id="gen-fix-day" class="gen-input" placeholder="Tag" min="1" max="31">
                        <select id="gen-fix-month" class="gen-input">
                            <option value="">Jeden Monat</option>
                            <option value="01">Januar</option>
                            <option value="12">Dezember</option>
                        </select>
                    </div>
                </div>
                <div class="gen-section">
                    <label class="gen-label">Ende (Optional)</label>
                    <input type="date" id="gen-end-date" class="gen-input">
                </div>
                <div style="background:#222; padding:10px; margin-top:10px; border-radius:4px">
                    <code id="gen-preview" style="color:#4dff88">[w ...]</code>
                </div>
            </div>
            <div class="modal-footer">
                <button id="btn-insert-recur" class="btn-primary">Einfügen</button>
            </div>
        </div>
    </div>

    <div id="modal-settings" class="modal-overlay">
        <div class="modal" style="width: 550px;">
            <div class="modal-header">
                <span>Einstellungen</span>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="gen-section">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <label class="gen-label" style="margin:0">Kanban Spalten</label>
                        <button id="btn-add-col" class="tool-btn" style="background:none; border:none; color:var(--accent); font-weight:bold">+ Spalte</button>
                    </div>
                    <div id="settings-cols-container"></div>
                </div>

                <div class="gen-section">
                    <label class="gen-label">Layout</label>
                    <div class="gen-row">
                        <span>Editor Breite</span>
                        <div style="flex:1; display:flex; align-items:center; gap:10px; margin-left:10px;">
                            <input type="range" id="set-editor-width" min="20" max="80" step="5" style="flex:1">
                            <span id="val-editor-width" style="width:40px; text-align:right">60%</span>
                        </div>
                    </div>
                    <div class="gen-row">
                        <span>Min. Spaltenbreite (px)</span>
                        <input type="number" id="set-col-min-width" class="gen-input gen-input-small" min="150" max="500">
                    </div>
                </div>

                <div class="gen-section">
                    <label class="gen-label">Kalender Ansicht</label>
                    <div class="gen-row">
                        <span>Höhe</span>
                        <div style="flex:1; display:flex; align-items:center; gap:10px; margin-left:10px;">
                            <input type="range" id="set-cal-height" min="20" max="90" step="5" style="flex:1">
                            <span id="val-cal-height" style="width:40px; text-align:right">50%</span>
                        </div>
                    </div>
                    <div class="gen-row">
                        <span>Stunden (Start - Ende)</span>
                        <div style="display:flex; gap:5px">
                            <input type="number" id="set-cal-start" class="gen-input gen-input-small" min="0" max="23">
                            <span>-</span>
                            <input type="number" id="set-cal-end" class="gen-input gen-input-small" min="1" max="24">
                        </div>
                    </div>
                    <div class="gen-row">
                        <span>Sichtbare Tage</span>
                    </div>
                    <div class="day-toggles">
                        <?php
                        $visDays = [1=>'Mo', 2=>'Di', 3=>'Mi', 4=>'Do', 5=>'Fr', 6=>'Sa', 0=>'So'];
                        foreach($visDays as $val => $label): ?>
                            <label>
                                <input type="checkbox" value="<?= $val ?>" class="chk-hidden set-day-chk">
                                <span class="chk-btn"><?= $label ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="gen-section">
                    <label class="gen-label">Design & Farben</label>
                    <div class="gen-row">
                        <span>Theme</span>
                        <select id="set-theme" class="gen-input" style="width:120px">
                            <option value="dark">Dunkel</option>
                            <option value="light">Hell</option>
                        </select>
                    </div>
                    <label class="gen-label" style="margin-top:10px">Prioritäten (P1 - P5)</label>
                    <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:5px">
                      <?php for($i=1; $i<=5; $i++): ?>
                            <div class="color-field">
                                <input type="color" id="set-p<?= $i ?>" style="width:100%; height:30px; border:none; background:none; cursor:pointer">
                            </div>
                        <?php endfor; ?>
                    </div>
                    
                    <label class="gen-label" style="margin-top:10px">Marker (M1 - M9)</label>
                    <div style="display:grid; grid-template-columns:repeat(9,1fr); gap:5px">
                        <?php for($i=1; $i<=9; $i++): ?>
                            <div class="color-field">
                                <input type="color" id="set-m<?= $i ?>" style="width:100%; height:30px; border:none; background:none; cursor:pointer">
                            </div>
                        <?php endfor; ?>
                    </div>
                </div>

                <div class="gen-section">
                    <label class="gen-label">Standards</label>
                    <div class="gen-row">
                        <span>Std. Dauer (Min)</span>
                        <input type="number" id="set-def-dur" class="gen-input gen-input-small" min="5">
                    </div>
                    <div class="gen-row">
                        <span>Gantt Min-Breite (px)</span>
                        <input type="number" id="set-gantt-min" class="gen-input gen-input-small" min="20" max="200">
                    </div>
                </div>

                <div style="margin-top:20px; text-align:right; font-size:0.7rem; color:#555">
                    Version <?= $version ?>
                </div>
            </div>
            <div class="modal-footer" style="justify-content:space-between">
                <button id="btn-reset-settings" class="btn-danger">Reset</button>
                <button id="btn-save-settings" class="btn-primary">Speichern</button>
            </div>
        </div>
    </div>

    <div id="modal-help" class="modal-overlay">
        <div class="modal" style="width: 700px; max-width: 95%; max-height: 90vh;">
            <div class="modal-header">
                <span>Syntax Referenz & Anleitung</span>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p style="color: #888; margin-bottom: 20px; font-size: 0.9rem;">
                    PlainNote wird primär über Text-Tags gesteuert. Jede Zeile, die mit <code>[-]</code> oder <code>[]</code> beginnt, wird als Eintrag erkannt.
                </p>

                <!-- Doku für Headings (jetzt m-Tags) -->
                <h3 style="border-bottom: 1px solid #444; padding-bottom: 5px; margin-top: 0;">0. Formatierung (Neu)</h3>
                <table class="help-table">
                     <tr>
                        <th style="width: 140px;">Syntax</th>
                        <th>Beschreibung</th>
                    </tr>
                    <tr>
                        <td><span class="tag-mono">//m1// Titel</span></td>
                        <td>Hebt den nachfolgenden Text farbig hervor (Marker 1).</td>
                    </tr>
                    <tr>
                        <td><span class="tag-mono">//m2// Titel</span></td>
                        <td>Hebt den nachfolgenden Text farbig hervor (Marker 2).</td>
                    </tr>
                    <tr>
                         <td colspan="2" style="font-style:italic; color:#666">... bis //m9//</td>
                    </tr>
                </table>

                <h3 style="border-bottom: 1px solid #444; padding-bottom: 5px; margin-top: 20px;">1. Grundlagen & Typen</h3>
                <table class="help-table">
                    <tr>
                        <th style="width: 140px;">Tag / Syntax</th>
                        <th>Beschreibung & Beispiel</th>
                    </tr>
                    <tr>
                        <td><span class="tag-mono">[-]</span> oder <span class="tag-mono">[]</span></td>
                        <td>
                            <strong>Neuer Eintrag (Pflicht)</strong><br>
                            Markiert den Beginn einer Aufgabe.<br>
                            <div class="tag-ex">[-] Milch kaufen</div>
                        </td>
                    </tr>
                    <tr>
                        <td><span class="tag-mono"><<</span></td>
                        <td>
                            <strong>Beschreibung</strong><br>
                            Fügt Text zur <em>vorherigen</em> Aufgabe hinzu.<br>
                            <div class="tag-ex">[-] Design Meeting<br>&lt;&lt; Laptop mitbringen!</div>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
    </div>

    <div id="modal-conflict" class="modal-overlay">
        <div class="modal" style="width:600px">
            <div class="modal-header"><span>Speicherkonflikt!</span></div>
            <div class="modal-body">
                <p>Die Datei wurde zwischenzeitlich geändert (am <span id="conflict-server-ts"></span>).</p>
                <div class="form-group">
                    <label>Inhalt auf Server:</label>
                    <textarea id="conflict-server-content" class="form-control" rows="10" readonly></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button id="btn-conflict-load" class="btn-primary">Server-Version laden</button>
                <button id="btn-conflict-overwrite" class="btn-danger">Meine Version erzwingen</button>
            </div>
        </div>
    </div>
</body>
</html>