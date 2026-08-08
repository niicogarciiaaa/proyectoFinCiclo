<?php
/**
 * Modelo de la Agenda Inteligente.
 * Gestiona el horario semanal configurable de cada taller, su catálogo de
 * servicios (con duración) y las consultas necesarias para calcular la
 * disponibilidad real de citas teniendo en cuenta capacidad y solapamientos.
 */
class ScheduleModel {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    // ---------------------------------------------------------------
    //  HORARIO SEMANAL
    // ---------------------------------------------------------------

    /**
     * Devuelve las 7 filas de horario de un taller (1=Lunes ... 7=Domingo).
     * Si el taller todavía no tiene horario configurado, genera uno por
     * defecto en memoria (no lo persiste) para que la UI siempre tenga datos.
     */
    public function getSchedule($workshopId) {
        $query = "SELECT DayOfWeek, IsOpen, OpenTime, CloseTime, BreakStart, BreakEnd, Capacity, SlotMinutes
                  FROM WorkshopSchedules
                  WHERE WorkshopID = ?
                  ORDER BY DayOfWeek";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        $result = $stmt->get_result();

        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[(int)$row['DayOfWeek']] = $this->normalizeScheduleRow($row);
        }

        // Rellenar los días que falten con valores por defecto.
        $schedule = [];
        for ($d = 1; $d <= 7; $d++) {
            if (isset($rows[$d])) {
                $schedule[] = $rows[$d];
            } else {
                $schedule[] = [
                    'DayOfWeek'   => $d,
                    'IsOpen'      => $d <= 5,
                    'OpenTime'    => '09:00',
                    'CloseTime'   => '18:00',
                    'BreakStart'  => '14:00',
                    'BreakEnd'    => '15:00',
                    'Capacity'    => 1,
                    'SlotMinutes' => 30,
                ];
            }
        }
        return $schedule;
    }

    /** Devuelve solo la fila de horario de un día concreto (o null). */
    public function getScheduleForDay($workshopId, $dayOfWeek) {
        $query = "SELECT DayOfWeek, IsOpen, OpenTime, CloseTime, BreakStart, BreakEnd, Capacity, SlotMinutes
                  FROM WorkshopSchedules
                  WHERE WorkshopID = ? AND DayOfWeek = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("ii", $workshopId, $dayOfWeek);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return $row ? $this->normalizeScheduleRow($row) : null;
    }

    /** Inserta o actualiza la fila de horario de un día (upsert). */
    public function upsertScheduleDay($workshopId, $day) {
        $query = "INSERT INTO WorkshopSchedules
                    (WorkshopID, DayOfWeek, IsOpen, OpenTime, CloseTime, BreakStart, BreakEnd, Capacity, SlotMinutes)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE
                    IsOpen = VALUES(IsOpen),
                    OpenTime = VALUES(OpenTime),
                    CloseTime = VALUES(CloseTime),
                    BreakStart = VALUES(BreakStart),
                    BreakEnd = VALUES(BreakEnd),
                    Capacity = VALUES(Capacity),
                    SlotMinutes = VALUES(SlotMinutes)";

        $dayOfWeek   = (int)$day['DayOfWeek'];
        $isOpen      = !empty($day['IsOpen']) ? 1 : 0;
        $openTime    = $this->toSqlTime($day['OpenTime'] ?? '09:00');
        $closeTime   = $this->toSqlTime($day['CloseTime'] ?? '18:00');
        $breakStart  = !empty($day['BreakStart']) ? $this->toSqlTime($day['BreakStart']) : null;
        $breakEnd    = !empty($day['BreakEnd']) ? $this->toSqlTime($day['BreakEnd']) : null;
        $capacity    = max(1, (int)($day['Capacity'] ?? 1));
        $slotMinutes = max(5, (int)($day['SlotMinutes'] ?? 30));

        $stmt = $this->conn->prepare($query);
        $stmt->bind_param(
            "iiissssii",
            $workshopId, $dayOfWeek, $isOpen, $openTime, $closeTime,
            $breakStart, $breakEnd, $capacity, $slotMinutes
        );
        return $stmt->execute();
    }

    // ---------------------------------------------------------------
    //  SERVICIOS
    // ---------------------------------------------------------------

    /**
     * Lista los servicios de un taller.
     * @param bool $onlyActive  si es true, solo los servicios activos.
     */
    public function getServices($workshopId, $onlyActive = false) {
        $query = "SELECT ServiceID, WorkshopID, Name, DurationMinutes, Price, IsActive
                  FROM WorkshopServices
                  WHERE WorkshopID = ?";
        if ($onlyActive) {
            $query .= " AND IsActive = 1";
        }
        $query .= " ORDER BY Name";

        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        $result = $stmt->get_result();

        $services = [];
        while ($row = $result->fetch_assoc()) {
            $row['ServiceID']       = (int)$row['ServiceID'];
            $row['WorkshopID']      = (int)$row['WorkshopID'];
            $row['DurationMinutes'] = (int)$row['DurationMinutes'];
            $row['Price']           = $row['Price'] !== null ? (float)$row['Price'] : null;
            $row['IsActive']        = (bool)$row['IsActive'];
            $services[] = $row;
        }
        return $services;
    }

    /** Devuelve un servicio por su ID (o null). */
    public function getServiceById($serviceId) {
        $query = "SELECT ServiceID, WorkshopID, Name, DurationMinutes, Price, IsActive
                  FROM WorkshopServices WHERE ServiceID = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $serviceId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc() ?: null;
    }

    public function createService($workshopId, $name, $durationMinutes, $price, $isActive) {
        $query = "INSERT INTO WorkshopServices (WorkshopID, Name, DurationMinutes, Price, IsActive)
                  VALUES (?, ?, ?, ?, ?)";
        $name     = htmlspecialchars(strip_tags($name));
        $duration = max(5, (int)$durationMinutes);
        $active   = $isActive ? 1 : 0;
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("isidi", $workshopId, $name, $duration, $price, $active);
        if ($stmt->execute()) {
            return $stmt->insert_id;
        }
        return false;
    }

    public function updateService($serviceId, $workshopId, $name, $durationMinutes, $price, $isActive) {
        $query = "UPDATE WorkshopServices
                  SET Name = ?, DurationMinutes = ?, Price = ?, IsActive = ?
                  WHERE ServiceID = ? AND WorkshopID = ?";
        $name     = htmlspecialchars(strip_tags($name));
        $duration = max(5, (int)$durationMinutes);
        $active   = $isActive ? 1 : 0;
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("sidiii", $name, $duration, $price, $active, $serviceId, $workshopId);
        return $stmt->execute();
    }

    public function deleteService($serviceId, $workshopId) {
        $query = "DELETE FROM WorkshopServices WHERE ServiceID = ? AND WorkshopID = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("ii", $serviceId, $workshopId);
        return $stmt->execute();
    }

    // ---------------------------------------------------------------
    //  DISPONIBILIDAD
    // ---------------------------------------------------------------

    /**
     * Devuelve las citas (no canceladas) de un taller dentro de un rango de
     * fechas como pares [inicio, fin] en formato timestamp, para poder
     * calcular solapamientos en PHP.
     */
    public function getAppointmentsInRange($workshopId, $startDate, $endDate) {
        $query = "SELECT StartDateTime, EndDateTime
                  FROM Appointments
                  WHERE WorkshopID = ?
                    AND Status <> 'Cancelada'
                    AND DATE(StartDateTime) BETWEEN ? AND ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("iss", $workshopId, $startDate, $endDate);
        $stmt->execute();
        $result = $stmt->get_result();

        $appointments = [];
        while ($row = $result->fetch_assoc()) {
            $appointments[] = [
                'start' => strtotime($row['StartDateTime']),
                'end'   => strtotime($row['EndDateTime']),
            ];
        }
        return $appointments;
    }

    /**
     * Cuenta cuántas citas (no canceladas) se solapan con el intervalo dado.
     * Dos intervalos [a1,a2) y [b1,b2) se solapan si a1 < b2 y b1 < a2.
     * Se usa para validar la capacidad de forma atómica al reservar.
     */
    public function countOverlapping($workshopId, $startDateTime, $endDateTime) {
        $query = "SELECT COUNT(*) AS total
                  FROM Appointments
                  WHERE WorkshopID = ?
                    AND Status <> 'Cancelada'
                    AND StartDateTime < ?
                    AND EndDateTime > ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("iss", $workshopId, $endDateTime, $startDateTime);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return (int)$row['total'];
    }

    // ---------------------------------------------------------------
    //  CITAS (operaciones propias de la Agenda Inteligente)
    //  Estas llamadas son nuevas; no tocan el modelo/endpoint de citas
    //  original (AppointmentModel / appointments.php).
    // ---------------------------------------------------------------

    /** Comprueba que un vehículo pertenece al usuario indicado (autorización). */
    public function vehicleBelongsToUser($vehicleId, $userId) {
        $stmt = $this->conn->prepare("SELECT VehicleID FROM Vehicles WHERE VehicleID = ? AND UserID = ?");
        $stmt->bind_param("ii", $vehicleId, $userId);
        $stmt->execute();
        return $stmt->get_result()->num_rows > 0;
    }

    /** Devuelve el WorkshopID asociado al UserID de un taller (o null). */
    public function getWorkshopIdByUserId($userId) {
        $stmt = $this->conn->prepare("SELECT WorkshopID FROM Workshops WHERE UserID = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return $row ? (int)$row['WorkshopID'] : null;
    }

    /** Inserta una cita con servicio y duración (rejilla de la agenda). */
    public function createAppointment($userId, $vehicleId, $workshopId, $serviceId,
                                      $serviceName, $start, $end, $description, $status) {
        $query = "INSERT INTO Appointments
                    (UserID, VehicleID, WorkshopID, ServiceID, Service, StartDateTime, EndDateTime, Description, Status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $serviceName = htmlspecialchars(strip_tags($serviceName ?? ''));
        $description = htmlspecialchars(strip_tags($description ?? ''));
        $status = htmlspecialchars(strip_tags($status ?? 'Pendiente'));
        $sid = $serviceId !== null ? (int)$serviceId : null;

        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("iiiisssss",
            $userId, $vehicleId, $workshopId, $sid, $serviceName,
            $start, $end, $description, $status
        );
        return $stmt->execute();
    }

    /** Devuelve una cita con su WorkshopID y UserID propietario (validar permisos). */
    public function getAppointmentOwner($appointmentId) {
        $stmt = $this->conn->prepare(
            "SELECT AppointmentID, UserID, WorkshopID FROM Appointments WHERE AppointmentID = ?"
        );
        $stmt->bind_param("i", $appointmentId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc();
    }

    /** Actualiza el estado de una cita. */
    public function updateAppointmentStatus($appointmentId, $status) {
        $stmt = $this->conn->prepare("UPDATE Appointments SET Status = ? WHERE AppointmentID = ?");
        $stmt->bind_param("si", $status, $appointmentId);
        return $stmt->execute();
    }

    /** Citas de un cliente con datos de taller, vehículo y servicio. */
    public function getUserAppointments($userId) {
        $query = "SELECT
                    a.AppointmentID, a.StartDateTime, a.EndDateTime, a.Service, a.Status, a.Description,
                    CONCAT(v.Marca, ' ', v.Modelo) AS Vehiculo,
                    w.Name AS WorkshopName, w.Address AS WorkshopAddress, w.Phone AS WorkshopPhone,
                    (SELECT i.InvoiceID FROM Invoices i WHERE i.AppointmentID = a.AppointmentID
                     ORDER BY i.InvoiceID DESC LIMIT 1) AS InvoiceID
                  FROM Appointments a
                  JOIN Vehicles v ON a.VehicleID = v.VehicleID
                  JOIN Workshops w ON a.WorkshopID = w.WorkshopID
                  WHERE a.UserID = ?
                  ORDER BY a.StartDateTime DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        return $stmt->get_result();
    }

    /** Citas de un taller incluyendo el servicio (para la agenda y el generador de facturas). */
    public function getWorkshopAppointmentsWithService($workshopId) {
        $query = "SELECT
                    a.AppointmentID, a.StartDateTime, a.EndDateTime,
                    CONCAT(v.Marca, ' ', v.Modelo) AS Vehiculo,
                    a.ServiceID, a.Service, a.Description, a.Status,
                    u.FullName AS UserName,
                    (SELECT i.InvoiceID FROM Invoices i WHERE i.AppointmentID = a.AppointmentID
                     ORDER BY i.InvoiceID DESC LIMIT 1) AS InvoiceID
                  FROM Appointments a
                  JOIN Vehicles v ON a.VehicleID = v.VehicleID
                  JOIN Users u ON v.UserID = u.UserID
                  WHERE a.WorkshopID = ?
                  ORDER BY a.StartDateTime DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        return $stmt->get_result();
    }

    // ---------------------------------------------------------------
    //  Helpers privados
    // ---------------------------------------------------------------

    private function normalizeScheduleRow($row) {
        return [
            'DayOfWeek'   => (int)$row['DayOfWeek'],
            'IsOpen'      => (bool)$row['IsOpen'],
            'OpenTime'    => substr($row['OpenTime'], 0, 5),
            'CloseTime'   => substr($row['CloseTime'], 0, 5),
            'BreakStart'  => $row['BreakStart'] ? substr($row['BreakStart'], 0, 5) : null,
            'BreakEnd'    => $row['BreakEnd'] ? substr($row['BreakEnd'], 0, 5) : null,
            'Capacity'    => (int)$row['Capacity'],
            'SlotMinutes' => (int)$row['SlotMinutes'],
        ];
    }

    /** Normaliza "HH:MM" o "HH:MM:SS" a "HH:MM:SS" para la BD. */
    private function toSqlTime($value) {
        $value = trim((string)$value);
        if (preg_match('/^\d{1,2}:\d{2}$/', $value)) {
            return $value . ':00';
        }
        if (preg_match('/^\d{1,2}:\d{2}:\d{2}$/', $value)) {
            return $value;
        }
        return '09:00:00';
    }
}
?>
