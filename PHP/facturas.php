<?php
header("Access-Control-Allow-Origin: *");
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

// Manejar solicitud POST (Crear factura) - SOLO PARA USUARIOS DE TALLER
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Verificar si el usuario tiene rol de Taller
    if ($user_role !== 'Taller') {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['error' => 'No tienes permisos para crear facturas. Solo los usuarios de taller pueden realizar esta acción.']);
        exit;
    }

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

        // Verificar que la cita exista y pertenezca a un cliente
        $stmtCheck = $conn->prepare("SELECT UserID FROM Appointments WHERE AppointmentID = ?");
        $stmtCheck->bind_param("i", $appointment_id);
        
        if (!$stmtCheck->execute()) {
            throw new Exception('Error al verificar la cita: ' . $stmtCheck->error);
        }
        
        $resultCheck = $stmtCheck->get_result();
        if ($resultCheck->num_rows === 0) {
            header('HTTP/1.1 404 Not Found');
            echo json_encode(['error' => 'La cita especificada no existe.']);
            exit;
        }
        
        $appointmentData = $resultCheck->fetch_assoc();
        $client_id = $appointmentData['UserID'];
        $stmtCheck->close();

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

        // Insertar factura - El usuario del taller que crea la factura se registra como creador
        $stmt = $conn->prepare("INSERT INTO Invoices (AppointmentID, Date, TotalAmount, Estado, UserID) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("isdsi", $appointment_id, $date, $total, $estado, $user_id);
        
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

        // Actualizar el estado de la cita a "Finalizada" ya que "Facturada" no es un estado válido según la definición de la tabla
        $stmtUpdateAppointment = $conn->prepare("UPDATE Appointments SET Status = 'Finalizada' WHERE AppointmentID = ?");
        $stmtUpdateAppointment->bind_param("i", $appointment_id);
        
        if (!$stmtUpdateAppointment->execute()) {
            throw new Exception('Error al actualizar el estado de la cita: ' . $stmtUpdateAppointment->error);
        }
        
        $stmtUpdateAppointment->close();

        // Confirmar transacción
        $conn->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Factura creada correctamente y cita actualizada a estado Finalizada',
            'invoice_id' => $invoice_id
        ]);

    } catch (Exception $e) {
        $conn->rollback();
        header('HTTP/1.1 500 Internal Server Error');
        echo json_encode(['error' => $e->getMessage()]);
        exit;
    }
}

// Manejar solicitud GET (Obtener facturas) - USUARIOS NORMALES PUEDEN VER SUS FACTURAS
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Si es usuario de taller, puede ver todas las facturas
        if ($user_role === 'Taller') {
            $stmt = $conn->prepare("
                SELECT 
                    i.InvoiceID,
                    i.AppointmentID, 
                    i.Date, 
                    i.TotalAmount, 
                    i.Estado,
                    u.FullName AS UserName,
                    a.VehicleID,
                    v.Modelo,
                    v.Anyo,
                    w.WorkshopID,
                    w.Name AS WorkshopName,
                    w.Address AS WorkshopAddress,
                    w.Phone AS WorkshopPhone
                FROM Invoices i
                JOIN Appointments a ON i.AppointmentID = a.AppointmentID
                JOIN Users u ON a.UserID = u.UserID
                LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
                LEFT JOIN Workshops w ON a.WorkshopID = w.WorkshopID
                ORDER BY i.Date DESC
            ");
        } else {
            $stmt = $conn->prepare("
                SELECT 
                    i.InvoiceID, 
                    i.AppointmentID,
                    i.Date, 
                    i.TotalAmount, 
                    i.Estado,
                    a.VehicleID,
                    v.Marca,
                    v.Modelo,
                    v.Anyo,
                    w.WorkshopID,
                    w.Name AS WorkshopName,
                    w.Address AS WorkshopAddress,
                    w.Phone AS WorkshopPhone
                FROM Invoices i
                JOIN Appointments a ON i.AppointmentID = a.AppointmentID
                LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
                LEFT JOIN Workshops w ON a.WorkshopID = w.WorkshopID
                WHERE a.UserID = ?
                ORDER BY i.Date DESC
            ");
            $stmt->bind_param("i", $user_id);
        }

        if (!$stmt->execute()) {
            throw new Exception('Error al obtener las facturas: ' . $stmt->error);
        }

        $result = $stmt->get_result();
        $invoices = [];

        while ($invoice = $result->fetch_assoc()) {
            // Obtener ítems
            $stmtItems = $conn->prepare("
                SELECT 
                    ItemID,
                    Description,
                    Quantity,
                    UnitPrice,
                    TaxRate,
                    Amount
                FROM InvoiceItems
                WHERE InvoiceID = ?
            ");
            $stmtItems->bind_param("i", $invoice['InvoiceID']);
            $stmtItems->execute();
            $resultItems = $stmtItems->get_result();

            $items = [];
            while ($item = $resultItems->fetch_assoc()) {
                $items[] = $item;
            }

            $invoice['items'] = $items;
            $invoices[] = $invoice;

            $stmtItems->close();
        }

        $stmt->close();

        echo json_encode([
            'success' => true,
            'invoices' => $invoices
        ]);
    } catch (Exception $e) {
        header('HTTP/1.1 500 Internal Server Error');
        echo json_encode(['error' => $e->getMessage()]);
        exit;
    }
}


$conn->close();