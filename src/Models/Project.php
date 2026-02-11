<?php
namespace App\Models;
use App\Core\Database;
use App\Core\Config;
use PDO;

class Project {
    public static function findBySlug($slug) {
        $pdo = Database::getMasterDB();
        $stmt = $pdo->prepare("SELECT * FROM projects WHERE slug = ?");
        $stmt->execute([$slug]);
        return $stmt->fetch();
    }

    public static function getAll() {
        return Database::getMasterDB()->query("SELECT * FROM projects ORDER BY slug")->fetchAll();
    }

    public static function create($slug, $name) {
         $pdo = Database::getMasterDB();
         $stmt = $pdo->prepare("INSERT INTO projects (slug, name) VALUES (?, ?)");
         $stmt->execute([$slug, $name]);
         Database::getProjectDB($slug); // Ensure file creation
    }

    public static function delete($slug) {
        // Delete file
        $file = Config::PROJECT_DIR . '/' . $slug . '.sqlite';
        if (file_exists($file)) unlink($file);

        // Delete from DB
        $pdo = Database::getMasterDB();
        $pdo->prepare("DELETE FROM projects WHERE slug = ?")->execute([$slug]);
    }
}
