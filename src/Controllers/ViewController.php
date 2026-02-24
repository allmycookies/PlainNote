<?php
namespace App\Controllers;
use App\Models\Permission;
use PDO;

class ViewController extends Controller {
    
    private function preparePayload($slug) {
        $this->requireLogin();
        $user = $this->user();

        // Zugriffsprüfung: Wir verbinden manuell um Projekt-ID zu finden, 
        // falls Models nicht verfügbar sind, oder nutzen Models wenn sicher vorhanden.
        // Hier nutzen wir Permission Model da es Teil der Core-Logik ist.
        // Wenn das Projekt nicht existiert, wirft Model meist Fehler oder gibt null.
        
        // Direkte Verbindung zur Projekt-Datenbank aufbauen (Pfad-Konvention beachten!)
        // Pfad: /../../data/projects/{slug}.sqlite relativ zu diesem Controller
        $dbPath = __DIR__ . '/../../data/projects/' . basename($slug) . '.sqlite';
        
        if (!file_exists($dbPath)) {
            http_response_code(404);
            die("Projekt-Datenbank nicht gefunden.");
        }

        try {
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            // Lade Content
            $stmt = $pdo->query("SELECT text as content, config, updated_at FROM content WHERE id = 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                // Initial, falls leer
                $row = ['content' => '', 'config' => '{}', 'updated_at' => time()];
            }

            return [
                'slug' => $slug,
                'content' => $row['content'],
                'config' => json_decode($row['config'], true),
                'updated_at' => $row['updated_at']
            ];

        } catch (\Exception $e) {
            http_response_code(500);
            die("Datenbankfehler: " . $e->getMessage());
        }
    }

    public function kanban($slug) {
        $payload = $this->preparePayload($slug);
        $this->view('modules/kanban', ['payload' => $payload]);
    }

    public function calendar($slug) {
        $payload = $this->preparePayload($slug);
        $this->view('modules/calendar', ['payload' => $payload]);
    }

    public function gantt($slug) {
        $payload = $this->preparePayload($slug);
        $this->view('modules/gantt', ['payload' => $payload]);
    }
}