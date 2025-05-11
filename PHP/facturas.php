<?php
header("Access-Control-Allow-Origin: http://localhost:4200");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

session_start();

$host = "localhost";
$usuario = "hmi";
$contrasena = "hmi";
$nombreBD = "AutoCareHub";

// Conectar a la base de datos
$conn = new mysqli($host, $usuario, $contrasena, $nombreBD);
if ($conn->connect_error) {
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode(['error' => 'Error de conexión: ' . $conn->connect_error]);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Verificar autenticación
if (!isset($_SESSION['user'])) {
    header('HTTP/1.1 401 Unauthorized');
    echo json_encode(['error' => 'No estás autenticado. Inicia sesión para ver tus facturas.']);
    exit;
}

$user_id = $_SESSION['user']['id'];
$user_role = $_SESSION['user']['role'];

// Manejar solicitud POST (Crear factura)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);

        // Validación de datos
        $appointment_id = $data['appointment_id'] ?? null;
        $date = $data['date'] ?? date('Y-m-d');
        $estado = $data['estado'] ?? 'Pendiente';
        $items = $data['items'] ?? [];

        if (!$appointment_id || empty($items)) {
            header('HTTP/1.1 400 Bad Request');
            echo json_encode(['error' => 'Faltan datos requeridos (ID de cita o ítems)']);
            exit;
        }

        // Calcular total
        $total = 0;
        foreach ($items as $item) {
            $cantidad = floatval($item['quantity']);
            $precio = floatval($item['unit_price']);
            $iva = floatval($item['tax_rate']);
            $importe = $cantidad * $precio * (1 + $iva / 100);
            $total += $importe;
        }

        // Iniciar transacción
        $conn->begin_transaction();

        // Insertar factura
        $stmt = $conn->prepare("INSERT INTO Invoices (AppointmentID, Date, TotalAmount, Estado, UserID) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("isdsd", $appointment_id, $date, $total, $estado, $user_id);
        
        if (!$stmt->execute()) {
            throw new Exception('Error al crear la factura: ' . $stmt->error);
        }

        $invoice_id = $stmt->insert_id;
        $stmt->close();

        // Insertar items
        $stmtItem = $conn->prepare("INSERT INTO InvoiceItems (InvoiceID, Description, Quantity, UnitPrice, TaxRate, Amount) VALUES (?, ?, ?, ?, ?, ?)");
        
        foreach ($items as $item) {
            $descripcion = $item['description'];
            $cantidad = floatval($item['quantity']);
            $precio = floatval($item['unit_price']);
            $iva = floatval($item['tax_rate']);
            $importe = $cantidad * $precio * (1 + $iva / 100);

            $stmtItem->bind_param("isdddd", $invoice_id, $descripcion, $cantidad, $precio, $iva, $importe);
            if (!$stmtItem->execute()) {
                throw new Exception('Error al insertar ítem: ' . $stmtItem->error);
            }
        }
        $stmtItem->close();

        // Confirmar transacción
        $conn->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Factura creada correctamente',
            'invoice_id' => $invoice_id
        ]);

    } catch (Exception $e) {
        $conn->rollback();
        header('HTTP/1.1 500 Internal Server Error');
        echo json_encode(['error' => $e->getMessage()]);
        exit;
    }
}

// Manejar solicitud GET (Obtener facturas)
else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        if ($user_role === 'Taller') {
            $stmt = $conn->prepare("
                SELECT 
                    i.InvoiceID,
                    i.AppointmentID, 
                    i.Date, 
                    i.TotalAmount, 
                    i.Estado, 
                    u.FullName AS UserName
                FROM Invoices i
                JOIN Appointments a ON i.AppointmentID = a.AppointmentID
                JOIN Users u ON a.UserID = u.UserID
            ");
        } else {
            $stmt = $conn->prepare("
                SELECT 
                    i.InvoiceID, 
                    i.AppointmentID,
                    i.Date, 
                    i.TotalAmount, 
                    i.Estado
                FROM Invoices i
                JOIN Appointments a ON i.AppointmentID = a.AppointmentID
                WHERE a.UserID = ?
            ");
            $stmt->bind_param("i", $user_id);
        }

        if (!$stmt->execute()) {
            throw new Exception('Error al obtener las facturas');
        }

        $result = $stmt->get_result();
        $invoices = [];
        
        while ($invoice = $result->fetch_assoc()) {
            $invoices[] = $invoice;
        }
        
        $stmt->close();

        if (empty($invoices)) {
            echo json_encode([
                'success' => true,
                'message' => 'No se encontraron facturas',
                'invoices' => []
            ]);
        } else {
            echo json_encode([
                'success' => true,
                'invoices' => $invoices
            ]);
        }

    } catch (Exception $e) {
        header('HTTP/1.1 500 Internal Server Error');
        echo json_encode(['error' => $e->getMessage()]);
        exit;
    }
}

$conn->close();
?>