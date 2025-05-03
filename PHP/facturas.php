<?php
header("Access-Control-Allow-Origin: http://localhost:4200");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");


session_start(); // Iniciar la sesión

$host = "localhost";
$usuario = "hmi";
$contrasena = "hmi";
$nombreBD = "AutoCareHub";

// Conectar a la base de datos
$conn = new mysqli($host, $usuario, $contrasena, $nombreBD);
if ($conn->connect_error) {
    die("❌ Conexión fallida: " . $conn->connect_error);
}

// Verificar si el usuario está autenticado
// if (!isset($_SESSION['user'])) {
//     die("❌ No estás autenticado. Inicia sesión para ver tus facturas.");
// }

// Obtener el ID del usuario y su rol desde la sesión
$user_id = $_SESSION['user']['id'];  // Se usa $_SESSION['user']['id'] para obtener el user_id
$user_role = $_SESSION['user']['role'];  // Se usa $_SESSION['user']['role'] para obtener el rol del usuario

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Obtener el cuerpo de la solicitud en formato JSON
    $data = json_decode(file_get_contents("php://input"), true);

    // Validación básica
    $appointment_id = $data['appointment_id'] ?? null;
    $date = $data['date'] ?? date('Y-m-d');
    $estado = $data['estado'] ?? 'Pendiente';
    $items = $data['items'] ?? [];

    if (!$appointment_id || empty($items)) {
        die("❌ Falta el ID de la cita o los ítems de la factura.");
    }

    // Calcular el total
    $total = 0;
    foreach ($items as $item) {
        $cantidad = floatval($item['quantity']);
        $precio = floatval($item['unit_price']);
        $iva = floatval($item['tax_rate']);
        $importe = $cantidad * $precio * (1 + $iva / 100);
        $total += $importe;
    }

    // Insertar factura
    $stmt = $conn->prepare("INSERT INTO Invoices (AppointmentID, Date, TotalAmount, Estado, UserID) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("isdsd", $appointment_id, $date, $total, $estado, $user_id);
    if (!$stmt->execute()) {
        die("❌ Error insertando factura: " . $stmt->error);
    }

    $invoice_id = $stmt->insert_id;
    $stmt->close();

    // Insertar cada ítem
    $stmtItem = $conn->prepare("INSERT INTO InvoiceItems (InvoiceID, Description, Quantity, UnitPrice, TaxRate, Amount) VALUES (?, ?, ?, ?, ?, ?)");
    foreach ($items as $item) {
        $descripcion = $item['description'];
        $cantidad = floatval($item['quantity']);
        $precio = floatval($item['unit_price']);
        $iva = floatval($item['tax_rate']);
        $importe = $cantidad * $precio * (1 + $iva / 100);

        $stmtItem->bind_param("isdddd", $invoice_id, $descripcion, $cantidad, $precio, $iva, $importe);
        if (!$stmtItem->execute()) {
            echo "❌ Error insertando ítem: " . $stmtItem->error . "<br>";
        }
    }
    $stmtItem->close();

    echo "✅ Factura creada correctamente con ID: $invoice_id<br>";
}

// Recuperar todas las facturas del usuario o todas las facturas si el rol es 'Taller'
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Verificar si el usuario tiene rol 'Taller'
    if ($user_role === 'Taller') {
        // Los talleres pueden ver todas las facturas
        $stmt = $conn->prepare("
            SELECT i.InvoiceID, i.Date, i.TotalAmount, i.Estado, u.FullName AS UserName
            FROM Invoices i
            JOIN Appointments a ON i.AppointmentID = a.AppointmentID
            JOIN Users u ON a.UserID = u.UserID
        ");
    } else {
        // Los usuarios normales solo pueden ver sus propias facturas
        $stmt = $conn->prepare("
            SELECT i.InvoiceID, i.Date, i.TotalAmount, i.Estado
            FROM Invoices i
            JOIN Appointments a ON i.AppointmentID = a.AppointmentID
            WHERE a.UserID = ?
        ");
        $stmt->bind_param("i", $user_id);
    }

    $stmt->execute();
    $result = $stmt->get_result();

    // Comprobar si se encontraron facturas
    if ($result->num_rows === 0) {
        die("❌ No se encontraron facturas para este usuario.");
    }

    $invoices = [];
    while ($invoice = $result->fetch_assoc()) {
        $invoices[] = $invoice;
    }
    $stmt->close();

    // Devolver las facturas en formato JSON
    header('Content-Type: application/json');
    echo json_encode(['invoices' => $invoices]);
}

$conn->close();
?>
