<?php
// Conexión a la base de datos ya existente
$host = "localhost";
$usuario = "hmi";
$contrasena = "hmi";
$nombreBD = "AutoCareHub";

$conn = new mysqli($host, $usuario, $contrasena, $nombreBD);
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}

// Inserción de datos
echo "<h2>Insertando datos de prueba en AutoCareHub...</h2>";

// 1. Insertar un usuario
// 1. Insertar un usuario
$email = "cliente@autocare.com";
$fullname = "Juan Pérez";
$password = password_hash("claveSegura123", PASSWORD_DEFAULT);

$sqlUsuario = "INSERT INTO Users (Email, FullName, Password) VALUES (?, ?, ?)";
$stmt = $conn->prepare($sqlUsuario);
$stmt->bind_param("sss", $email, $fullname, $password);
if ($stmt->execute()) {
    $userId = $stmt->insert_id;
    echo "✅ Usuario insertado con ID $userId<br>";

    // Insertar preferencia de notificación (solo una por usuario)
    $notificationType = 'WhatsApp'; // Puede ser 'SMS', 'Telegram' o 'WhatsApp'
    $contactValue = '+34612345678'; // Número de teléfono o usuario de Telegram según el tipo

    $sqlNotification = "INSERT INTO NotificationPreferences (UserID, NotificationType, ContactValue) VALUES (?, ?, ?)";
    $stmtNotif = $conn->prepare($sqlNotification);
    $stmtNotif->bind_param("iss", $userId, $notificationType, $contactValue);
    
    if ($stmtNotif->execute()) {
        echo "✅ Preferencia de notificación configurada: $notificationType<br>";
    } else {
        echo "❌ Error al configurar la notificación: " . $conn->error . "<br>";
    }
    $stmtNotif->close();
} else {
    echo "❌ Error al insertar usuario: " . $conn->error . "<br>";
    exit;
}

// 2. Insertar dos vehículos
$vehiculos = [
    ['Toyota', 'Corolla', 2015, '1234ABC'],
    ['Ford', 'Focus', 2018, '5678DEF']
];

$vehicleIds = [];
$sqlVehiculo = "INSERT INTO Vehicles (UserID, Marca, Modelo, Anyo, Matricula) VALUES (?, ?, ?, ?, ?)";
$stmt = $conn->prepare($sqlVehiculo);
foreach ($vehiculos as $v) {
    [$marca, $modelo, $anyo, $matricula] = $v;
    $stmt->bind_param("issis", $userId, $marca, $modelo, $anyo, $matricula);
    if ($stmt->execute()) {
        $vehicleIds[] = $stmt->insert_id;
        echo "✅ Vehículo insertado con ID " . end($vehicleIds) . "<br>";
    } else {
        echo "❌ Error al insertar vehículo: " . $conn->error . "<br>";
    }
}

// 3. Insertar citas
$appointments = [
    [$userId, $vehicleIds[0], 'Cambio de aceite', 'Pendiente', '2025-05-01'],
    [$userId, $vehicleIds[1], 'Revisión general', 'Confirmada', '2025-05-03']
];

$appointmentIds = [];
$sqlCita = "INSERT INTO Appointments (UserID, VehicleID, Service, Estado, AppointmentDate) VALUES (?, ?, ?, ?, ?)";
$stmt = $conn->prepare($sqlCita);
foreach ($appointments as $a) {
    [$uid, $vid, $servicio, $estado, $fecha] = $a;
    $stmt->bind_param("iisss", $uid, $vid, $servicio, $estado, $fecha);
    if ($stmt->execute()) {
        $appointmentIds[] = $stmt->insert_id;
        echo "✅ Cita insertada con ID " . end($appointmentIds) . "<br>";
    } else {
        echo "❌ Error al insertar cita: " . $conn->error . "<br>";
    }
}

// 4. Insertar facturas
$facturas = [
    [$appointmentIds[0], '2025-05-01', 49.99, 'Pendiente'],
    [$appointmentIds[1], '2025-05-03', 89.50, 'Pagado']
];

$sqlFactura = "INSERT INTO Invoices (AppointmentID, Date, TotalAmount, Estado) VALUES (?, ?, ?, ?)";
$stmt = $conn->prepare($sqlFactura);
$invoiceIds = [];

foreach ($facturas as $f) {
    [$aid, $fecha, $monto, $estado] = $f;
    $stmt->bind_param("isds", $aid, $fecha, $monto, $estado);
    if ($stmt->execute()) {
        $invoiceIds[] = $stmt->insert_id;
        echo "✅ Factura insertada con ID " . end($invoiceIds) . "<br>";
    } else {
        echo "❌ Error al insertar factura: " . $conn->error . "<br>";
    }
}

// 5. Insertar ítems de factura
$items = [
    [$invoiceIds[0], 'Cambio de aceite', 1, 35.00, 21.00, 42.35],
    [$invoiceIds[1], 'Revisión completa', 1, 70.00, 21.00, 84.70]
];

$sqlItems = "INSERT INTO InvoiceItems (InvoiceID, Description, Quantity, UnitPrice, TaxRate, Amount) VALUES (?, ?, ?, ?, ?, ?)";
$stmt = $conn->prepare($sqlItems);
foreach ($items as $i) {
    [$invoiceId, $desc, $qty, $price, $tax, $total] = $i;
    $stmt->bind_param("isdddd", $invoiceId, $desc, $qty, $price, $tax, $total);
    if ($stmt->execute()) {
        echo "✅ Ítem insertado en factura $invoiceId<br>";
    } else {
        echo "❌ Error al insertar ítem: " . $conn->error . "<br>";
    }
}

$stmt->close();
$conn->close();
?>
