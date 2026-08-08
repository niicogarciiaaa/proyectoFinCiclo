<?php
// Vista simple para mostrar los talleres disponibles
require_once __DIR__ . '/../config/database.php';

// Inicializar la conexión a la base de datos
$db = new Database();
$conn = $db->getConnection();

// Obtener los talleres de la base de datos
$query = "SELECT w.WorkshopID, w.Name, w.Address, w.Phone, w.Description 
          FROM Workshops w";
$result = $conn->query($query);

// Verificar si hay talleres
if ($result && $result->num_rows > 0) {
    echo "<h2>Talleres Disponibles</h2>";
    echo "<div class='workshops-container'>";
    
    while ($workshop = $result->fetch_assoc()) {
        echo "<div class='workshop-card'>";
        echo "<h3>" . htmlspecialchars($workshop['Name']) . "</h3>";
        echo "<p><strong>Dirección:</strong> " . htmlspecialchars($workshop['Address']) . "</p>";
        echo "<p><strong>Teléfono:</strong> " . htmlspecialchars($workshop['Phone']) . "</p>";
        if (!empty($workshop['Description'])) {
            echo "<p><strong>Descripción:</strong> " . htmlspecialchars($workshop['Description']) . "</p>";
        }
        echo "</div>";
    }
    
    echo "</div>";
} else {
    echo "<p>No hay talleres disponibles en este momento.</p>";
}

// Cerrar la conexión
$conn->close();
?>