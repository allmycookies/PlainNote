<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Kanban - <?= htmlspecialchars($payload['slug']) ?></title>
    <link rel="stylesheet" href="<?=$basePath?>/assets/css/style.css">
    <script>window.SERVER_DATA = <?= json_encode($payload) ?>; window.MODULE_TYPE = 'kanban';</script>
    <style>
        html, body { height: 100vh; width: 100vw; margin: 0; padding: 0; overflow: hidden; background: var(--bg-dark); }
        .projections-pane { height: 100% !important; width: 100% !important; border: none; display: flex; overflow-x: auto; }
        .lane { min-width: 300px; height: 100%; display:flex; flex-direction:column; }
        .lane-content { flex: 1; overflow-y: auto; }
        .resizer-x, .resizer-y { display: none; }
    </style>
    <script type="module" src="<?=$basePath?>/assets/js/module-client.js"></script>
</head>
<body>
    <section class="projections-pane" id="projections-pane"></section>
</body>
</html>