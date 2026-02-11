<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>PlainNote Dashboard</title>
    <link rel="stylesheet" href="<?=$basePath?>/assets/css/style.css"></head>
    <body>
    <header>
        <a href="<?=$basePath?>/" class="brand">PlainNote</a>
        <div class="user-menu">
            <span><?=htmlspecialchars($user['username'])?> <?=($user['is_admin']?'<span class="badge badge-admin">Admin</span>':'')?></span>
            <a href="<?=$basePath?>/logout" class="logout-link">Logout</a>
        </div>
    </header>

    <div class="dash-container">
        <div class="dash-header-hero">
            <div>
                <h1>Willkommen, <?=htmlspecialchars($user['username'])?></h1>
                <p>Übersicht deiner Projekte</p>
            </div>
            <?php if($user['is_admin']): ?>
                <div>
                    <form method="post" action="<?=$basePath?>/admin" class="inline-form">
                        <input type="hidden" name="action" value="create_project">
                        <input name="slug" class="gen-input" placeholder="Neues Projekt..." style="width:200px" required>
                        <button class="btn-primary">+</button>
                    </form>
                </div>
            <?php endif; ?>
        </div>

    <?php if (isset($_SESSION['flash_msg'])): ?>
        <div class='alert'><?=$_SESSION['flash_msg']?></div>
        <?php unset($_SESSION['flash_msg']); ?>
    <?php endif; ?>

    <div class="proj-grid">
    <?php foreach($projects as $p):
        $s = htmlspecialchars($p['slug']); ?>
        <div class='proj-card'>
            <a href='<?=$basePath?>/s/<?=$s?>' class='proj-title'><?=$s?></a>
            <span class='proj-slug'>#<?=$s?></span>
            <div class='proj-meta'><span>ID: <?=$p['id']?></span></div>
            <div class='proj-actions'>
                <a href='<?=$basePath?>/s/<?=$s?>' class='action-btn'>Öffnen</a>
        <?php if($user['is_admin']): ?>
            <form method='post' action='<?=$basePath?>/admin' style='margin:0'>
                    <input type='hidden' name='action' value='export_project'>
                    <input type='hidden' name='slug' value='<?=$s?>'>
                    <button class='action-btn' title='Export'>⬇</button>
                  </form>
                  <form method='post' action='<?=$basePath?>/admin' style='margin:0' onsubmit='return confirm("Projekt <?=$s?> wirklich LÖSCHEN?")'>
                    <input type='hidden' name='action' value='delete_project'>
                    <input type='hidden' name='slug' value='<?=$s?>'>
                    <button class='action-btn danger' title='Löschen'>&times;</button>
                  </form>
        <?php endif; ?>
        </div></div>
    <?php endforeach; ?>
    </div>

    <?php if ($user['is_admin']): ?>
        <details class="admin-section">
            <summary>Benutzerverwaltung</summary>
            <div class="admin-content">
                <form action="<?=$basePath?>/admin" method="post" class="inline-form" style="margin-bottom:20px; background:#222; padding:15px; border-radius:5px;">
                    <input type="hidden" name="action" value="create_user">
                    <span style="font-weight:bold; color:#fff; margin-right:10px;">Neuer User:</span>
                    <input name="username" placeholder="Username" class="gen-input" required style="width:150px">
                    <input name="password" placeholder="Passwort" class="gen-input" required style="width:150px">
                    <button class="btn-primary">Anlegen</button>
                </form>

                <table class="admin-table">
                    <thead><tr><th>ID</th><th>User</th><th>Rolle</th><th>Berechtigungen</th><th>Aktionen</th></tr></thead>
                    <tbody>
                    <?php foreach($allUsers as $u): ?>
                        <tr>
                            <td><?=$u['id']?></td>
                            <td><?=htmlspecialchars($u['username'])?></td>
                            <td><?=($u['is_admin']?'Admin':'User')?></td>
                            <td>
                            <?php if(!$u['is_admin']):
                                $perms = \App\Models\Permission::getPermissionsForUser($u['id']);
                                foreach($perms as $r): ?>
                                <span class='badge'><?=htmlspecialchars($r['slug'])?>
                                    <form method='post' action='<?=$basePath?>/admin' style='display:inline'>
                                        <input type='hidden' name='action' value='revoke_perm'>
                                        <input type='hidden' name='user_id' value='<?=$u['id']?>'>
                                        <input type='hidden' name='project_id' value='<?=$r['id']?>'>
                                        <button style='background:none;border:none;color:#f88;cursor:pointer;padding:0'>&times;</button>
                                    </form>
                                </span>
                                <?php endforeach; ?>
                                <form method='post' action='<?=$basePath?>/admin' style='display:inline-block; margin-left:5px;'>
                                <input type='hidden' name='action' value='assign_perm'>
                                <input type='hidden' name='user_id' value='<?=$u['id']?>'>
                                <select name='project_id' style='padding:2px;background:#222;color:#ccc;border:1px solid #444;border-radius:3px'>
                                    <option value=''>+ Add</option>
                                    <?php foreach($allProjects as $ap) echo "<option value='{$ap['id']}'>".htmlspecialchars($ap['slug'])."</option>"; ?>
                                </select><button style='display:none'></button></form>
                            <?php else: echo "Vollzugriff"; endif; ?>
                            </td>
                            <td>
                                <form method='post' action='<?=$basePath?>/admin' style='display:inline' onsubmit='return confirm("PW Reset?")'>
                                    <input type='hidden' name='action' value='reset_pw'>
                                    <input type='hidden' name='user_id' value='<?=$u['id']?>'>
                                    <button class='btn-secondary' style='font-size:0.7rem; padding:2px 6px'>PW Reset</button>
                                </form>
                                <?php if($u['id']!==$user['id']): ?>
                                 <form method='post' action='<?=$basePath?>/admin' style='display:inline' onsubmit='return confirm("Löschen?")'>
                                    <input type='hidden' name='action' value='delete_user'>
                                    <input type='hidden' name='user_id' value='<?=$u['id']?>'>
                                    <button class='btn-danger' style='font-size:0.7rem; padding:2px 6px'>&times;</button>
                                 </form>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody></table></div></details>

        <details class="admin-section">
            <summary>System & Import</summary>
            <div class="admin-content">
                <div style="display:flex; gap:20px; align-items:flex-start">
                    <div style="flex:1">
                        <h3>Projekt Importieren (.sqlite)</h3>
                        <form action="<?=$basePath?>/admin" method="post" enctype="multipart/form-data" class="inline-form">
                            <input type="hidden" name="action" value="import_project">
                            <input name="slug" placeholder="Ziel-Name (Slug)" class="gen-input" required>
                            <input type="file" name="db_file" required class="gen-input">
                            <button class="btn-secondary">Hochladen</button>
                        </form>
                    </div>
                </div>
            </div>
        </details>
    <?php endif; ?>
    </div></body></html>