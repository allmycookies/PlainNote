<?php
// public/index.php
// Version 0.8.2 (Refactored)

session_start();

require_once __DIR__ . '/../src/autoload.php';

use App\Core\Router;
use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\AdminController;
use App\Controllers\EditorController;
use App\Controllers\ApiController;

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

$router->dispatch();
