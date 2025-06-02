<?php
class Logger {
    private static $logFile;
    private static $instance = null;
    private static $logTypes = ['INFO', 'WARNING', 'ERROR', 'AUTH', 'DATABASE', 'API'];
    
    private function __construct() {
        // Constructor privado para singleton
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
            self::init();
        }
        return self::$instance;
    }
    
    public static function init($type = 'app') {
        $logDir = __DIR__ . '/../logs';
        if (!file_exists($logDir)) {
            mkdir($logDir, 0777, true);
        }
        self::$logFile = $logDir . '/' . $type . '_' . date('Y-m-d') . '.log';
    }
    
    public static function log($message, $type = 'INFO', $additionalData = []) {
        self::getInstance();
        
        $timestamp = date('Y-m-d H:i:s');
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown IP';
        $userId = isset($_SESSION['user']['id']) ? $_SESSION['user']['id'] : 'No autenticado';
        $userRole = isset($_SESSION['user']['role']) ? $_SESSION['user']['role'] : 'N/A';
        $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'N/A';
        $requestUri = $_SERVER['REQUEST_URI'] ?? 'N/A';
        
        // Datos de contexto estándar
        $contextData = [
            'ip' => $ip,
            'userId' => $userId,
            'userRole' => $userRole,
            'method' => $requestMethod,
            'uri' => $requestUri
        ];
        
        // Combinar datos de contexto con datos adicionales
        $allData = array_merge($contextData, $additionalData);
        
        // Formatear los datos adicionales de manera más legible
        $formattedData = '';
        foreach ($allData as $key => $value) {
            $formattedData .= "\n    " . $key . ": " . (is_array($value) ? json_encode($value) : $value);
        }
        
        $logMessage = sprintf(
            "[%s] [%s] %s%s\n\n",
            $timestamp,
            strtoupper($type),
            $message,
            $formattedData
        );
        
        return file_put_contents(self::$logFile, $logMessage, FILE_APPEND);
    }
    
    // Métodos de logging específicos
    public static function route($message, $additionalData = []) {
        $routeInfo = [
            'file' => debug_backtrace()[1]['file'] ?? 'unknown',
            'line' => debug_backtrace()[1]['line'] ?? 'unknown'
        ];
        return self::log($message, 'ROUTE', array_merge($routeInfo, $additionalData));
    }
    
    public static function auth($message, $additionalData = []) {
        return self::log($message, 'AUTH', $additionalData);
    }
    
    public static function database($message, $additionalData = []) {
        $trace = debug_backtrace()[1];
        $dbInfo = [
            'caller' => ($trace['class'] ?? '') . "\n" . ($trace['function'] ?? '')
        ];
        return self::log($message, 'DATABASE', array_merge($dbInfo, $additionalData));
    }
    
    public static function api($message, $additionalData = []) {
        return self::log($message, 'API', $additionalData);
    }
    
    public static function info($message, $additionalData = []) {
        return self::log($message, 'INFO', $additionalData);
    }
    
    public static function warning($message, $additionalData = []) {
        return self::log($message, 'WARNING', $additionalData);
    }
    
    public static function error($message, $additionalData = []) {
        $trace = debug_backtrace();
        $errorInfo = [
            'file' => $trace[0]['file'] ?? 'unknown',
            'line' => $trace[0]['line'] ?? 'unknown',
            'trace' => array_slice($trace, 1, 3) // Capturar los últimos 3 niveles del stack
        ];
        return self::log($message, 'ERROR', array_merge($errorInfo, $additionalData));
    }
    
    public static function cors($message, $additionalData = []) {
        $corsInfo = [
            'origin' => $_SERVER['HTTP_ORIGIN'] ?? 'unknown',
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown'
        ];
        return self::log($message, 'CORS', array_merge($corsInfo, $additionalData));
    }
    
    // Método para logging de transacciones
    public static function transaction($message, $type, $status, $additionalData = []) {
        $transactionInfo = [
            'type' => $type,
            'status' => $status,
            'timestamp' => microtime(true)
        ];
        return self::log($message, 'TRANSACTION', array_merge($transactionInfo, $additionalData));
    }
    
    // Método para logging de seguridad
    public static function security($message, $additionalData = []) {
        $securityInfo = [
            'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'referer' => $_SERVER['HTTP_REFERER'] ?? 'none'
        ];
        return self::log($message, 'SECURITY', array_merge($securityInfo, $additionalData));
    }
    
    // Método para logging de rendimiento
    public static function performance($message, $startTime, $additionalData = []) {
        $duration = microtime(true) - $startTime;
        $perfInfo = [
            'duration' => round($duration * 1000, 2) . 'ms',
            'memory' => memory_get_usage(true)
        ];
        return self::log($message, 'PERFORMANCE', array_merge($perfInfo, $additionalData));
    }
}
?>