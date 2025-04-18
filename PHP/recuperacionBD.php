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

// Tabla seleccionada
$tabla = $_POST['tabla'] ?? null;

// Función para mostrar tabla
function mostrarTabla($conn, $tabla) {
    $sql = "SELECT * FROM $tabla";
    $result = $conn->query($sql);

    if (!$result || $result->num_rows === 0) {
        echo "<p>⚠️ No hay datos en la tabla <strong>$tabla</strong> o ocurrió un error.</p>";
        return;
    }

    echo "<h3>Contenido de la tabla: $tabla</h3>";
    echo "<table border='1' cellpadding='5' cellspacing='0'>";
    echo "<tr>";

    // Encabezados
    while ($field = $result->fetch_field()) {
        echo "<th>{$field->name}</th>";
    }
    echo "</tr>";

    // Filas
    while ($row = $result->fetch_assoc()) {
        echo "<tr>";
        foreach ($row as $valor) {
            echo "<td>" . htmlspecialchars($valor) . "</td>";
        }
        echo "</tr>";
    }

    echo "</table><br>";
}
?>

<!-- Interfaz HTML -->
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Visualizar Datos - AutoCareHub</title>
</head>
<body>
    <h2>Visualización de Tablas</h2>
    <form method="POST">
        <label for="tabla">Selecciona una tabla:</label>
        <select name="tabla" id="tabla">
            <option value="Users">Users</option>
            <option value="Vehicles">Vehicles</option>
            <option value="Appointments">Appointments</option>
            <option value="Invoices">Invoices</option>
        </select>
        <button type="submit">Ver Datos</button>
    </form>

    <?php
    if ($tabla) {
        mostrarTabla($conn, $tabla);
    }
    $conn->close();
    ?>
</body>
</html>
