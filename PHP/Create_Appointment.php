<?php
header("Access-Control-Allow-Origin: http://localhost:4200");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

// Verifica si la sesión está iniciada y las variables necesarias están definidas
if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado.']);
    exit();
}

$userID = $_SESSION['user']['id'];
$userRole = $_SESSION['user']['role'];

// Conexión a la base de datos
$host = "localhost";
$db = "AutoCareHub";
$user = "hmi";
$pass = "hmi";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error de conexión"]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// Solo se acepta POST y todo va en el body
if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!$data || !isset($data['accion'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Datos JSON inválidos o falta 'accion'"]);
        exit();
    }

    $accion = $data['accion'];

    // Consultar huecos disponibles por semana (solo lunes a viernes)
    if ($accion === 'consultar_semana') {
        $tallerID = $data['WorkshopID'] ?? null;
        $fechaInicio = $data['FechaInicio'] ?? null;
        $fechaFin = $data['FechaFin'] ?? null;

        if (!$tallerID || !$fechaInicio || !$fechaFin) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Faltan parámetros"]);
            exit();
        }

        // Validar que la fecha inicial sea un día laborable (lunes a viernes)
        $diaInicioSemana = date('N', strtotime($fechaInicio));
        if ($diaInicioSemana >= 6) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "La fecha inicial debe ser un día laborable (lunes a viernes)"]);
            exit();
        }

        $horaInicio = 9;
        $horaFin = 18;

        // Obtener todas las citas del taller en el rango de fechas (solo días laborables)
        $stmt = $conn->prepare("
            SELECT StartDateTime 
            FROM Appointments 
            WHERE WorkshopID = ? 
            AND DATE(StartDateTime) BETWEEN ? AND ? 
            AND DAYOFWEEK(StartDateTime) BETWEEN 2 AND 6
        ");
        $stmt->bind_param("iss", $tallerID, $fechaInicio, $fechaFin);
        $stmt->execute();
        $result = $stmt->get_result();

        $ocupadas = [];
        while ($row = $result->fetch_assoc()) {
            $fechaHora = $row['StartDateTime'];
            $fecha = date('Y-m-d', strtotime($fechaHora));
            $hora = date('H:i', strtotime($fechaHora));
            $ocupadas[$fecha][] = $hora;
        }

        // Generar huecos solo de lunes a viernes
        $slotsSemana = [];
        $period = new DatePeriod(
            new DateTime($fechaInicio),
            new DateInterval('P1D'),
            (new DateTime($fechaFin))->modify('+1 day')
        );
        
        foreach ($period as $fechaObj) {
            $diaSemana = $fechaObj->format('N'); // 1 (lunes) - 7 (domingo)
            if ($diaSemana >= 6) continue; // Saltar explícitamente sábados (6) y domingos (7)
            
            $fechaStr = $fechaObj->format('Y-m-d');
            $slots = [];
            for ($h = $horaInicio; $h < $horaFin; $h++) {
                $horaSlot = sprintf('%02d:00', $h);
                $estado = (isset($ocupadas[$fechaStr]) && in_array($horaSlot, $ocupadas[$fechaStr])) ? 'Ocupada' : 'Disponible';
                $slots[] = [
                    "hora" => $horaSlot,
                    "estado" => $estado
                ];
            }
            $slotsSemana[$fechaStr] = $slots;
        }

        echo json_encode([
            "success" => true,
            "slotsSemana" => $slotsSemana
        ]);
        exit();
    }

    // Consultar huecos disponibles para un día
    if ($accion === 'consultar') {
        $tallerID = $data['WorkshopID'] ?? null;
        $fecha = $data['Fecha'] ?? null;

        if (!$tallerID || !$fecha) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Faltan parámetros"]);
            exit();
        }

        // Validar que no sea fin de semana
        $diaSemana = date('N', strtotime($fecha));
        if ($diaSemana >= 6) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "No se pueden consultar citas en sábado o domingo"]);
            exit();
        }

        $horaInicio = 9;
        $horaFin = 18;

        $stmt = $conn->prepare("SELECT StartDateTime FROM Appointments WHERE WorkshopID = ? AND DATE(StartDateTime) = ?");
        $stmt->bind_param("is", $tallerID, $fecha);
        $stmt->execute();
        $result = $stmt->get_result();

        $ocupadas = [];
        while ($row = $result->fetch_assoc()) {
            $ocupadas[] = date('H:i', strtotime($row['StartDateTime']));
        }

        $slots = [];
        for ($h = $horaInicio; $h < $horaFin; $h++) {
            $horaSlot = sprintf('%02d:00', $h);
            $estado = in_array($horaSlot, $ocupadas) ? 'Ocupada' : 'Disponible';
            $slots[] = [
                "hora" => $horaSlot,
                "estado" => $estado
            ];
        }

        echo json_encode([
            "success" => true,
            "slots" => $slots
        ]);
        exit();
    }

    // Crear cita
    if ($accion === 'crear') {
        $fecha = $data['Fecha'] ?? null;
        $hora = $data['Hora'] ?? null;
        $vehiculoID = $data['VehicleID'] ?? null;
        $tallerID = $data['WorkshopID'] ?? null;
        $descripcion = $data['Descripcion'] ?? '';
        $estado = $data['Estado'] ?? 'Pendiente';

        if (!$fecha || !$hora || !$vehiculoID || !$tallerID) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Faltan campos obligatorios"]);
            exit();
        }

        // No permitir crear citas en sábado o domingo
        $diaSemana = date('N', strtotime($fecha));
        if ($diaSemana >= 6) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "No se pueden crear citas en sábado o domingo"]);
            exit();
        }

        if (!DateTime::createFromFormat('Y-m-d', $fecha) || !DateTime::createFromFormat('H:i', $hora)) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Formato de fecha u hora inválido"]);
            exit();
        }

        $stmt = $conn->prepare("SELECT * FROM Workshops WHERE WorkshopID = ?");
        $stmt->bind_param("i", $tallerID);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Taller no válido"]);
            exit();
        }

        $startDateTime = $fecha . ' ' . $hora . ':00';
        $endDateTime = date('Y-m-d H:i:s', strtotime($startDateTime . ' +1 hour'));
        $stmt = $conn->prepare("SELECT * FROM Appointments WHERE WorkshopID = ? AND StartDateTime = ?");
        $stmt->bind_param("is", $tallerID, $startDateTime);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows > 0) {
            http_response_code(409);
            echo json_encode(["success" => false, "message" => "Ya existe una cita en ese horario en el taller"]);
            exit();
        }

        $stmt = $conn->prepare("INSERT INTO Appointments (UserID, VehicleID, WorkshopID, StartDateTime, EndDateTime, Description, Status) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("iiissss", $userID, $vehiculoID, $tallerID, $startDateTime, $endDateTime, $descripcion, $estado);
        if ($stmt->execute()) {
            echo json_encode(["success" => true, "message" => "Cita creada correctamente"]);
        } else {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Error al crear la cita"]);
        }
        exit();
    }

    // Ver todas las citas de un taller
    if ($accion === 'ver_citas_taller') {
        if ($userRole !== 'Taller') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Acción no permitida. Solo los talleres pueden ver sus citas.']);
            exit();
        }

        $tallerID = $data['WorkshopID'] ?? null;

        if (!$tallerID) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Faltan parámetros"]);
            exit();
        }

        // Obtener todas las citas del taller (incluyendo las reservadas y no reservadas)
        // Obtener todas las citas del taller (sin importar el estado)
        $stmt = $conn->prepare("
    SELECT 
        a.AppointmentID, 
        a.StartDateTime, 
        a.EndDateTime, 
        CONCAT(v.Marca, ' ', v.Modelo) AS Vehiculo, 
        a.Description, 
        a.Status, 
        u.FullName AS UserName 
    FROM Appointments a 
    JOIN Vehicles v ON a.VehicleID = v.VehicleID 
    JOIN Users u ON v.UserID = u.UserID 
    WHERE a.WorkshopID = ?
");

    
$stmt->bind_param("i", $tallerID);
$stmt->execute();
$result = $stmt->get_result();

$citas = [];
while ($row = $result->fetch_assoc()) {
$citas[] = $row;
}

echo json_encode([
"success" => true,
"citas" => $citas
]);
exit();

    }
} else {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Método no permitido"]);
}
?>
