<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/VehicleController.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();

// Iniciar sesión
session_start();

// Asegurarse de que el usuario esté autenticado
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    Logger::warning("Intento de acceso no autenticado a Vehicles.php");
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
    
    Logger::info("Procesando acción de vehículo", [
        'accion' => $accion,
        'userId' => $user_id
    ]);
    
    switch($accion) {
        case 'crear':
            // Obtener datos del vehículo
            $marca = $input["marca"] ?? '';
            $modelo = $input["modelo"] ?? '';
            $anyo = $input["anyo"] ?? '';
            $matricula = $input["matricula"] ?? '';
            
            Logger::info("Creando nuevo vehículo", [
                'marca' => $marca,
                'modelo' => $modelo,
                'matricula' => $matricula
            ]);
            
            // Crear vehículo
            $result = $vehicleController->createVehicle($user_id, $marca, $modelo, $anyo, $matricula);
            echo json_encode($result);
            break;
            
        case 'listar':
            // Listar vehículos del usuario
            Logger::info("Listando vehículos del usuario", ['userId' => $user_id]);
            $result = $vehicleController->getVehicles($user_id);
            echo json_encode($result);
            break;
            
        case 'detalle':
            // Obtener detalles de un vehículo específico
            $vehiculoID = $input["vehiculoID"] ?? 0;
            Logger::info("Consultando detalles de vehículo", ['vehiculoId' => $vehiculoID]);
            $result = $vehicleController->getVehicleDetails($vehiculoID);
            
            // Verificar si el usuario es el propietario
            if ($result["success"]) {
                $belongs_to_user = ($result["vehicle"]['UserID'] == $user_id);
                $result["is_owner"] = $belongs_to_user;
                
                if (!$belongs_to_user) {
                    Logger::warning("Intento de acceso a vehículo ajeno", [
                        'userId' => $user_id,
                        'vehiculoId' => $vehiculoID
                    ]);
                }
            }
            
            echo json_encode($result);
            break;
            
        case 'eliminar':
            // Eliminar un vehículo
            $vehiculoID = $input["vehiculoID"] ?? 0;
            Logger::info("Eliminando vehículo", ['vehiculoId' => $vehiculoID]);
            $result = $vehicleController->deleteVehicle($user_id, $vehiculoID);
            echo json_encode($result);
            break;
            
        case 'editar':
            // Obtener datos del vehículo
            $vehiculoID = $input["vehiculoID"] ?? 0;
            $marca = $input["marca"] ?? '';
            $modelo = $input["modelo"] ?? '';
            $anyo = $input["anyo"] ?? '';
            $matricula = $input["matricula"] ?? '';
            
            Logger::info("Editando vehículo", [
                'vehiculoId' => $vehiculoID,
                'marca' => $marca,
                'modelo' => $modelo,
                'matricula' => $matricula
            ]);
            
            // Editar vehículo
            $result = $vehicleController->updateVehicle($user_id, $vehiculoID, $marca, $modelo, $anyo, $matricula);
            echo json_encode($result);
            break;
            
        default:
            Logger::warning("Acción inválida en Vehicles.php", ['accion' => $accion]);
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Acción no válida"]);
            break;
    }
} 
// Manejar solicitudes GET (listar vehículos)
else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    Logger::info("Consultando lista de vehículos", ['userId' => $user_id]);
    $result = $vehicleController->getVehicles($user_id);
    echo json_encode($result);
} 
// Método no permitido
else {
    Logger::warning("Método no permitido en Vehicles.php", ['method' => $_SERVER['REQUEST_METHOD']]);
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Método no permitido"]);
}
?>