<?php
namespace App\Core;

class Config {
    public const DATA_DIR = __DIR__ . '/../../data';
    public const PROJECT_DIR = self::DATA_DIR . '/projects';
    public const MASTER_DB = self::DATA_DIR . '/master.sqlite';
    public const VERSION = '0.8.2';
}
