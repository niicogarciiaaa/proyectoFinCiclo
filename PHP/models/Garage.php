<?php
require_once __DIR__ . '/../config/SchemaUpgrade.php';

/**
 * Modelo del «Taller en 3D».
 * Guarda la distribución personalizable del taller (puestos, elevadores,
 * colores), qué coche (cita) ocupa cada puesto y las notas del taller
 * sobre cada vehículo. Solo lectura sobre las tablas originales.
 */
class GarageModel {
    private $conn;

    /** Tipos de puesto admitidos en la distribución. */
    public const TIPOS = ['elevador2', 'elevador4', 'foso', 'plaza', 'lavado'];

    public function __construct($db) {
        $this->conn = $db;
        SchemaUpgrade::ensure($db);
    }

    public function getWorkshop($userId) {
        $stmt = $this->conn->prepare("SELECT WorkshopID, Name FROM Workshops WHERE UserID = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc() ?: null;
    }

    // ---------------------------------------------------------------
    //  DISTRIBUCIÓN
    // ---------------------------------------------------------------

    /** Devuelve la distribución guardada (array) o null si no hay. */
    public function getLayout($workshopId) {
        $stmt = $this->conn->prepare("SELECT LayoutJSON FROM WorkshopLayouts WHERE WorkshopID = ?");
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            return null;
        }
        $layout = json_decode($row['LayoutJSON'], true);
        return is_array($layout) ? $layout : null;
    }

    public function saveLayout($workshopId, $layout) {
        $json = json_encode($layout, JSON_UNESCAPED_UNICODE);
        $stmt = $this->conn->prepare(
            "INSERT INTO WorkshopLayouts (WorkshopID, LayoutJSON) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE LayoutJSON = VALUES(LayoutJSON)"
        );
        $stmt->bind_param("is", $workshopId, $json);
        return $stmt->execute();
    }

    /** Distribución inicial: 4 elevadores, un foso, una zona de lavado y 2 plazas. */
    public static function defaultLayout($nombreTaller) {
        $puestos = [];
        for ($i = 0; $i < 4; $i++) {
            $puestos[] = [
                'key' => 'elev' . ($i + 1), 'tipo' => 'elevador2', 'etiqueta' => 'Elevador ' . ($i + 1),
                'x' => -9 + $i * 5, 'z' => -3.5, 'rot' => 0,
            ];
        }
        $puestos[] = ['key' => 'foso1', 'tipo' => 'foso', 'etiqueta' => 'Foso', 'x' => 9, 'z' => -3.5, 'rot' => 0];
        $puestos[] = ['key' => 'lavado1', 'tipo' => 'lavado', 'etiqueta' => 'Lavado', 'x' => -8, 'z' => 4.5, 'rot' => 90];
        $puestos[] = ['key' => 'plaza1', 'tipo' => 'plaza', 'etiqueta' => 'Espera 1', 'x' => 2, 'z' => 4.5, 'rot' => 90];
        $puestos[] = ['key' => 'plaza2', 'tipo' => 'plaza', 'etiqueta' => 'Espera 2', 'x' => 5.5, 'z' => 4.5, 'rot' => 90];

        return [
            'version'         => 1,
            'nombre'          => $nombreTaller,
            'ancho'           => 26,
            'fondo'           => 16,
            'colorSuelo'      => '#9e9e9e',
            'colorParedes'    => '#eceff1',
            'colorElevadores' => '#fb8c00',
            'colorLineas'     => '#fdd835',
            'puestos'         => $puestos,
        ];
    }

    // ---------------------------------------------------------------
    //  COCHES EN EL TALLER
    // ---------------------------------------------------------------

    /** Cita del taller (o null si no es de este taller). */
    public function getWorkshopAppointment($appointmentId, $workshopId) {
        $stmt = $this->conn->prepare(
            "SELECT AppointmentID, VehicleID, Status FROM Appointments WHERE AppointmentID = ? AND WorkshopID = ?"
        );
        $stmt->bind_param("ii", $appointmentId, $workshopId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc() ?: null;
    }

    /** Coches colocados en puestos, con los datos de su cita y vehículo. */
    public function getAssignments($workshopId) {
        $stmt = $this->conn->prepare(
            "SELECT b.AppointmentID, b.BayKey, b.CarColor, b.Lifted,
                    a.StartDateTime, a.EndDateTime, a.Service, a.Status,
                    v.VehicleID, v.Marca, v.Modelo, v.Anyo, v.Matricula,
                    u.FullName AS UserName
             FROM WorkshopBayAssignments b
             JOIN Appointments a ON a.AppointmentID = b.AppointmentID
             JOIN Vehicles v ON v.VehicleID = a.VehicleID
             JOIN Users u ON u.UserID = a.UserID
             WHERE b.WorkshopID = ?
             ORDER BY b.BayKey"
        );
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['AppointmentID'] = (int)$row['AppointmentID'];
            $row['VehicleID']     = (int)$row['VehicleID'];
            $row['Lifted']        = (bool)$row['Lifted'];
            $rows[] = $row;
        }
        return $rows;
    }

    /**
     * Citas activas de una fecha que todavía no están en ningún puesto
     * (los coches que "están por llegar" o esperando).
     */
    public function getPendingCars($workshopId, $date) {
        $stmt = $this->conn->prepare(
            "SELECT a.AppointmentID, a.StartDateTime, a.EndDateTime, a.Service, a.Status,
                    v.VehicleID, v.Marca, v.Modelo, v.Anyo, v.Matricula,
                    u.FullName AS UserName
             FROM Appointments a
             JOIN Vehicles v ON v.VehicleID = a.VehicleID
             JOIN Users u ON u.UserID = a.UserID
             LEFT JOIN WorkshopBayAssignments b ON b.AppointmentID = a.AppointmentID
             WHERE a.WorkshopID = ?
               AND DATE(a.StartDateTime) = ?
               AND a.Status IN ('Pendiente', 'Confirmada')
               AND b.AssignmentID IS NULL
             ORDER BY a.StartDateTime"
        );
        $stmt->bind_param("is", $workshopId, $date);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['AppointmentID'] = (int)$row['AppointmentID'];
            $row['VehicleID']     = (int)$row['VehicleID'];
            $rows[] = $row;
        }
        return $rows;
    }

    /** Cita que ocupa un puesto (o null si está libre). */
    public function getBayOccupant($workshopId, $bayKey) {
        $stmt = $this->conn->prepare(
            "SELECT AppointmentID FROM WorkshopBayAssignments WHERE WorkshopID = ? AND BayKey = ?"
        );
        $stmt->bind_param("is", $workshopId, $bayKey);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return $row ? (int)$row['AppointmentID'] : null;
    }

    /** Coloca un coche en un puesto (o lo mueve si ya estaba en otro). */
    public function assign($workshopId, $appointmentId, $bayKey, $color) {
        $stmt = $this->conn->prepare(
            "INSERT INTO WorkshopBayAssignments (WorkshopID, BayKey, AppointmentID, CarColor, Lifted)
             VALUES (?, ?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE BayKey = VALUES(BayKey), Lifted = 0"
        );
        $stmt->bind_param("isis", $workshopId, $bayKey, $appointmentId, $color);
        return $stmt->execute();
    }

    public function updateCar($workshopId, $appointmentId, $color, $lifted) {
        $stmt = $this->conn->prepare(
            "UPDATE WorkshopBayAssignments SET CarColor = ?, Lifted = ? WHERE WorkshopID = ? AND AppointmentID = ?"
        );
        $stmt->bind_param("siii", $color, $lifted, $workshopId, $appointmentId);
        $stmt->execute();
        return $stmt->affected_rows >= 0;
    }

    public function getAssignment($workshopId, $appointmentId) {
        $stmt = $this->conn->prepare(
            "SELECT BayKey, CarColor, Lifted FROM WorkshopBayAssignments WHERE WorkshopID = ? AND AppointmentID = ?"
        );
        $stmt->bind_param("ii", $workshopId, $appointmentId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc() ?: null;
    }

    public function unassign($workshopId, $appointmentId) {
        $stmt = $this->conn->prepare(
            "DELETE FROM WorkshopBayAssignments WHERE WorkshopID = ? AND AppointmentID = ?"
        );
        $stmt->bind_param("ii", $workshopId, $appointmentId);
        $stmt->execute();
        return $stmt->affected_rows > 0;
    }

    /** Quita de los puestos los coches cuyos puestos ya no existen en la distribución. */
    public function removeAssignmentsNotIn($workshopId, $bayKeys) {
        $actuales = $this->getAssignments($workshopId);
        foreach ($actuales as $a) {
            if (!in_array($a['BayKey'], $bayKeys, true)) {
                $this->unassign($workshopId, $a['AppointmentID']);
            }
        }
    }

    // ---------------------------------------------------------------
    //  FICHA DEL COCHE Y NOTAS
    // ---------------------------------------------------------------

    /** Datos completos de la cita, el vehículo y el cliente. */
    public function getCarDetail($appointmentId, $workshopId) {
        $stmt = $this->conn->prepare(
            "SELECT a.AppointmentID, a.StartDateTime, a.EndDateTime, a.Service, a.Status, a.Description,
                    v.VehicleID, v.Marca, v.Modelo, v.Anyo, v.Matricula,
                    u.FullName AS UserName, u.Email AS UserEmail,
                    (SELECT i.InvoiceID FROM Invoices i WHERE i.AppointmentID = a.AppointmentID
                     ORDER BY i.InvoiceID DESC LIMIT 1) AS InvoiceID
             FROM Appointments a
             JOIN Vehicles v ON v.VehicleID = a.VehicleID
             JOIN Users u ON u.UserID = a.UserID
             WHERE a.AppointmentID = ? AND a.WorkshopID = ?"
        );
        $stmt->bind_param("ii", $appointmentId, $workshopId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            return null;
        }
        $row['AppointmentID'] = (int)$row['AppointmentID'];
        $row['VehicleID']     = (int)$row['VehicleID'];
        return $row;
    }

    /** Visitas anteriores de ese vehículo a este taller (más recientes primero). */
    public function getVehicleVisits($vehicleId, $workshopId, $excludeAppointmentId) {
        $stmt = $this->conn->prepare(
            "SELECT AppointmentID, StartDateTime, Service, Status
             FROM Appointments
             WHERE VehicleID = ? AND WorkshopID = ? AND AppointmentID <> ?
               AND Status <> 'Cancelada'
             ORDER BY StartDateTime DESC
             LIMIT 10"
        );
        $stmt->bind_param("iii", $vehicleId, $workshopId, $excludeAppointmentId);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }
        return $rows;
    }

    /** Notas del taller sobre un vehículo (de todas sus visitas). */
    public function getNotes($vehicleId, $workshopId) {
        $stmt = $this->conn->prepare(
            "SELECT n.NoteID, n.AppointmentID, n.Note, n.CreatedAt
             FROM VehicleNotes n
             WHERE n.VehicleID = ? AND n.WorkshopID = ?
             ORDER BY n.CreatedAt DESC, n.NoteID DESC"
        );
        $stmt->bind_param("ii", $vehicleId, $workshopId);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['NoteID'] = (int)$row['NoteID'];
            $rows[] = $row;
        }
        return $rows;
    }

    public function addNote($workshopId, $vehicleId, $appointmentId, $authorId, $note) {
        $note = htmlspecialchars(strip_tags((string)$note));
        $stmt = $this->conn->prepare(
            "INSERT INTO VehicleNotes (WorkshopID, VehicleID, AppointmentID, AuthorUserID, Note)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("iiiis", $workshopId, $vehicleId, $appointmentId, $authorId, $note);
        if ($stmt->execute()) {
            return $stmt->insert_id;
        }
        return false;
    }

    public function deleteNote($noteId, $workshopId) {
        $stmt = $this->conn->prepare("DELETE FROM VehicleNotes WHERE NoteID = ? AND WorkshopID = ?");
        $stmt->bind_param("ii", $noteId, $workshopId);
        $stmt->execute();
        return $stmt->affected_rows > 0;
    }
}
?>
