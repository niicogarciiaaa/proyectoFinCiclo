<?php
// Conexión a la base de datos
$host = "localhost";
$usuario = "hmi";
$contrasena = "hmi";
$nombreBD = "AutoCareHub";

$conn = new mysqli($host, $usuario, $contrasena, $nombreBD);
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}

// 1. Insertar un usuario regular (cliente)
$emailCliente = "cliente@autocare.com";
$fullnameCliente = "Juan Pérez";
$passwordCliente = password_hash("claveSegura123", PASSWORD_DEFAULT);
$roleCliente = "Usuario";

$sqlUsuario = "INSERT INTO Users (Email, FullName, Password, Role) VALUES (?, ?, ?, ?)";
$stmt = $conn->prepare($sqlUsuario);
$stmt->bind_param("ssss", $emailCliente, $fullnameCliente, $passwordCliente, $roleCliente);
if ($stmt->execute()) {
    $userId = $stmt->insert_id;
    echo "✅ Usuario cliente insertado con ID $userId<br>";

    // Insertar preferencia de notificación
    $notificationType = 'WhatsApp'; // Puede ser 'SMS', 'Telegram' o 'WhatsApp'
    $contactValue = '+34612345678'; // Número de teléfono o usuario de Telegram según el tipo

    $sqlNotification = "INSERT INTO NotificationPreferences (UserID, NotificationType, ContactValue, IsActive) VALUES (?, ?, ?, true)";
    $stmtNotif = $conn->prepare($sqlNotification);
    $stmtNotif->bind_param("iss", $userId, $notificationType, $contactValue);
    
    if ($stmtNotif->execute()) {
        echo "✅ Preferencia de notificación configurada: $notificationType<br>";
    } else {
        echo "❌ Error al configurar la notificación: " . $conn->error . "<br>";
    }
    $stmtNotif->close();
} else {
    echo "❌ Error al insertar usuario cliente: " . $conn->error . "<br>";
    exit;
}

// 2. Insertar un usuario taller
$emailTaller = "taller@autocare.com";
$fullnameTaller = "Taller Mecánico AutoFix";
$passwordTaller = password_hash("tallerSeguro456", PASSWORD_DEFAULT);
$roleTaller = "Taller";

$sqlTaller = "INSERT INTO Users (Email, FullName, Password, Role) VALUES (?, ?, ?, ?)";
$stmt = $conn->prepare($sqlTaller);
$stmt->bind_param("ssss", $emailTaller, $fullnameTaller, $passwordTaller, $roleTaller);
if ($stmt->execute()) {
    $tallerId = $stmt->insert_id;
    echo "✅ Usuario taller insertado con ID $tallerId<br>";
    
    // Insertar información del taller
    $nombreTaller = "AutoFix Centro";
    $direccionTaller = "Calle Principal 123, Madrid";
    $telefonoTaller = "+34911234567";
    $descripcionTaller = "Taller especializado en reparaciones generales y mantenimiento preventivo.";
    
    $sqlInfoTaller = "INSERT INTO Workshops (UserID, Name, Address, Phone, Description) VALUES (?, ?, ?, ?, ?)";
    $stmtTaller = $conn->prepare($sqlInfoTaller);
    $stmtTaller->bind_param("issss", $tallerId, $nombreTaller, $direccionTaller, $telefonoTaller, $descripcionTaller);
    
    if ($stmtTaller->execute()) {
        $workshopId = $stmtTaller->insert_id;
        echo "✅ Información de taller insertada con ID $workshopId<br>";
    } else {
        echo "❌ Error al insertar información del taller: " . $conn->error . "<br>";
    }
    $stmtTaller->close();
} else {
    echo "❌ Error al insertar usuario taller: " . $conn->error . "<br>";
    exit;
}

// 3. Insertar un administrador
$emailAdmin = "admin@autocare.com";
$fullnameAdmin = "Administrador Sistema";
$passwordAdmin = password_hash("adminSuper789", PASSWORD_DEFAULT);
$roleAdmin = "Administrador";

$sqlAdmin = "INSERT INTO Users (Email, FullName, Password, Role) VALUES (?, ?, ?, ?)";
$stmt = $conn->prepare($sqlAdmin);
$stmt->bind_param("ssss", $emailAdmin, $fullnameAdmin, $passwordAdmin, $roleAdmin);
if ($stmt->execute()) {
    $adminId = $stmt->insert_id;
    echo "✅ Usuario administrador insertado con ID $adminId<br>";
} else {
    echo "❌ Error al insertar usuario administrador: " . $conn->error . "<br>";
}

// 4. Insertar vehículos
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

// 5. Insertar citas
$appointments = [
    [$userId, $vehicleIds[0], $workshopId, 'Cambio de aceite', 'Pendiente', '2025-05-01 10:00:00', '2025-05-01 11:00:00'],
    [$userId, $vehicleIds[1], $workshopId, 'Revisión general', 'Confirmada', '2025-05-03 15:00:00', '2025-05-03 17:00:00']
];

$appointmentIds = [];
$sqlCita = "INSERT INTO Appointments (UserID, VehicleID, WorkshopID, Service, Status, StartDateTime, EndDateTime) VALUES (?, ?, ?, ?, ?, ?, ?)";
$stmt = $conn->prepare($sqlCita);
foreach ($appointments as $a) {
    [$uid, $vid, $wid, $servicio, $estado, $fechaInicio, $fechaFin] = $a;
    $stmt->bind_param("iiissss", $uid, $vid, $wid, $servicio, $estado, $fechaInicio, $fechaFin);
    if ($stmt->execute()) {
        $appointmentIds[] = $stmt->insert_id;
        echo "✅ Cita insertada con ID " . end($appointmentIds) . "<br>";
    } else {
        echo "❌ Error al insertar cita: " . $conn->error . "<br>";
    }
}


// 6. Insertar facturas
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

// 7. Insertar ítems de factura
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
