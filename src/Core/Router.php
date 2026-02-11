<?php
namespace App\Core;

class Router {
    private $routes = [];

    public function get($path, $callback) {
        $this->routes['GET'][$path] = $callback;
    }

    public function post($path, $callback) {
        $this->routes['POST'][$path] = $callback;
    }

    public function dispatch() {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

        $scriptName = dirname($_SERVER['SCRIPT_NAME']);
        $basePath = ($scriptName === '/' || $scriptName === '\\') ? '' : $scriptName;
        $route = substr($uri, strlen($basePath));
        if ($route === '') $route = '/';
        if ($route !== '/' && substr($route, -1) === '/') $route = rtrim($route, '/');

        if (isset($this->routes[$method][$route])) {
            return call_user_func($this->routes[$method][$route]);
        }

        foreach ($this->routes[$method] ?? [] as $path => $callback) {
            if (strpos($path, '#') === 0) {
                if (preg_match($path, $route, $matches)) {
                    array_shift($matches);
                    return call_user_func_array($callback, $matches);
                }
            }
        }

        http_response_code(404);
        echo "404 Not Found";
    }
}
