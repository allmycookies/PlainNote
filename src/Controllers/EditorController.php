<?php
namespace App\Controllers;
use App\Models\Project;
use App\Models\Permission;
use App\Core\Database;

class EditorController extends Controller {
    public function show($slug) {
        $this->requireLogin();
        $user = $this->user();

        $proj = Project::findBySlug($slug);
        if (!$proj || !Permission::hasAccess($user['id'], $proj['id'], $user['is_admin'])) {
            die("Kein Zugriff.");
        }

        $projDb = Database::getProjectDB($slug);
        $row = $projDb->query("SELECT content.text as content, content.config, content.updated_at FROM content WHERE id = 1")->fetch();

        $allSlugs = [];
        if ($user['is_admin']) {
            $all = Project::getAll();
            foreach($all as $p) $allSlugs[] = $p['slug'];
        } else {
             $projs = Permission::getProjectsForUser($user['id']);
             foreach($projs as $p) $allSlugs[] = $p['slug'];
        }

        $payload = [
            'slug' => $slug,
            'content' => $row['content'],
            'config' => json_decode($row['config'], true),
            'updated_at' => $row['updated_at'],
            'allSlugs' => $allSlugs
        ];

        $this->view('editor/index', ['slug' => $slug, 'payload' => $payload, 'version' => \App\Core\Config::VERSION]);
    }
}
