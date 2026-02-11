import { expandItems } from './parser.js';
import { escapeHtml, formatText } from './ui.js';

export function renderCalendar(items, config, dom, calState) {
    if(!document.getElementById('cal-prev')) ensureNavControls(calState, () => renderCalendar(items, config, dom, calState));
    updateViewButtons(config);

    const validItems = items.filter(i => i.start && i.end);

    if(config.view === 'week') {
        renderWeekView(validItems, config, dom, calState);
    } else {
        renderGanttView(validItems, config, dom);
    }
}

function ensureNavControls(calState, renderCallback) {
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

function updateViewButtons(config) {
    document.querySelectorAll('.view-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.view === config.view));
}

function renderWeekView(items, config, dom, calState) {
    const container = dom.calRender;
    const ref = calState.refDate;
    const day = ref.getDay();
    const diff = ref.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(ref);
    monday.setDate(diff);
    monday.setHours(0,0,0,0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);

    const visibleDaysIdx = config.visibleDays || [1,2,3,4,5,6,0];
    const startH = config.calStartHour ?? 0;
    const endH = config.calEndHour ?? 24;
    const totalH = endH - startH;

    const visibleItems = expandItems(items, monday, sunday);
    const fmt = new Intl.DateTimeFormat(config.locale, { day:'2-digit', month:'2-digit', year: 'numeric' });
    const lbl = document.getElementById('cal-label');
    if(lbl) lbl.textContent = `${fmt.format(monday)} - ${fmt.format(sunday)}`;

    if(visibleDaysIdx.length === 0) {
        container.innerHTML = '<div style="padding:20px">Keine Tage ausgewählt.</div>';
        return;
    }

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

    const fmtDay = new Intl.DateTimeFormat(config.locale, { weekday:'short', day:'2-digit' });
    daysToRender.forEach(d => {
            const isToday = d.toDateString() === new Date().toDateString();
            html += `<div class="day-head ${isToday?'today':''}">${fmtDay.format(d)}</div>`;
    });
    html += '</div>';

    html += `<div class="week-grid" style="grid-template-columns: 50px repeat(${visibleDaysIdx.length}, 1fr);">
                <div class="time-col" style="height: ${totalH * 60}px;">`;
    for(let h=startH; h<endH; h++) {
        html += `<div class="time-label">${h}:00</div>`;
    }
    html += '</div>';

    daysToRender.forEach(d => {
        const currentDayStart = new Date(d); currentDayStart.setHours(0,0,0,0);
        const currentDayEnd = new Date(d); currentDayEnd.setHours(23,59,59,999);

        html += `<div class="day-col" style="height: ${totalH * 60}px;">`;

        // Current Time Line (Red)
        const now = new Date();
        if(d.toDateString() === now.toDateString()) {
            const nowMins = (now.getHours() * 60) + now.getMinutes();
            const lineTop = nowMins - (startH * 60);
            if(lineTop >= 0 && lineTop <= (totalH * 60)) {
                html += `<div style="position:absolute; top:${lineTop}px; left:0; right:0; border-top:2px solid red; z-index:100; pointer-events:none;"></div>`;
            }
        }

        const dayItemsRaw = visibleItems.filter(item => item.start < currentDayEnd && item.end > currentDayStart);
        const mainEvents = [];
        const stripEvents = [];

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

        mainEvents.forEach(item => {
            let startMinsTotal = (item.visStart.getHours() * 60) + item.visStart.getMinutes();
            let top = startMinsTotal - (startH * 60);
            let height = item.durationMins;

            if (top < 0) { height += top; top = 0; }
            if (top + height > (totalH * 60)) height = (totalH * 60) - top;

            const widthPercent = 96 / numCols;
            const leftPercent = (item.colIndex * widthPercent) + 1;
            
            const markerClass = item.marker > 0 ? `marker-${item.marker}` : '';
            // Use title attribute for tooltip description
            const tooltip = escapeHtml(item.title) + (item.description ? "\n\n" + escapeHtml(item.description) : "");

            if (height > 0) {
                html += `<div class="cal-event type-${item.type} ${item.isVirtual?'recurring':''} ${markerClass}" data-id="${item.id}"
                              style="top:${top}px; height:${height}px; width:${widthPercent}%; left:${leftPercent}%;"
                                title="${tooltip}">
                                ${formatText(item.title)}
                             </div>`;
            }
        });

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

        stripEvents.forEach((item, idx) => {
            let startMinsTotal = (item.visStart.getHours() * 60) + item.visStart.getMinutes();
            let top = startMinsTotal - (startH * 60);
            let height = (item.visEnd - item.visStart) / 60000;

            if(top < 0) { height += top; top = 0; }
            if(top + height > (totalH * 60)) height = (totalH * 60) - top;

            const rightPos = (item.stripIndex * 27) + 2;
            const markerClass = item.marker > 0 ? `marker-${item.marker}` : '';
            const tooltip = escapeHtml(item.title) + " (Fortsetzung)" + (item.description ? "\n\n" + escapeHtml(item.description) : "");

            if (height > 0) {
                html += `<div class="cal-strip ${markerClass}" data-id="${item.id}"
                                style="top:${top}px; height:${height}px; width:25px; right:${rightPos}px;"
                                title="${tooltip}">
                                ${escapeHtml(item.title)}
                            </div>`;
            }
        });

        html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;

    if(container.scrollTop === 0) {
        const scrollH = 8 - startH;
        if(scrollH > 0) container.scrollTop = scrollH * 60;
    }
}

function renderGanttView(items, config, dom) {
    const container = dom.calRender;
    const lbl = document.getElementById('cal-label');
    if(lbl) lbl.textContent = "Projektablauf (30 Tage Vorschau)";

    const today = new Date();
    today.setHours(0,0,0,0);
    const future = new Date(today);
    future.setDate(today.getDate() + 30);

    const visibleItems = expandItems(items, today, future)
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

    const minW = config.ganttMinWidth || 60;
    const pxPerDay = Math.max(minW, (container.clientWidth - 200) / totalDays);
    const finalTotalWidth = totalDays * pxPerDay;
    const pxPerMs = finalTotalWidth / totalDuration;

    let html = `<div class="gantt-wrapper">
                    <div class="g-sidebar">
                        <div class="g-header-title">Aufgaben</div>
                        ${visibleItems.map(t =>
                            `<div class="g-task-row" data-id="${t.id}" style="cursor:pointer" title="${escapeHtml(t.description)}">
                                ${formatText(t.title)}
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
                <div class="g-body" style="width: ${finalTotalWidth}px">`;

                // Current Time Line (Red)
                const now = new Date();
                if(now >= startDate && now <= endDate) {
                    const nowX = (now.getTime() - gridMin) * pxPerMs;
                    html += `<div style="position:absolute; left:${nowX}px; top:0; bottom:0; border-left:1px solid red; z-index:200; pointer-events:none;"></div>`;
                }

                html += `${visibleItems.map(t => {
                    const left = (t.start.getTime() - gridMin) * pxPerMs;
                    const width = (t.end.getTime() - t.start.getTime()) * pxPerMs;
                    const markerClass = t.marker > 0 ? `marker-${t.marker}` : '';
                    
                    return `<div class="g-body-row">
                                <div class="g-bar-item ${markerClass}" data-id="${t.id}" style="left:${left}px; width:${width}px; cursor:pointer;" title="${escapeHtml(t.title) + (t.description?'\n'+escapeHtml(t.description):'')}">
                                    ${formatText(t.title)}
                                </div>
                            </div>`;
                }).join('')}
                </div>
            </div>
        </div>`;
    container.innerHTML = html;
}