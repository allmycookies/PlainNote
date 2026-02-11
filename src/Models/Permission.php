<?php
namespace App\Models;
use App\Core\Database;

class Permission {
    public static function hasAccess($userId, $projectId, $isAdmin) {
        if ($isAdmin) return true;
        $pdo = Database::getMasterDB();
        $stmt = $pdo->prepare("SELECT 1 FROM permissions WHERE user_id = ? AND project_id = ?");
        $stmt->execute([$userId, $projectId]);
        return (bool)$stmt->fetch();
    }

    public static function getProjectsForUser($userId) {
        $pdo = Database::getMasterDB();
        $stmt = $pdo->prepare("SELECT p.* FROM projects p JOIN permissions perm ON p.id = perm.project_id WHERE perm.user_id = ? ORDER BY p.slug");
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public static function assign($userId, $projectId) {
        $pdo = Database::getMasterDB();
        $pdo->prepare("INSERT INTO permissions (user_id, project_id) VALUES (?, ?)")
            ->execute([$userId, $projectId]);
    }

    public static function revoke($userId, $projectId) {
        $pdo = Database::getMasterDB();
        $pdo->prepare("DELETE FROM permissions WHERE user_id = ? AND project_id = ?")
            ->execute([$userId, $projectId]);
    }

    public static function getPermissionsForUser($userId) {
        $pdo = Database::getMasterDB();
        $stmt = $pdo->prepare("SELECT p.slug, p.id FROM permissions perm JOIN projects p ON perm.project_id = p.id WHERE perm.user_id = ?");
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }
}
