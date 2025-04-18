<?php
// Datos de conexión
$host = "localhost";
$usuario = "hmi";
$contrasena = "hmi";
$nombreBD = "AutoCareHub";

// Conexión
$conn = new mysqli($host, $usuario, $contrasena);
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}

// Procesamiento de botones
$accion = $_POST['accion'] ?? null;

if ($accion === 'crear_bd') {
    $sql = "CREATE DATABASE IF NOT EXISTS $nombreBD";
    if ($conn->query($sql)) {
        echo "✅ Base de datos creada correctamente<br>";
    } else {
        echo "❌ Error creando base de datos: " . $conn->error . "<br>";
    }
}

$conn->select_db($nombreBD);

if ($accion === 'crear_users') {
    $sqlUsers = "CREATE TABLE IF NOT EXISTS Users (
        UserId INT AUTO_INCREMENT PRIMARY KEY,
        Email VARCHAR(255) NOT NULL UNIQUE,
        FullName VARCHAR(255) NOT NULL,
        Password VARCHAR(255) NOT NULL,
        CreateAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    if ($conn->query($sqlUsers)) {
        echo "✅ Tabla 'Users' creada correctamente<br>";
    } else {
        echo "❌ Error creando tabla 'Users': " . $conn->error . "<br>";
    }
}

if ($accion === 'crear_vehicles') {
    $sqlVehicles = "CREATE TABLE IF NOT EXISTS Vehicles (
        VehicleID INT AUTO_INCREMENT PRIMARY KEY,
        UserID INT NOT NULL,
        Marca VARCHAR(255) NOT NULL,
        Modelo VARCHAR(255) NOT NULL,
        Anyo INT NOT NULL,
        Matricula VARCHAR(7) NOT NULL,
        FOREIGN KEY (UserID) REFERENCES Users(UserId) ON DELETE CASCADE
    )";
    if ($conn->query($sqlVehicles)) {
        echo "✅ Tabla 'Vehicles' creada correctamente<br>";
    } else {
        echo "❌ Error creando tabla 'Vehicles': " . $conn->error . "<br>";
    }
}

if ($accion === 'crear_appointments') {
    $sqlAppointments = "CREATE TABLE IF NOT EXISTS Appointments (
        AppointmentID INT AUTO_INCREMENT PRIMARY KEY,
        UserID INT NOT NULL,
        VehicleID INT NOT NULL,
        Service TEXT NOT NULL,
        Estado VARCHAR(100) NOT NULL,
        AppointmentDate DATE NOT NULL,
        CreateAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (UserID) REFERENCES Users(UserId) ON DELETE CASCADE,
        FOREIGN KEY (VehicleID) REFERENCES Vehicles(VehicleID) ON DELETE CASCADE
    )";
    if ($conn->query($sqlAppointments)) {
        echo "✅ Tabla 'Appointments' creada correctamente<br>";
    } else {
        echo "❌ Error creando tabla 'Appointments': " . $conn->error . "<br>";
    }
}

if ($accion === 'crear_invoices') {
    $sqlInvoices = "CREATE TABLE IF NOT EXISTS Invoices (
        InvoiceID INT AUTO_INCREMENT PRIMARY KEY,
        AppointmentID INT NOT NULL,
        Lineas TEXT NOT NULL,
        Date DATE NOT NULL,
        FOREIGN KEY (AppointmentID) REFERENCES Appointments(AppointmentID) ON DELETE CASCADE
    )";
    if ($conn->query($sqlInvoices)) {
        echo "✅ Tabla 'Invoices' creada correctamente<br>";
    } else {
        echo "❌ Error creando tabla 'Invoices': " . $conn->error . "<br>";
    }
}

$conn->close();
?>

<!-- Interfaz HTML -->
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Crear Base de Datos AutoCareHub</title>
</head>
<body>
    <h2>Gestión de Base de Datos - AutoCareHub</h2>
    <form method="POST">
        <button name="accion" value="crear_bd">Crear Base de Datos</button>
        <button name="accion" value="crear_users">Crear Tabla Users</button>
        <button name="accion" value="crear_vehicles">Crear Tabla Vehicles</button>
        <button name="accion" value="crear_appointments">Crear Tabla Appointments</button>
        <button name="accion" value="crear_invoices">Crear Tabla Invoices</button>
    </form>
</body>
</html>
