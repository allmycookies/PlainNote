<?php
// public/index.php
// Version 0.9.7 (Modularized Windows)

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
    'cookie_secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
]);
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
header("X-Frame-Options: SAMEORIGIN");
header("X-Content-Type-Options: nosniff");
header("Referrer-Policy: strict-origin-when-cross-origin");

require_once __DIR__ . '/../src/autoload.php';
use App\Core\Router;
use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\AdminController;
use App\Controllers\EditorController;
use App\Controllers\ApiController;
use App\Controllers\ViewController; // NEU

$router = new Router();
// Routes
$router->get('/setup', [new AuthController(), 'setup']);
$router->post('/setup', [new AuthController(), 'setup']);

$router->get('/login', [new AuthController(), 'login']);
$router->post('/login', [new AuthController(), 'login']);
$router->get('/logout', [new AuthController(), 'logout']);

$router->get('/', [new DashboardController(), 'index']);
$router->get('/index.php', [new DashboardController(), 'index']);

$router->post('/admin', [new AdminController(), 'handle']);

$router->get('#^/s/([a-z0-9-]+)$#', [new EditorController(), 'show']);
$router->post('#^/api/save/([a-z0-9-]+)$#', [new ApiController(), 'save']);
$router->get('#^/api/check/([a-z0-9-]+)$#', [new ApiController(), 'check']);

// NEU: Modul-Views (Popups)
$router->get('#^/view/kanban/([a-z0-9-]+)$#', [new ViewController(), 'kanban']);
$router->get('#^/view/calendar/([a-z0-9-]+)$#', [new ViewController(), 'calendar']);
$router->get('#^/view/gantt/([a-z0-9-]+)$#', [new ViewController(), 'gantt']);

$router->dispatch();