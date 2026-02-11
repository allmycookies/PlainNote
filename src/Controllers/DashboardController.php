<?php
namespace App\Controllers;
use App\Models\Project;
use App\Models\Permission;
use App\Models\User;

class DashboardController extends Controller {
    public function index() {
        $this->requireLogin();
        $user = $this->user();

        if ($user['is_admin']) {
            $projects = Project::getAll();
            $allUsers = User::getAll();
        } else {
            $projects = Permission::getProjectsForUser($user['id']);
            $allUsers = [];
        }

        $this->view('dashboard/index', [
            'user' => $user,
            'projects' => $projects,
            'allUsers' => $allUsers,
            'allProjects' => ($user['is_admin'] ? $projects : [])
        ]);
    }
}
