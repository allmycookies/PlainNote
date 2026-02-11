<?php
namespace App\Controllers;
use App\Models\User;

class AuthController extends Controller {
    public function setup() {
        if (User::count() > 0) $this->redirect('/login');

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
             $user = trim($_POST['username']);
             $pass = $_POST['password'];
             if ($user && $pass) {
                 User::create($user, $pass, 1);
                 $this->redirect('/login');
             }
        }
        $this->view('auth/setup');
    }

    public function login() {
        if (User::count() == 0) $this->redirect('/setup');

        $error = '';
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $u = User::findByUsername($_POST['username']);
            if ($u && password_verify($_POST['password'], $u['password'])) {
                $_SESSION['user'] = $u;
                $this->redirect('/');
            } else {
                $error = "Falsche Zugangsdaten";
            }
        }
        $this->view('auth/login', ['error' => $error]);
    }

    public function logout() {
        session_destroy();
        $this->redirect('/login');
    }
}
