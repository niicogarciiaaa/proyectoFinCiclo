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

// Crear base de datos si no existe
if ($accion === 'crear_bd') {
    $sql = "CREATE DATABASE IF NOT EXISTS $nombreBD";
    if ($conn->query($sql)) {
        echo "✅ Base de datos creada correctamente<br>";
    } else {
        echo "❌ Error creando base de datos: " . $conn->error . "<br>";
    }
}

// Comprobar si la base de datos existe antes de seleccionarla
$bdExiste = false;
$result = $conn->query("SHOW DATABASES LIKE '$nombreBD'");
if ($result && $result->num_rows > 0) {
    $bdExiste = true;
    $conn->select_db($nombreBD);
} else if ($accion !== 'crear_bd' && $accion !== 'eliminar_bd') {
    echo "❌ La base de datos <b>$nombreBD</b> no existe. Debes crearla primero.<br>";
}

// Solo ejecutar acciones si la base de datos existe o si la acción es eliminar_bd o crear_bd
if ($bdExiste || $accion === 'eliminar_bd' || $accion === 'crear_bd') {

    if ($accion === 'crear_users') {
        $sqlUsers = "CREATE TABLE IF NOT EXISTS Users (
            UserID INT AUTO_INCREMENT PRIMARY KEY,
            Email VARCHAR(255) NOT NULL UNIQUE,
            FullName VARCHAR(255) NOT NULL,
            Password VARCHAR(255) NOT NULL,
            Role ENUM('Usuario', 'Taller', 'Administrador') NOT NULL DEFAULT 'Usuario',
            CreateAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )";
        if ($conn->query($sqlUsers)) {
            echo "✅ Tabla 'Users' creada correctamente<br>";
        } else {
            echo "❌ Error creando tabla 'Users': " . $conn->error . "<br>";
        }
    }

    if ($accion === 'crear_workshops') {
        $sqlWorkshops = "CREATE TABLE IF NOT EXISTS Workshops (
            WorkshopID INT AUTO_INCREMENT PRIMARY KEY,
            UserID INT NOT NULL UNIQUE,
            Name VARCHAR(255) NOT NULL,
            Address VARCHAR(255) NOT NULL,
            Phone VARCHAR(20) NOT NULL,
            Description TEXT,
            CreateAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
        )";
        if ($conn->query($sqlWorkshops)) {
            echo "✅ Tabla 'Workshops' creada correctamente<br>";
        } else {
            echo "❌ Error creando tabla 'Workshops': " . $conn->error . "<br>";
        }
    }

    if ($accion === 'crear_notification_preferences') {
        $sqlNotificationPreferences = "CREATE TABLE IF NOT EXISTS NotificationPreferences (
            PreferenceID INT AUTO_INCREMENT PRIMARY KEY,
            UserID INT NOT NULL UNIQUE,
            NotificationType ENUM('SMS', 'Telegram', 'WhatsApp') NOT NULL,
            ContactValue VARCHAR(255) NOT NULL,
            IsActive BOOLEAN DEFAULT true,
            CreateAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
        )";
        if ($conn->query($sqlNotificationPreferences)) {
            echo "✅ Tabla 'NotificationPreferences' creada correctamente<br>";
        } else {
            echo "❌ Error creando tabla 'NotificationPreferences': " . $conn->error . "<br>";
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
            FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
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
            WorkshopID INT NOT NULL,
            Service TEXT NOT NULL,
            Status ENUM('Pendiente', 'Confirmada', 'Finalizada', 'Cancelada') DEFAULT 'Pendiente',
            StartDateTime DATETIME NOT NULL,
            EndDateTime DATETIME NOT NULL,
            Description TEXT,
            CreateAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
            FOREIGN KEY (VehicleID) REFERENCES Vehicles(VehicleID) ON DELETE CASCADE,
            FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
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
            UserID INT NOT NULL,
            Date DATE NOT NULL,
            TotalAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            Estado ENUM('Pendiente', 'Pagado') NOT NULL DEFAULT 'Pendiente',
            FOREIGN KEY (AppointmentID) REFERENCES Appointments(AppointmentID) ON DELETE CASCADE,
            FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
        )";
        if ($conn->query($sqlInvoices)) {
            echo "✅ Tabla 'Invoices' creada correctamente<br>";
        } else {
            echo "❌ Error creando tabla 'Invoices': " . $conn->error . "<br>";
        }
    }

    if ($accion === 'crear_invoice_items') {
        $sqlInvoiceItems = "CREATE TABLE IF NOT EXISTS InvoiceItems (
            ItemID INT AUTO_INCREMENT PRIMARY KEY,
            InvoiceID INT NOT NULL,
            Description TEXT NOT NULL,
            Quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
            UnitPrice DECIMAL(10,2) NOT NULL,
            TaxRate DECIMAL(5,2) NOT NULL DEFAULT 21.00,
            Amount DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (InvoiceID) REFERENCES Invoices(InvoiceID) ON DELETE CASCADE
        )";
        if ($conn->query($sqlInvoiceItems)) {
            echo "✅ Tabla 'InvoiceItems' creada correctamente<br>";
        } else {
            echo "❌ Error creando tabla 'InvoiceItems': " . $conn->error . "<br>";
        }
    }

    if ($accion === 'eliminar_bd') {
        $sql = "DROP DATABASE IF EXISTS $nombreBD";
        if ($conn->query($sql)) {
            echo "🗑️ Base de datos eliminada correctamente<br>";
        } else {
            echo "❌ Error al eliminar la base de datos: " . $conn->error . "<br>";
        }
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
        <button name="accion" value="crear_workshops">Crear Tabla Workshops</button>
        <button name="accion" value="crear_notification_preferences">Crear Tabla NotificationPreferences</button>
        <button name="accion" value="crear_vehicles">Crear Tabla Vehicles</button>
        <button name="accion" value="crear_appointments">Crear Tabla Appointments</button>
        <button name="accion" value="crear_invoices">Crear Tabla Invoices</button>
        <button name="accion" value="crear_invoice_items">Crear Tabla InvoiceItems</button>
        <button name="accion" value="eliminar_bd" onclick="return confirm('¿Estás seguro de que deseas eliminar TODA la base de datos? Esta acción no se puede deshacer.')">🗑️ Eliminar Base de Datos</button>
    </form>
</body>
</html>