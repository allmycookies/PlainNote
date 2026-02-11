<?php
namespace App\Models;
use App\Core\Database;
use PDO;

class User {
    public static function findByUsername($username) {
        $pdo = Database::getMasterDB();
        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        return $stmt->fetch();
    }

    public static function create($username, $password, $isAdmin = 0) {
        $pdo = Database::getMasterDB();
        $stmt = $pdo->prepare("INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)");
        return $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), $isAdmin]);
    }

    // NEU: Update Funktion für Name und Rolle
    public static function update($id, $username, $isAdmin) {
        $pdo = Database::getMasterDB();
        $stmt = $pdo->prepare("UPDATE users SET username = ?, is_admin = ? WHERE id = ?");
        return $stmt->execute([$username, $isAdmin, $id]);
    }

    public static function getAll() {
        return Database::getMasterDB()->query("SELECT * FROM users ORDER BY username")->fetchAll();
    }

    public static function count() {
        return Database::getMasterDB()->query("SELECT COUNT(*) FROM users")->fetchColumn();
    }

    public static function updatePassword($id, $newHash) {
        $pdo = Database::getMasterDB();
        return $pdo->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([$newHash, $id]);
    }

    public static function delete($id) {
        return Database::getMasterDB()->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);
    }
}