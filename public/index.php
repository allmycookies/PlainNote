<?php
// public/index.php
// Version 0.8.2 (UI Overhaul, Dash Redesign & Multi-User Core)

session_start();

// --- KONFIGURATION ---
$dataDir = __DIR__ . '/../data';
$projDir = $dataDir . '/projects';
$masterDb = $dataDir . '/master.sqlite';
$version = '0.8.2';

// Verzeichnisschutz
if (!is_dir($dataDir)) { 
    @mkdir($dataDir, 0750, true); 
    file_put_contents($dataDir.'/.htaccess', "Deny from all"); 
}
if (!is_dir($projDir)) { 
    @mkdir($projDir, 0750, true); 
}

// --- DB HELPER ---

function getMasterDB() {
    global $masterDb;
    $pdo = new PDO('sqlite:' . $masterDb);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    
    // Tabellen initialisieren
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS permissions (
        user_id INTEGER,
        project_id INTEGER,
        PRIMARY KEY (user_id, project_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )");
    return $pdo;
}

function getProjectDB($slug) {
    global $projDir;
    if(!preg_match('/^[a-z0-9-]+$/', $slug)) throw new Exception("Invalid Slug");
    
    $path = $projDir . '/' . $slug . '.sqlite';
    $pdo = new PDO('sqlite:' . $path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec("PRAGMA journal_mode = WAL;");
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS content (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        text TEXT DEFAULT '',
        config JSON DEFAULT '{}',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    // Initiale Zeile
    $pdo->exec("INSERT OR IGNORE INTO content (id, text, config) VALUES (1, '[-] Erstes Todo', '{}')");
    return $pdo;
}

// --- AUTH & SECURITY ---

function getCurrentUser() { return $_SESSION['user'] ?? null; }
function requireLogin() { if (!getCurrentUser()) { header("Location: /login"); exit; } }
function requireAdmin() { 
    $u = getCurrentUser(); 
    if (!$u || !$u['is_admin']) { die("Zugriff verweigert."); } 
}
function hasProjectAccess($userId, $projectId, $isAdmin) {
    if ($isAdmin) return true;
    $pdo = getMasterDB();
    $stmt = $pdo->prepare("SELECT 1 FROM permissions WHERE user_id = ? AND project_id = ?");
    $stmt->execute([$userId, $projectId]);
    return (bool)$stmt->fetch();
}

// --- ROUTING ---

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$scriptName = dirname($_SERVER['SCRIPT_NAME']);
$basePath = ($scriptName === '/' || $scriptName === '\\') ? '' : $scriptName;
$route = substr($uri, strlen($basePath));

// 1. SETUP (Erster Start)
if ($route === '/setup') {
    $pdo = getMasterDB();
    if ($pdo->query("SELECT COUNT(*) FROM users")->fetchColumn() > 0) { 
        header("Location: $basePath/login"); exit; 
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $user = trim($_POST['username']);
        $pass = $_POST['password'];
        if ($user && $pass) {
            $pdo->prepare("INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)")
                ->execute([$user, password_hash($pass, PASSWORD_DEFAULT)]);
            header("Location: $basePath/login"); exit;
        }
    }
    echo '<!DOCTYPE html><html><head><link rel="stylesheet" href="'.$basePath.'/assets/css/style.css"></head>
    <body><div class="auth-container"><div class="auth-box"><h1>Setup</h1>
    <form method="post">
        <input name="username" class="form-control" placeholder="Admin Username" required style="margin-bottom:10px">
        <input type="password" name="password" class="form-control" placeholder="Passwort" required style="margin-bottom:20px">
        <button class="btn-primary" style="width:100%">Installieren</button>
    </form></div></div></body></html>';
    exit;
}

// 2. LOGIN / LOGOUT
if ($route === '/login') {
    $error = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $pdo = getMasterDB();
        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$_POST['username']]);
        $user = $stmt->fetch();
        if ($user && password_verify($_POST['password'], $user['password'])) { 
            $_SESSION['user'] = $user; 
            header("Location: $basePath/"); exit; 
        } else { $error = "Falsche Zugangsdaten"; }
    }
    // Check ob Setup nötig
    $pdo = getMasterDB(); 
    if ($pdo->query("SELECT COUNT(*) FROM users")->fetchColumn() == 0) { header("Location: $basePath/setup"); exit; }

    echo '<!DOCTYPE html><html><head><link rel="stylesheet" href="'.$basePath.'/assets/css/style.css"></head>
    <body><div class="auth-container"><div class="auth-box"><h1>PlainNote</h1>';
    if($error) echo "<div class='alert'>$error</div>";
    echo '<form method="post">
        <input name="username" class="form-control" placeholder="Username" required style="margin-bottom:10px">
        <input type="password" name="password" class="form-control" placeholder="Passwort" required style="margin-bottom:20px">
        <button class="btn-primary" style="width:100%">Login</button>
    </form></div></div></body></html>';
    exit;
}
if ($route === '/logout') { 
    session_destroy(); 
    header("Location: $basePath/login"); exit; 
}

// 3. API: SAVE (mit Optimistic Locking)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && preg_match('#^/api/save/([a-z0-9-]+)$#', $route, $matches)) {
    requireLogin(); 
    $slug = $matches[1]; 
    $user = getCurrentUser(); 
    $master = getMasterDB();
    
    // Check Access
    $stmt = $master->prepare("SELECT id FROM projects WHERE slug = ?"); 
    $stmt->execute([$slug]); 
    $proj = $stmt->fetch();
    if (!$proj || !hasProjectAccess($user['id'], $proj['id'], $user['is_admin'])) { http_response_code(403); die(); }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) { http_response_code(400); die(); }

    $projDb = getProjectDB($slug);
    $lastSync = $input['last_synced'] ?? null;

    if ($lastSync) {
        // Optimistic Lock Check
        $stmt = $projDb->prepare("UPDATE content SET text = :text, config = :config, updated_at = CURRENT_TIMESTAMP WHERE id = 1 AND updated_at = :ref");
        $stmt->execute([
            ':text' => $input['content'], 
            ':config' => json_encode($input['config']), 
            ':ref' => $lastSync
        ]);
        
        if ($stmt->rowCount() === 0) {
            // KONFLIKT
            http_response_code(409); 
            $current = $projDb->query("SELECT text, updated_at FROM content WHERE id = 1")->fetch();
            echo json_encode([
                'error' => 'Conflict', 
                'server_updated_at' => $current['updated_at'], 
                'server_content' => $current['text']
            ]); 
            exit;
        }
    } else {
        // Force Save (ohne Lock Check, z.B. erster Save oder Overwrite)
        $stmt = $projDb->prepare("UPDATE content SET text = :text, config = :config, updated_at = CURRENT_TIMESTAMP WHERE id = 1");
        $stmt->execute([':text' => $input['content'], ':config' => json_encode($input['config'])]);
    }
    
    $newRow = $projDb->query("SELECT updated_at FROM content WHERE id = 1")->fetch();
    header('Content-Type: application/json'); 
    echo json_encode(['status' => 'ok', 'updated_at' => $newRow['updated_at']]); 
    exit;
}

// 4. ADMIN ACTIONS (CRUD)
if ($route === '/admin' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    requireAdmin(); 
    $action = $_POST['action']; 
    $master = getMasterDB();

    if ($action === 'create_user') {
        try { 
            $master->prepare("INSERT INTO users (username, password) VALUES (?, ?)")
                ->execute([trim($_POST['username']), password_hash($_POST['password'], PASSWORD_DEFAULT)]); 
        } catch(Exception $e) {}
    } 
    elseif ($action === 'delete_user') {
        $id = (int)$_POST['user_id']; 
        if ($id !== $_SESSION['user']['id']) {
            $master->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);
        }
    } 
    elseif ($action === 'reset_pw') {
        $id = (int)$_POST['user_id']; 
        $newPw = bin2hex(random_bytes(4));
        $master->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([password_hash($newPw, PASSWORD_DEFAULT), $id]);
        $_SESSION['flash_msg'] = "PW Reset für User ID $id: $newPw";
    } 
    elseif ($action === 'create_project') {
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $_POST['slug']), '-'));
        if($slug) { 
            try { 
                $master->prepare("INSERT INTO projects (slug, name) VALUES (?, ?)")->execute([$slug, $slug]); 
                getProjectDB($slug); // DB Datei anlegen
            } catch(Exception $e) {} 
        }
    } 
    elseif ($action === 'delete_project') {
        $slug = $_POST['slug']; 
        if($slug) { 
            // 1. Datei löschen
            $file = $projDir . '/' . $slug . '.sqlite'; 
            if (file_exists($file)) unlink($file); 
            // 2. DB Eintrag löschen
            $master->prepare("DELETE FROM projects WHERE slug = ?")->execute([$slug]); 
        }
    } 
    elseif ($action === 'assign_perm') {
        try { 
            $master->prepare("INSERT INTO permissions (user_id, project_id) VALUES (?, ?)")
                ->execute([(int)$_POST['user_id'], (int)$_POST['project_id']]); 
        } catch(Exception $e) {}
    } 
    elseif ($action === 'revoke_perm') {
        $master->prepare("DELETE FROM permissions WHERE user_id = ? AND project_id = ?")
            ->execute([(int)$_POST['user_id'], (int)$_POST['project_id']]);
    } 
    elseif ($action === 'export_project') {
        $slug = $_POST['slug']; 
        $file = $projDir . '/' . $slug . '.sqlite';
        if (file_exists($file)) { 
            header('Content-Type: application/octet-stream'); 
            header('Content-Disposition: attachment; filename="'.$slug.'.sqlite"'); 
            readfile($file); 
            exit; 
        }
    } 
    elseif ($action === 'import_project') {
        if (isset($_FILES['db_file']) && $_FILES['db_file']['error'] == 0) {
            $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $_POST['slug']), '-'));
            if ($slug) { 
                try { 
                    $master->prepare("INSERT INTO projects (slug, name) VALUES (?, ?)")->execute([$slug, $slug]); 
                    move_uploaded_file($_FILES['db_file']['tmp_name'], $projDir . '/' . $slug . '.sqlite'); 
                } catch(Exception $e) { 
                    $_SESSION['flash_msg'] = "Fehler: Projektname existiert bereits.";
                } 
            }
        }
    }
    header("Location: $basePath/"); exit;
}

// 5. DASHBOARD (Root)
if ($route === '/' || $route === '/index.php' || $route === '') {
    requireLogin(); 
    $user = getCurrentUser(); 
    $pdo = getMasterDB();
    
    // Projektdaten laden
    if ($user['is_admin']) { 
        $projects = $pdo->query("SELECT * FROM projects ORDER BY slug")->fetchAll(); 
    } else { 
        $stmt = $pdo->prepare("SELECT p.* FROM projects p JOIN permissions perm ON p.id = perm.project_id WHERE perm.user_id = ? ORDER BY p.slug"); 
        $stmt->execute([$user['id']]); 
        $projects = $stmt->fetchAll(); 
    }
    
    $allUsers = $user['is_admin'] ? $pdo->query("SELECT * FROM users ORDER BY username")->fetchAll() : [];
    $allProjects = $user['is_admin'] ? $projects : [];

    echo '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>PlainNote Dashboard</title>
    <link rel="stylesheet" href="'.$basePath.'/assets/css/style.css"></head>
    <body>
    <header>
        <a href="'.$basePath.'/" class="brand">PlainNote</a>
        <div class="user-menu">
            <span>'.$user['username'].' '.($user['is_admin']?'<span class="badge badge-admin">Admin</span>':'').'</span>
            <a href="'.$basePath.'/logout" class="logout-link">Logout</a>
        </div>
    </header>
    
    <div class="dash-container">
        <div class="dash-header-hero">
            <div>
                <h1>Willkommen, '.htmlspecialchars($user['username']).'</h1>
                <p>Übersicht deiner Projekte</p>
            </div>';
            
            // Nur Admin darf neue Projekte direkt hier anlegen
            if($user['is_admin']) {
                echo '<div>
                    <form method="post" action="'.$basePath.'/admin" class="inline-form">
                        <input type="hidden" name="action" value="create_project">
                        <input name="slug" class="gen-input" placeholder="Neues Projekt..." style="width:200px" required>
                        <button class="btn-primary">+</button>
                    </form>
                </div>';
            }
    echo '</div>';
    
    if (isset($_SESSION['flash_msg'])) { 
        echo "<div class='alert'>{$_SESSION['flash_msg']}</div>"; 
        unset($_SESSION['flash_msg']); 
    }
    
    // --- GRID VIEW ---
    echo '<div class="proj-grid">';
    foreach($projects as $p) {
        $s = htmlspecialchars($p['slug']);
        echo "<div class='proj-card'>
            <a href='$basePath/s/$s' class='proj-title'>$s</a>
            <span class='proj-slug'>#$s</span>
            <div class='proj-meta'><span>ID: {$p['id']}</span></div>
            <div class='proj-actions'>
                <a href='$basePath/s/$s' class='action-btn'>Öffnen</a>";
        
        if($user['is_admin']) {
            echo "<form method='post' action='$basePath/admin' style='margin:0'>
                    <input type='hidden' name='action' value='export_project'>
                    <input type='hidden' name='slug' value='$s'>
                    <button class='action-btn' title='Export'>⬇</button>
                  </form>
                  <form method='post' action='$basePath/admin' style='margin:0' onsubmit='return confirm(\"Projekt $s wirklich LÖSCHEN?\")'>
                    <input type='hidden' name='action' value='delete_project'>
                    <input type='hidden' name='slug' value='$s'>
                    <button class='action-btn danger' title='Löschen'>&times;</button>
                  </form>";
        }
        echo "</div></div>";
    }
    echo '</div>';

    // --- ADMIN ACCORDION ---
    if ($user['is_admin']) {
        // Section: Benutzer
        echo '<details class="admin-section">
            <summary>Benutzerverwaltung</summary>
            <div class="admin-content">
                <form action="'.$basePath.'/admin" method="post" class="inline-form" style="margin-bottom:20px; background:#222; padding:15px; border-radius:5px;">
                    <input type="hidden" name="action" value="create_user">
                    <span style="font-weight:bold; color:#fff; margin-right:10px;">Neuer User:</span>
                    <input name="username" placeholder="Username" class="gen-input" required style="width:150px">
                    <input name="password" placeholder="Passwort" class="gen-input" required style="width:150px">
                    <button class="btn-primary">Anlegen</button>
                </form>
                
                <table class="admin-table">
                    <thead><tr><th>ID</th><th>User</th><th>Rolle</th><th>Berechtigungen</th><th>Aktionen</th></tr></thead>
                    <tbody>';
                    foreach($allUsers as $u) {
                        echo "<tr>
                            <td>{$u['id']}</td>
                            <td>".htmlspecialchars($u['username'])."</td>
                            <td>".($u['is_admin']?'Admin':'User')."</td>
                            <td>";
                            
                        if(!$u['is_admin']) {
                            // Berechtigungen auflisten
                            $perms = $pdo->prepare("SELECT p.slug, p.id FROM permissions perm JOIN projects p ON perm.project_id = p.id WHERE perm.user_id = ?");
                            $perms->execute([$u['id']]);
                            foreach($perms->fetchAll() as $r) {
                                echo "<span class='badge'>".htmlspecialchars($r['slug'])." 
                                    <form method='post' action='$basePath/admin' style='display:inline'>
                                        <input type='hidden' name='action' value='revoke_perm'>
                                        <input type='hidden' name='user_id' value='{$u['id']}'>
                                        <input type='hidden' name='project_id' value='{$r['id']}'>
                                        <button style='background:none;border:none;color:#f88;cursor:pointer;padding:0'>&times;</button>
                                    </form>
                                </span> ";
                            }
                            // Berechtigung hinzufügen
                            echo "<form method='post' action='$basePath/admin' style='display:inline-block; margin-left:5px;'>
                                <input type='hidden' name='action' value='assign_perm'>
                                <input type='hidden' name='user_id' value='{$u['id']}'>
                                <select name='project_id' style='padding:2px;background:#222;color:#ccc;border:1px solid #444;border-radius:3px'>
                                    <option value=''>+ Add</option>";
                                    foreach($allProjects as $ap) echo "<option value='{$ap['id']}'>".htmlspecialchars($ap['slug'])."</option>";
                            echo "</select><button style='display:none'></button></form>";
                        } else { echo "Vollzugriff"; }
                        
                        echo "</td>
                            <td>
                                <form method='post' action='$basePath/admin' style='display:inline' onsubmit='return confirm(\"PW Reset?\")'>
                                    <input type='hidden' name='action' value='reset_pw'>
                                    <input type='hidden' name='user_id' value='{$u['id']}'>
                                    <button class='btn-secondary' style='font-size:0.7rem; padding:2px 6px'>PW Reset</button>
                                </form>";
                        if($u['id']!==$user['id']) {
                             echo " <form method='post' action='$basePath/admin' style='display:inline' onsubmit='return confirm(\"Löschen?\")'>
                                <input type='hidden' name='action' value='delete_user'>
                                <input type='hidden' name='user_id' value='{$u['id']}'>
                                <button class='btn-danger' style='font-size:0.7rem; padding:2px 6px'>&times;</button>
                             </form>";
                        }
                        echo "</td></tr>";
                    }
        echo '</tbody></table></div></details>';

        // Section: System & Import
        echo '<details class="admin-section">
            <summary>System & Import</summary>
            <div class="admin-content">
                <div style="display:flex; gap:20px; align-items:flex-start">
                    <div style="flex:1">
                        <h3>Projekt Importieren (.sqlite)</h3>
                        <form action="'.$basePath.'/admin" method="post" enctype="multipart/form-data" class="inline-form">
                            <input type="hidden" name="action" value="import_project">
                            <input name="slug" placeholder="Ziel-Name (Slug)" class="gen-input" required>
                            <input type="file" name="db_file" required class="gen-input">
                            <button class="btn-secondary">Hochladen</button>
                        </form>
                    </div>
                </div>
            </div>
        </details>';
    }
    echo '</div></body></html>'; exit;
}

// 6. APP VIEW (Editor)
if (preg_match('#^/s/([a-z0-9-]+)$#', $route, $matches)) {
    requireLogin(); 
    $slug = $matches[1]; 
    $user = getCurrentUser(); 
    $master = getMasterDB();
    
    // Check Master Access
    $stmt = $master->prepare("SELECT id FROM projects WHERE slug = ?"); 
    $stmt->execute([$slug]); 
    $proj = $stmt->fetch();
    
    if (!$proj || !hasProjectAccess($user['id'], $proj['id'], $user['is_admin'])) die("Kein Zugriff auf dieses Projekt.");

    // Load Project Content
    $projDb = getProjectDB($slug);
    $row = $projDb->query("SELECT content.text as content, content.config, content.updated_at FROM content WHERE id = 1")->fetch();

    // Get all slugs for switcher (User scope)
    $allSlugsStmt = $master->prepare("SELECT p.slug FROM projects p JOIN permissions perm ON p.id = perm.project_id WHERE perm.user_id = ? ORDER BY p.slug");
    if($user['is_admin']) $allSlugsStmt = $master->query("SELECT slug FROM projects ORDER BY slug"); 
    else $allSlugsStmt->execute([$user['id']]);
    
    $payload = [
        'slug' => $slug,
        'content' => $row['content'],
        'config' => json_decode($row['config'], true),
        'updated_at' => $row['updated_at'],
        'allSlugs' => $allSlugsStmt->fetchAll(PDO::FETCH_COLUMN)
    ];
    ?>
<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>PlainNote / <?= htmlspecialchars($slug) ?></title>
<link rel="stylesheet" href="<?=$basePath?>/assets/css/style.css">
<script>window.SERVER_DATA = <?= json_encode($payload) ?>;</script>
<script type="module" src="<?=$basePath?>/assets/js/app.js"></script>
</head>
<body>
    <header>
        <a href="<?=$basePath?>/" class="brand" style="margin-right:10px">PlainNote</a>
        <select id="project-selector">
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
<?php exit; } ?>
