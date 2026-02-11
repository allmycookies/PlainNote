<?php
namespace App\Controllers;

abstract class Controller {
    protected function view($path, $data = []) {
        extract($data);
        $basePath = $this->getBasePath();
        require __DIR__ . '/../Views/' . $path . '.php';
    }

    protected function getBasePath() {
        $scriptName = dirname($_SERVER['SCRIPT_NAME']);
        return ($scriptName === '/' || $scriptName === '\\') ? '' : $scriptName;
    }

    protected function redirect($path) {
        header("Location: " . $this->getBasePath() . $path);
        exit;
    }

    protected function json($data) {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    protected function user() {
        return $_SESSION['user'] ?? null;
    }

    protected function requireLogin() {
        if (!$this->user()) {
            $this->redirect('/login');
        }
    }

    protected function requireAdmin() {
        $u = $this->user();
        if (!$u || !$u['is_admin']) die("Zugriff verweigert.");
    }
}
