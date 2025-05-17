<?php
// Habilitar CORS (Cross-Origin Resource Sharing)
header("Access-Control-Allow-Origin: http://localhost:4200");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Manejar solicitudes preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos necesarios
require_once '../config/database.php';
require_once '../controllers/VehicleController.php';

// Iniciar sesión
session_start();

// Asegurarse de que el usuario esté autenticado
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Usuario no autenticado"]);
    exit();
}

$user_id = $_SESSION['user']['id']; // Obtener el ID del usuario desde la sesión
$vehicleController = new VehicleController();

// Manejar solicitudes POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Obtener y decodificar datos de entrada
    $input = json_decode(file_get_contents("php://input"), true);
    $accion = $input["accion"] ?? '';
    
    switch($accion) {
        case 'crear':
            // Obtener datos del vehículo
            $marca = $input["marca"] ?? '';
            $modelo = $input["modelo"] ?? '';
            $anyo = $input["anyo"] ?? '';
            $matricula = $input["matricula"] ?? '';
            
            // Crear vehículo
            $result = $vehicleController->createVehicle($user_id, $marca, $modelo, $anyo, $matricula);
            echo json_encode($result);
            break;
            
        case 'listar':
            // Listar vehículos del usuario
            $result = $vehicleController->getVehicles($user_id);
            echo json_encode($result);
            break;
            
        case 'detalle':
            // Obtener detalles de un vehículo específico
            $vehiculoID = $input["vehiculoID"] ?? 0;
            $result = $vehicleController->getVehicleDetails($vehiculoID);
            
            // Verificar si el usuario es el propietario
            if ($result["success"]) {
                $belongs_to_user = ($result["vehicle"]['UserID'] == $user_id);
                $result["is_owner"] = $belongs_to_user;
            }
            
            echo json_encode($result);
            break;
            
        case 'eliminar':
            // Eliminar un vehículo
            $vehiculoID = $input["vehiculoID"] ?? 0;
            $result = $vehicleController->deleteVehicle($user_id, $vehiculoID);
            echo json_encode($result);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Acción no válida"]);
            break;
    }
} 
// Manejar solicitudes GET (listar vehículos)
else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $result = $vehicleController->getVehicles($user_id);
    echo json_encode($result);
} 
// Método no permitido
else {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Método no permitido"]);
}
?>