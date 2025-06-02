<?php
session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/VehicleController.php';
require_once __DIR__ . '/../config/mockSession.php';

// Simular sesión para desarrollo
MockSession::mockAs('Usuario'); // Puedes cambiar el rol según necesites probar

// Verificar si el usuario está autenticado
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    echo "<p>Debe iniciar sesión para ver esta página.</p>";
    exit();
}

$user_id = $_SESSION['user']['id'];
$db = new Database();
$conn = $db->getConnection();
$vehicleController = new VehicleController();

// Mostrar formulario de registro de vehículo
?>
<div class="form-container">
    <h2>Registrar Nuevo Vehículo</h2>
    <form id="vehicleForm">
        <div>
            <label for="marca">Marca:</label>
            <input type="text" id="marca" name="marca" required>
        </div>
        <div>
            <label for="modelo">Modelo:</label>
            <input type="text" id="modelo" name="modelo" required>
        </div>
        <div>
            <label for="anyo">Año:</label>
            <input type="number" id="anyo" name="anyo" required>
        </div>
        <div>
            <label for="matricula">Matrícula:</label>
            <input type="text" id="matricula" name="matricula" required>
        </div>
        <button type="submit">Registrar Vehículo</button>
    </form>
</div>

<?php
// Obtener y mostrar los vehículos del usuario
$result = $vehicleController->getVehicles($user_id);

if ($result['success']) {
    if (!empty($result['vehicles'])) {
        echo "<div class='vehicles-container'>";
        echo "<h2>Mis Vehículos</h2>";
        foreach ($result['vehicles'] as $vehicle) {
            echo "<div class='vehicle-card'>";
            echo "<h3>" . htmlspecialchars($vehicle['marca']) . " " . htmlspecialchars($vehicle['modelo']) . "</h3>";
            echo "<p>Año: " . htmlspecialchars($vehicle['anyo']) . "</p>";
            echo "<p>Matrícula: " . htmlspecialchars($vehicle['matricula']) . "</p>";
            echo "<div class='actions'>";
            echo "<button onclick='editVehicle(" . $vehicle['VehicleID'] . ")'>Editar</button>";
            echo "<button onclick='deleteVehicle(" . $vehicle['VehicleID'] . ")'>Eliminar</button>";
            echo "</div>";
            echo "</div>";
        }
        echo "</div>";
    } else {
        echo "<p>No tiene vehículos registrados.</p>";
    }
} else {
    echo "<p>Error al cargar los vehículos: " . htmlspecialchars($result['message']) . "</p>";
}
?>