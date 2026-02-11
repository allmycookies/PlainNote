<?php
namespace App\Controllers;
use App\Models\Project;
use App\Models\Permission;
use App\Core\Database;

class ApiController extends Controller {
    public function save($slug) {
        $this->requireLogin();
        $user = $this->user();

        $proj = Project::findBySlug($slug);
        if (!$proj || !Permission::hasAccess($user['id'], $proj['id'], $user['is_admin'])) {
            http_response_code(403);
            die();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) { http_response_code(400); die(); }

        $projDb = Database::getProjectDB($slug);
        $lastSync = $input['last_synced'] ?? null;

        if ($lastSync) {
            $stmt = $projDb->prepare("UPDATE content SET text = :text, config = :config, updated_at = CURRENT_TIMESTAMP WHERE id = 1 AND updated_at = :ref");
            $stmt->execute([
                ':text' => $input['content'],
                ':config' => json_encode($input['config']),
                ':ref' => $lastSync
            ]);
            if ($stmt->rowCount() === 0) {
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
            $stmt = $projDb->prepare("UPDATE content SET text = :text, config = :config, updated_at = CURRENT_TIMESTAMP WHERE id = 1");
            $stmt->execute([':text' => $input['content'], ':config' => json_encode($input['config'])]);
        }

        $newRow = $projDb->query("SELECT updated_at FROM content WHERE id = 1")->fetch();
        $this->json(['status' => 'ok', 'updated_at' => $newRow['updated_at']]);
    }

    // NEU: Leichter Check, nur Timestamp lesen
    public function check($slug) {
        $this->requireLogin();
        $user = $this->user();

        $proj = Project::findBySlug($slug);
        // Prüfen ob Projekt existiert und Zugriff erlaubt ist
        if (!$proj || !Permission::hasAccess($user['id'], $proj['id'], $user['is_admin'])) {
            http_response_code(403);
            die();
        }

        try {
            $projDb = Database::getProjectDB($slug);
            $row = $projDb->query("SELECT updated_at FROM content WHERE id = 1")->fetch();
            $this->json(['updated_at' => $row['updated_at']]);
        } catch (\Exception $e) {
            http_response_code(500);
            die();
        }
    }
}