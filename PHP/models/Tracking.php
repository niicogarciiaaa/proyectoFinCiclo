<?php
/**
 * Modelo del seguimiento de la reparación paso a paso (llamada nueva).
 * Cada cambio de etapa se guarda como una entrada en AppointmentProgress,
 * de modo que el cliente ve la línea de tiempo completa con fechas y notas.
 */
class TrackingModel {
    private $conn;
    private static $tablaLista = false;

    /** Etapas permitidas, en orden (lista blanca). */
    public const ETAPAS = [
        'recibido'         => 'Vehículo recibido',
        'diagnostico'      => 'En diagnóstico',
        'esperando_piezas' => 'Esperando piezas',
        'reparacion'       => 'En reparación',
        'listo'            => 'Listo para recoger',
        'entregado'        => 'Entregado',
    ];

    public function __construct($db) {
        $this->conn = $db;
        $this->asegurarTabla();
    }

    /** Crea la tabla si todavía no existe (idempotente). */
    private function asegurarTabla() {
        if (self::$tablaLista) return;
        self::$tablaLista = true;
        try {
            $this->conn->query(
                "CREATE TABLE IF NOT EXISTS AppointmentProgress (
                    ProgressID     INT AUTO_INCREMENT PRIMARY KEY,
                    AppointmentID  INT NOT NULL,
                    WorkshopID     INT NOT NULL,
                    Stage          VARCHAR(30) NOT NULL,
                    Note           VARCHAR(500) NULL,
                    CreatedBy      INT NOT NULL,
                    CreatedAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_progress_appt (AppointmentID, ProgressID),
                    INDEX idx_progress_workshop (WorkshopID),
                    FOREIGN KEY (AppointmentID) REFERENCES Appointments(AppointmentID) ON DELETE CASCADE,
                    FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
                )"
            );
        } catch (Throwable $e) {
            Logger::error("Tracking: no se pudo crear AppointmentProgress: " . $e->getMessage());
        }
    }

    public function getWorkshopIdByUserId($userId) {
        $stmt = $this->conn->prepare("SELECT WorkshopID FROM Workshops WHERE UserID = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return $row ? (int)$row['WorkshopID'] : null;
    }

    public function getAppointment($appointmentId) {
        $stmt = $this->conn->prepare(
            "SELECT AppointmentID, UserID, WorkshopID, Status FROM Appointments WHERE AppointmentID = ?"
        );
        $stmt->bind_param("i", $appointmentId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc() ?: null;
    }

    /** Línea de tiempo completa de una cita, de la más antigua a la más reciente. */
    public function getHistory($appointmentId) {
        $stmt = $this->conn->prepare(
            "SELECT ProgressID, Stage, Note, CreatedAt
             FROM AppointmentProgress
             WHERE AppointmentID = ?
             ORDER BY ProgressID ASC"
        );
        $stmt->bind_param("i", $appointmentId);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = $this->formatear($row);
        }
        return $rows;
    }

    /**
     * Última etapa de cada cita: del taller ($campo = 'WorkshopID') o del
     * cliente ($campo = 'UserID').
     */
    public function getLatestStages($campo, $id) {
        $campo = $campo === 'UserID' ? 'a.UserID' : 'a.WorkshopID';
        $stmt = $this->conn->prepare(
            "SELECT p.AppointmentID, p.ProgressID, p.Stage, p.Note, p.CreatedAt
             FROM AppointmentProgress p
             JOIN Appointments a ON a.AppointmentID = p.AppointmentID
             WHERE $campo = ?
               AND p.ProgressID = (
                   SELECT MAX(p2.ProgressID) FROM AppointmentProgress p2
                   WHERE p2.AppointmentID = p.AppointmentID
               )"
        );
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $map = [];
        while ($row = $result->fetch_assoc()) {
            $map[(int)$row['AppointmentID']] = $this->formatear($row);
        }
        return $map;
    }

    public function add($appointmentId, $workshopId, $stage, $note, $userId) {
        $stmt = $this->conn->prepare(
            "INSERT INTO AppointmentProgress (AppointmentID, WorkshopID, Stage, Note, CreatedBy)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("iissi", $appointmentId, $workshopId, $stage, $note, $userId);
        return $stmt->execute();
    }

    /** Borra la última entrada de una cita (para corregir un error). */
    public function deleteLast($appointmentId, $workshopId) {
        $stmt = $this->conn->prepare(
            "DELETE FROM AppointmentProgress
             WHERE AppointmentID = ? AND WorkshopID = ?
             ORDER BY ProgressID DESC
             LIMIT 1"
        );
        $stmt->bind_param("ii", $appointmentId, $workshopId);
        $stmt->execute();
        return $stmt->affected_rows > 0;
    }

    private function formatear($row) {
        return [
            'ProgressID' => (int)$row['ProgressID'],
            'Stage'      => $row['Stage'],
            'StageLabel' => self::ETAPAS[$row['Stage']] ?? $row['Stage'],
            'Note'       => $row['Note'],
            'CreatedAt'  => $row['CreatedAt'],
        ];
    }
}
?>
