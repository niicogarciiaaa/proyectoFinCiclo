<?php
// Conexión
$host = "localhost";
$usuario = "hmi";
$contrasena = "hmi";
$nombreBD = "AutoCareHub";

$conn = new mysqli($host, $usuario, $contrasena, $nombreBD);
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}

// 1. Insertar un usuario
$email = "cliente@autocare.com";
$fullname = "Juan Pérez";
$password = password_hash("claveSegura123", PASSWORD_DEFAULT);

$sqlUsuario = "INSERT INTO Users (Email, FullName, Password) VALUES (?, ?, ?)";
$stmt = $conn->prepare($sqlUsuario);
$stmt->bind_param("sss", $email, $fullname, $password);
$stmt->execute();
$userId = $stmt->insert_id;
echo "✅ Usuario insertado con ID $userId<br>";

// 2. Insertar dos vehículos para ese usuario
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
    $stmt->execute();
    $vehicleIds[] = $stmt->insert_id;
    echo "✅ Vehículo insertado con ID " . end($vehicleIds) . "<br>";
}

// 3. Insertar dos citas (appointments)
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
    $stmt->execute();
    $appointmentIds[] = $stmt->insert_id;
    echo "✅ Cita insertada con ID " . end($appointmentIds) . "<br>";
}

// 4. Insertar facturas (invoices)
$facturas = [
    [$appointmentIds[0], 'Cambio de aceite con filtro incluido', '2025-05-01'],
    [$appointmentIds[1], 'Revisión completa de motor y frenos', '2025-05-03']
];

$sqlFactura = "INSERT INTO Invoices (AppointmentID, Lineas, Date) VALUES (?, ?, ?)";
$stmt = $conn->prepare($sqlFactura);

foreach ($facturas as $f) {
    [$aid, $lineas, $fecha] = $f;
    $stmt->bind_param("iss", $aid, $lineas, $fecha);
    $stmt->execute();
    echo "✅ Factura insertada para la cita $aid<br>";
}

$stmt->close();
$conn->close();
?>
