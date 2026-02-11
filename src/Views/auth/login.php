<!DOCTYPE html><html><head><link rel="stylesheet" href="<?=$basePath?>/assets/css/style.css"></head>
    <body><div class="auth-container"><div class="auth-box"><h1>PlainNote</h1>
    <?php if($error) echo "<div class='alert'>$error</div>"; ?>
    <form method="post">
        <input name="username" class="form-control" placeholder="Username" required style="margin-bottom:10px">
        <input type="password" name="password" class="form-control" placeholder="Passwort" required style="margin-bottom:20px">
        <button class="btn-primary" style="width:100%">Login</button>
    </form></div></div></body></html>