<?php
/**
 * Utilidad para simular sesiones durante el desarrollo
 */
class MockSession {
    private static $mockEnabled = true; // Cambiar a false en producción
    
    public static function mock() {
        if (self::$mockEnabled && !isset($_SESSION['user'])) {
            $_SESSION['user'] = [
                'id' => 1,
                'email' => 'cliente@autocare.com',
                'name' => 'Usuario de Prueba',
                'role' => 'Usuario', // Puedes cambiar a 'Taller' o 'Administrador' según necesites
                'last_activity' => time()
            ];
        }
    }
    
    public static function mockAs($role) {
        if (self::$mockEnabled) {
            switch ($role) {
                case 'Taller':
                    $_SESSION['user'] = [
                        'id' => 2,
                        'email' => 'taller@autocare.com',
                        'name' => 'Taller de Prueba',
                        'role' => 'Taller',
                        'last_activity' => time()
                    ];
                    break;
                case 'Administrador':
                    $_SESSION['user'] = [
                        'id' => 3,
                        'email' => 'admin@autocare.com',
                        'name' => 'Administrador',
                        'role' => 'Administrador',
                        'last_activity' => time()
                    ];
                    break;
                default:
                    self::mock(); // Usuario normal por defecto
            }
        }
    }

    public static function clear() {
        if (self::$mockEnabled) {
            unset($_SESSION['user']);
        }
    }
}
?>