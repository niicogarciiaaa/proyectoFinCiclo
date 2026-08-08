<?php
// appointmentView.php contenido ejemplo para MVC
session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/AppointmentController.php';

// Verificar si el usuario está autenticado
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    echo "<p>Debe iniciar sesión para ver esta página.</p>";
    exit();
}

$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    echo "<p>Error al conectar con la base de datos.</p>";
    exit();
}

$controller = new AppointmentController(
    $conn,
    $_SESSION['user']['id'],
    $_SESSION['user']['role']
);

try {
    if ($_SESSION['user']['role'] === 'Taller') {
        $response = $controller->verCitasTaller();
        $result = json_decode($response, true);
?>
        <div class="appointments-container">
            <h2>Citas del Taller</h2>
            <?php if ($result['success'] && !empty($result['citas'])): ?>
                <div class="appointments-grid">
                    <?php foreach ($result['citas'] as $cita): ?>
                        <div class="appointment-card">
                            <h3>Cita #<?php echo htmlspecialchars($cita['AppointmentID']); ?></h3>
                            <p><strong>Cliente:</strong> <?php echo htmlspecialchars($cita['UserName']); ?></p>
                            <p><strong>Vehículo:</strong> <?php echo htmlspecialchars($cita['Vehiculo']); ?></p>
                            <p><strong>Fecha:</strong> <?php echo date('d/m/Y H:i', strtotime($cita['StartDateTime'])); ?></p>
                            <p><strong>Estado:</strong> <?php echo htmlspecialchars($cita['Status']); ?></p>
                            <?php if (!empty($cita['Description'])): ?>
                                <p><strong>Descripción:</strong> <?php echo htmlspecialchars($cita['Description']); ?></p>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php else: ?>
                <p>No hay citas programadas.</p>
            <?php endif; ?>
        </div>
<?php
    } else {
        // Para usuarios normales, mostrar formulario de creación de cita y consulta de disponibilidad
?>
        <div class="appointments-container">
            <h2>Solicitar Nueva Cita</h2>
            <form id="appointmentForm">
                <div>
                    <label for="workshopId">Taller:</label>
                    <select name="workshopId" id="workshopId" required>
                        <option value="">Seleccione un taller</option>
                        <?php
                        $workshops_query = "SELECT WorkshopID, Name FROM Workshops";
                        $workshops_result = $conn->query($workshops_query);
                        while ($workshop = $workshops_result->fetch_assoc()) {
                            echo "<option value='" . $workshop['WorkshopID'] . "'>" . 
                                 htmlspecialchars($workshop['Name']) . "</option>";
                        }
                        ?>
                    </select>
                </div>
                <div>
                    <label for="vehicleId">Vehículo:</label>
                    <select name="vehicleId" id="vehicleId" required>
                        <option value="">Seleccione un vehículo</option>
                        <?php
                        $vehicles_query = "SELECT VehicleID, marca, modelo FROM Vehicles WHERE UserID = " . $_SESSION['user']['id'];
                        $vehicles_result = $conn->query($vehicles_query);
                        while ($vehicle = $vehicles_result->fetch_assoc()) {
                            echo "<option value='" . $vehicle['VehicleID'] . "'>" . 
                                 htmlspecialchars($vehicle['marca'] . " " . $vehicle['modelo']) . "</option>";
                        }
                        ?>
                    </select>
                </div>
                <div>
                    <label for="date">Fecha:</label>
                    <input type="date" id="date" name="date" required min="<?php echo date('Y-m-d'); ?>">
                </div>
                <div>
                    <label for="time">Hora:</label>
                    <select name="time" id="time" required>
                        <option value="">Seleccione una hora</option>
                        <?php
                        for ($hour = 9; $hour < 18; $hour++) {
                            $time = sprintf("%02d:00", $hour);
                            echo "<option value='$time'>$time</option>";
                        }
                        ?>
                    </select>
                </div>
                <div>
                    <label for="description">Descripción del servicio:</label>
                    <textarea id="description" name="description" rows="3"></textarea>
                </div>
                <button type="submit">Solicitar Cita</button>
            </form>
        </div>

        <style>
        .appointments-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        .appointments-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .appointment-card {
            border: 1px solid #ccc;
            padding: 15px;
            border-radius: 5px;
            background: white;
        }

        form {
            display: grid;
            gap: 15px;
            max-width: 500px;
            margin: 0 auto;
        }

        label {
            font-weight: bold;
        }

        select, input, textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }

        button {
            padding: 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        button:hover {
            background: #0056b3;
        }
        </style>

        <script>
        document.getElementById('appointmentForm')?.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = {
                accion: 'crear',
                WorkshopID: document.getElementById('workshopId').value,
                VehicleID: document.getElementById('vehicleId').value,
                Fecha: document.getElementById('date').value,
                Hora: document.getElementById('time').value,
                Descripcion: document.getElementById('description').value
            };

            fetch('appointments.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Cita creada correctamente');
                    window.location.reload();
                } else {
                    alert('Error: ' + data.message);
                }
            });
        });

        document.getElementById('workshopId')?.addEventListener('change', function() {
            const workshopId = this.value;
            if (!workshopId) return;

            fetch('appointments.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accion: 'consultar_semana',
                    WorkshopID: workshopId
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Actualizar disponibilidad de horarios
                    updateAvailableSlots(data.slotsSemana);
                }
            });
        });

        function updateAvailableSlots(slots) {
            const dateInput = document.getElementById('date');
            const timeSelect = document.getElementById('time');

            dateInput.addEventListener('change', function() {
                const selectedDate = this.value;
                const availableSlots = slots[selectedDate] || [];
                
                // Limpiar opciones actuales
                timeSelect.innerHTML = '<option value="">Seleccione una hora</option>';
                
                // Añadir slots disponibles
                for (let slot of availableSlots) {
                    if (slot.estado === 'Disponible') {
                        const option = document.createElement('option');
                        option.value = slot.hora;
                        option.textContent = slot.hora;
                        timeSelect.appendChild(option);
                    }
                }
            });
        }
        </script>
<?php
    }
} catch (Exception $e) {
    echo "<p>Error: " . $e->getMessage() . "</p>";
}
?>
