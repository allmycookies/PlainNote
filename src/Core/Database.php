<?php
namespace App\Core;
use PDO;
use Exception;

class Database {
    public static function getMasterDB() {
        $path = Config::MASTER_DB;
        // Ensure directories exist
        if (!is_dir(Config::DATA_DIR)) {
            @mkdir(Config::DATA_DIR, 0750, true);
            file_put_contents(Config::DATA_DIR.'/.htaccess', "Deny from all");
        }
        if (!is_dir(Config::PROJECT_DIR)) {
            @mkdir(Config::PROJECT_DIR, 0750, true);
        }

        $pdo = new PDO('sqlite:' . $path);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

        // Init Tables
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

    public static function getProjectDB($slug) {
        if(!preg_match('/^[a-z0-9-]+$/', $slug)) throw new Exception("Invalid Slug");

        $path = Config::PROJECT_DIR . '/' . $slug . '.sqlite';
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
}
