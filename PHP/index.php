<?php
require_once 'config.php';
require_once 'controllers/TablaController.php';

$tablaSeleccionada = $_POST['tabla'] ?? null;
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>AutoCareHub - Visualización</title>
</head>
<body>
    <h1>Visualización de Tablas - AutoCareHub</h1>
    <form method="POST">
        <label for="tabla">Selecciona una tabla:</label>
        <select name="tabla" id="tabla">
            <option value="Users">Users</option>
            <option value="Vehicles">Vehicles</option>
            <option value="Appointments">Appointments</option>
            <option value="Invoices">Invoices</option>
        </select>
        <button type="submit">Ver</button>
    </form>

    <?php
    if ($tablaSeleccionada) {
        $controlador = new TablaController($conn);
        $controlador->mostrarTabla($tablaSeleccionada);
    }

    $conn->close();
    ?>
</body>
</html>
