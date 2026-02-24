<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Kalender - <?= htmlspecialchars($payload['slug']) ?></title>
    <link rel="stylesheet" href="<?=$basePath?>/assets/css/style.css">
    <script>window.SERVER_DATA = <?= json_encode($payload) ?>; window.MODULE_TYPE = 'calendar';</script>
    <style>
        html, body { height: 100vh; width: 100vw; margin: 0; padding: 0; overflow: hidden; background: var(--bg-dark); display: flex; flex-direction: column; }
        footer#calendar-pane { height: 100% !important; width: 100% !important; border: none; display: flex; flex-direction: column; flex: 1; min-height: 0; max-height: 100vh;}
        #calendar-render { flex: 1; overflow-y: auto; height: 100%; position: relative; }
        .resizer-x, .resizer-y { display: none; }
    </style>
    <script type="module" src="<?=$basePath?>/assets/js/module-client.js"></script>
</head>
<body>
    <footer id="calendar-pane">
        <div class="cal-controls">
            <button class="view-btn active" data-view="week" style="display:none">Woche</button> 
        </div>
        <div id="calendar-render"></div>
    </footer>
</body>
</html>