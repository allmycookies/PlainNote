<?php
namespace App\Controllers;
use App\Models\User;
use App\Models\Project;
use App\Models\Permission;
use App\Core\Config;

class AdminController extends Controller {
    public function handle() {
        $this->requireAdmin();
        $action = $_POST['action'] ?? '';

        if ($action === 'create_user') {
            try { User::create($_POST['username'], $_POST['password']); } catch(\Exception $e){}
        }
        elseif ($action === 'delete_user') {
            if ($_POST['user_id'] != $this->user()['id']) User::delete($_POST['user_id']);
        }
        elseif ($action === 'reset_pw') {
            $newPw = bin2hex(random_bytes(4));
            User::updatePassword($_POST['user_id'], password_hash($newPw, PASSWORD_DEFAULT));
            $_SESSION['flash_msg'] = "PW Reset: $newPw";
        }
        elseif ($action === 'create_project') {
            $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $_POST['slug']), '-'));
            if($slug) try { Project::create($slug, $slug); } catch(\Exception $e){}
        }
        elseif ($action === 'delete_project') {
            Project::delete($_POST['slug']);
        }
        elseif ($action === 'assign_perm') {
            try { Permission::assign($_POST['user_id'], $_POST['project_id']); } catch(\Exception $e){}
        }
        elseif ($action === 'revoke_perm') {
            Permission::revoke($_POST['user_id'], $_POST['project_id']);
        }
        elseif ($action === 'export_project') {
             $slug = $_POST['slug'];
             $file = Config::PROJECT_DIR . '/' . $slug . '.sqlite';
             if (file_exists($file)) {
                 header('Content-Type: application/octet-stream');
                 header('Content-Disposition: attachment; filename="'.$slug.'.sqlite"');
                 readfile($file);
                 exit;
             }
        }
        elseif ($action === 'import_project') {
             if (isset($_FILES['db_file']) && $_FILES['db_file']['error'] == 0) {
                $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $_POST['slug']), '-'));
                if ($slug) {
                    try {
                        $pdo = \App\Core\Database::getMasterDB();
                        $pdo->prepare("INSERT INTO projects (slug, name) VALUES (?, ?)")->execute([$slug, $slug]);
                        move_uploaded_file($_FILES['db_file']['tmp_name'], Config::PROJECT_DIR . '/' . $slug . '.sqlite');
                    } catch(\Exception $e) {
                         $_SESSION['flash_msg'] = "Fehler: Projektname existiert bereits.";
                    }
                }
             }
        }

        $this->redirect('/');
    }
}
