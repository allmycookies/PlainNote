<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>PlainNote / <?= htmlspecialchars($slug) ?></title>
<link rel="stylesheet" href="<?=$basePath?>/assets/css/style.css">
<script>window.SERVER_DATA = <?= json_encode($payload) ?>;</script>
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
            <div id="save-status" style="font-size:0.8rem; color:#888">Bereit</div>
            <a href="<?=$basePath?>/" class="btn-secondary" style="padding:2px 8px; font-size:0.8rem; text-decoration:none">Exit</a>
        </div>
    </header>

    <main>
        <section class="editor-pane">
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
            <textarea id="editor" spellcheck="false" placeholder="Start typing..."></textarea>
        </section>

        <section class="projections-pane">
            <div class="lane">
                <div class="lane-head"><h3>Aufgaben</h3><button data-sort="tasks" class="tool-btn">⇅</button></div>
                <div class="lane-content" id="render-tasks"></div>
            </div>
            <div class="lane">
                <div class="lane-head"><h3>Notizen</h3><button data-sort="notes" class="tool-btn">⇅</button></div>
                <div class="lane-content" id="render-notes"></div>
            </div>
            <div class="lane">
                <div class="lane-head"><h3>Termine</h3><button data-sort="dates" class="tool-btn">⇅</button></div>
                <div class="lane-content" id="render-dates"></div>
            </div>
        </section>
    </main>
<footer id="calendar-pane">
        <div class="cal-controls">
            <span>Ansicht:</span>
            <button class="view-btn" data-view="gantt">Gantt</button>
            <button class="view-btn" data-view="week">Woche</button>
        </div>
        <div id="calendar-render"></div>
    </footer>

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
        <div class="modal">
            <div class="modal-header">
                <span>Einstellungen</span>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
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
                PlainNote wird primär über Text-Tags gesteuert. Jede Zeile, die mit <code>[-]</code> oder <code>[]</code> beginnt, wird als Eintrag erkannt. Groß-/Kleinschreibung ist bei Tags egal.
            </p>

            <h3 style="border-bottom: 1px solid #444; padding-bottom: 5px; margin-top: 0;">1. Grundlagen & Typen</h3>
            <table class="help-table">
                <tr>
                    <th style="width: 140px;">Tag / Syntax</th>
                    <th>Beschreibung & Beispiel</th>
                </tr>
                <tr>
                    <td><span class="tag-mono">[-]</span> oder <span class="tag-mono">[]</span></td>
                    <td>
                        <strong>Neuer Eintrag (Pflicht)</strong><br>
                        Markiert den Beginn einer Aufgabe. Ohne dies wird die Zeile ignoriert.<br>
                        <div class="tag-ex">[-] Milch kaufen</div>
                    </td>
                </tr>
                <tr>
                    <td><span class="tag-mono">[a]</span></td>
                    <td>
                        <strong>Aufgabe (Standard)</strong><br>
                        Erscheint in der Spalte "Aufgaben" und im Gantt-Chart.<br>
                        <div class="tag-ex">[-] Projektbericht schreiben [a]</div>
                    </td>
                </tr>
                <tr>
                    <td><span class="tag-mono">[n]</span></td>
                    <td>
                        <strong>Notiz</strong><br>
                        Erscheint in der Spalte "Notizen". Hat keine Checkbox.<br>
                        <div class="tag-ex">[-] Idee für Logo [n]</div>
                    </td>
                </tr>
                <tr>
                    <td><span class="tag-mono">[t]</span></td>
                    <td>
                        <strong>Termin</strong><br>
                        Erscheint in der Spalte "Termine". Wird im Kalender priorisiert.<br>
                        <div class="tag-ex">[-] Zahnarzt [t] [s14:00]</div>
                    </td>
                </tr>
                <tr>
                    <td><span class="tag-mono">[p1]</span> bis <span class="tag-mono">[p5]</span></td>
                    <td>
                        <strong>Priorität</strong><br>
                        Färbt den Rand der Karte. [p1] (Rot/Hoch) bis [p5] (Blau/Niedrig).<br>
                        <div class="tag-ex">[-] Serverausfall! [p1]</div>
                    </td>
                </tr>
            </table>

            <h3 style="border-bottom: 1px solid #444; padding-bottom: 5px; margin-top: 20px;">2. Zeit & Datum</h3>
            <table class="help-table">
                <tr>
                    <th style="width: 140px;">Tag / Syntax</th>
                    <th>Beschreibung & Beispiel</th>
                </tr>
                <tr>
                    <td><span class="tag-mono">[sHH:MM]</span></td>
                    <td>
                        <strong>Startzeit</strong><br>
                        Setzt die Uhrzeit für heute (oder das gewählte Datum).<br>
                        <div class="tag-ex">[-] Mittagessen [s12:30]</div>
                    </td>
                </tr>
                <tr>
                    <td><span class="tag-mono">[eHH:MM]</span></td>
                    <td>
                        <strong>Endzeit</strong><br>
                        Definiert, wann der Termin endet.<br>
                        <div class="tag-ex">[-] Workshop [s10:00] [e14:00]</div>
                    </td>
                </tr>
                <tr>
                    <td><span class="tag-mono">[sYYYY-MM-DD]</span></td>
                    <td>
                        <strong>Startdatum</strong><br>
                        Legt das Datum fest (Jahr-Monat-Tag). Auch deutsches Format (DD.MM.) wird oft erkannt.<br>
                        <div class="tag-ex">[-] Urlaub [s2026-08-01]</div>
                    </td>
                </tr>
                <tr>
                    <td><span class="tag-mono">Automatisch</span></td>
                    <td>
                        <strong>Dauer-Logik</strong><br>
                        Ist nur eine Startzeit angegeben, wird die Standard-Dauer (z.B. 20min) addiert.<br>
                        Ist nur ein Datum ohne Zeit da, gilt es als Ganztages-Ereignis.
                    </td>
                </tr>
            </table>

            <h3 style="border-bottom: 1px solid #444; padding-bottom: 5px; margin-top: 20px;">3. Wiederholungen (Recurring)</h3>
            <table class="help-table">
                <tr>
                    <th style="width: 140px;">Tag / Syntax</th>
                    <th>Beschreibung & Beispiel</th>
                </tr>
                <tr>
                    <td><span class="tag-mono">[w mo,fr]</span></td>
                    <td>
                        <strong>Wochentage</strong><br>
                        Wiederholt jeden Montag und Freitag.<br>
                        <em>Kürzel: mo, di, mi, do, fr, sa, so</em><br>
                        <div class="tag-ex">[-] Daily Scrum [s10:00] [w mo,di,mi,do,fr]</div>
                    </td>
                </tr>
                <tr>
                    <td><span class="tag-mono">[w +2w]</span></td>
                    <td>
                        <strong>Intervalle</strong><br>
                        Wiederholt relativ zum Startdatum.<br>
                        <em>+Xt (Tage), +Xw (Wochen), +Xm (Monate)</em><br>
                        <div class="tag-ex">[-] Müll rausbringen [w +2w] (Alle 2 Wochen)</div>
                    </td>
                </tr>
                <tr>
                    <td><span class="tag-mono">[w 24.12]</span></td>
                    <td>
                        <strong>Fixer Tag</strong><br>
                        Wiederholt jährlich am 24.12. (oder monatlich bei [w 01.]).<br>
                        <div class="tag-ex">[-] Miete zahlen [w 01.] (Am 1. jeden Monats)</div>
                    </td>
                </tr>
                <tr>
                    <td><span class="tag-mono">[bis YYYY-MM-DD]</span></td>
                    <td>
                        <strong>Enddatum der Serie</strong><br>
                        Begrenzt die Wiederholung bis zu diesem Tag.<br>
                        <div class="tag-ex">[-] Projekt-Meeting [w mo] [bis 2026-12-31]</div>
                    </td>
                </tr>
            </table>

            <div style="margin-top: 20px; font-size: 0.8rem; color: #888; border-top: 1px solid #444; padding-top: 10px;">
                <strong>Tipp:</strong> Klicke auf ein Element im Kalender oder in den Spalten, um zur entsprechenden Textzeile im Editor zu springen.
            </div>
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