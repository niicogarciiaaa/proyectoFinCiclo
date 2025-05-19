<?php
// Habilitar CORS (Cross-Origin Resource Sharing)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Manejar solicitudes preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}


// Definir las credenciales de la base de datos
$DB_HOST = "localhost";
$DB_NAME = "AutoCareHub";
$DB_USER = "hmi";
$DB_PASS = "hmi";

// Conexión a la base de datos
$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error de conexión al servidor"]);
    exit();
}

session_start();

// Asegurarse de que el usuario esté autenticado
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Usuario no autenticado"]);
    exit();
}

$user_id = $_SESSION['user']['id']; // Obtener el ID del usuario desde la sesión

// Verificar el método de la solicitud
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    // Obtener y decodificar datos de entrada
    $input = json_decode(file_get_contents("php://input"), true);
    $accion = $input["accion"] ?? '';

    // Crear un nuevo vehículo
    if ($accion === 'crear') {
        $marca = $input["marca"] ?? '';
        $modelo = $input["modelo"] ?? '';
        $anyo = $input["anyo"] ?? '';
        $matricula = $input["matricula"] ?? '';

        // Validar los datos
        if (empty($marca) || empty($modelo) || empty($anyo) || empty($matricula)) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Todos los campos son requeridos"]);
            exit();
        }

        // Preparar la consulta para insertar el nuevo vehículo
        $stmt = $conn->prepare("INSERT INTO Vehicles (UserID, marca, modelo, anyo, matricula) VALUES (?, ?, ?, ?, ?)");
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error en la preparación de la consulta"]);
            exit();
        }

        $stmt->bind_param("issss", $user_id, $marca, $modelo, $anyo, $matricula);
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error al insertar el vehículo"]);
            exit();
        }

        $vehicleID = $conn->insert_id;

        // Devolver respuesta exitosa con el ID del vehículo creado
        echo json_encode([
            "success" => true, 
            "message" => "Vehículo creado con éxito",
            "vehicleID" => $vehicleID
        ]);

        $stmt->close();
        exit();
    } 
    // Listar vehículos del usuario
    else if ($accion === 'listar') {
        // Recuperar los vehículos del usuario autenticado
        $stmt = $conn->prepare("SELECT VehicleID, UserID, marca, modelo, anyo, matricula FROM Vehicles WHERE UserID = ?");
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error en la preparación de la consulta"]);
            exit();
        }

        $stmt->bind_param("i", $user_id);

        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error al ejecutar la consulta"]);
            exit();
        }

        $result = $stmt->get_result();
        $vehicles = [];
        while ($row = $result->fetch_assoc()) {
            $vehicles[] = $row;
        }

        // Devolver los vehículos encontrados
        echo json_encode(["success" => true, "vehicles" => $vehicles]);

        $stmt->close();
        exit();
    }
    // Obtener detalles de un vehículo específico
    else if ($accion === 'detalle') {
        $vehiculoID = $input["vehiculoID"] ?? 0;
        
        if (!$vehiculoID) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "ID de vehículo no proporcionado"]);
            exit();
        }
        
        // Consultar detalles del vehículo y comprobar propiedad
        $stmt = $conn->prepare("SELECT VehicleID, UserID, marca, modelo, anyo, matricula FROM Vehicles WHERE VehicleID = ?");
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error en la preparación de la consulta"]);
            exit();
        }

        $stmt->bind_param("i", $vehiculoID);
        
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error al ejecutar la consulta"]);
            exit();
        }

        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            http_response_code(404);
            echo json_encode(["success" => false, "message" => "Vehículo no encontrado"]);
            exit();
        }
        
        $vehicle = $result->fetch_assoc();
        $belongs_to_user = ($vehicle['UserID'] == $user_id);
        
        echo json_encode([
            "success" => true,
            "vehicle" => $vehicle,
            "is_owner" => $belongs_to_user
        ]);
        
        $stmt->close();
        exit();
    }
    // Eliminar un vehículo
    else if ($accion === 'eliminar') {
        $vehiculoID = $input["vehiculoID"] ?? 0;

        if (!$vehiculoID) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "ID de vehículo no proporcionado"]);
            exit();
        }

        // Consultar si el vehículo existe y pertenece al usuario
        $stmt = $conn->prepare("SELECT VehicleID, UserID FROM Vehicles WHERE VehicleID = ?");
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error en la preparación de la consulta"]);
            exit();
        }

        $stmt->bind_param("i", $vehiculoID);
        
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error al ejecutar la consulta"]);
            exit();
        }

        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            http_response_code(404);
            echo json_encode(["success" => false, "message" => "Vehículo no encontrado"]);
            exit();
        }

        $vehicle = $result->fetch_assoc();

        // Verificar que el vehículo pertenece al usuario
        if ($vehicle['UserID'] !== $user_id) {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "No tienes permiso para eliminar este vehículo"]);
            exit();
        }

        // Eliminar el vehículo
        $stmt = $conn->prepare("DELETE FROM Vehicles WHERE VehicleID = ?");
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error en la preparación de la consulta para eliminar"]);
            exit();
        }

        $stmt->bind_param("i", $vehiculoID);
        
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error al eliminar el vehículo"]);
            exit();
        }

        // Devolver respuesta exitosa
        echo json_encode(["success" => true, "message" => "Vehículo eliminado con éxito"]);

        $stmt->close();
        exit();
    }
} else if ($_SERVER["REQUEST_METHOD"] === "GET") {
    // Recuperar los vehículos del usuario autenticado
    $stmt = $conn->prepare("SELECT VehicleID, UserID, marca, modelo, anyo, matricula FROM Vehicles WHERE UserID = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error en la preparación de la consulta"]);
        exit();
    }

    $stmt->bind_param("i", $user_id);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al ejecutar la consulta"]);
        exit();
    }

    $result = $stmt->get_result();
    $vehicles = [];
    while ($row = $result->fetch_assoc()) {
        $vehicles[] = $row;
    }

    // Devolver los vehículos encontrados
    echo json_encode(["success" => true, "vehicles" => $vehicles]);

    $stmt->close();
    exit();
}

// Si el método no es ni GET ni POST
http_response_code(405);
echo json_encode(["success" => false, "message" => "Método no permitido"]);
$conn->close();
?>
