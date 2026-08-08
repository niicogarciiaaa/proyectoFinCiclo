<?php
require_once __DIR__ . '/../models/Schedule.php';

/**
 * Controlador de la Agenda Inteligente.
 *
 * Responsabilidades:
 *  - Configuración del horario semanal del taller (solo rol Taller).
 *  - Gestión del catálogo de servicios del taller (solo rol Taller).
 *  - Cálculo de la disponibilidad real de citas para los usuarios, teniendo
 *    en cuenta horario, descansos, capacidad (bahías) y solapamientos.
 */
class ScheduleController {
    private $model;
    private $conn;
    private $userId;
    private $userRole;

    public function __construct($db, $userId, $userRole) {
        $this->model    = new ScheduleModel($db);
        $this->conn     = $db;
        $this->userId   = $userId;
        $this->userRole = $userRole;
    }

    // ===============================================================
    //  CONFIGURACIÓN DEL HORARIO (rol Taller)
    // ===============================================================

    /** Devuelve el horario semanal y los servicios del taller del usuario. */
    public function obtenerConfig() {
        $workshopId = $this->requireOwnWorkshop();
        if ($workshopId === null) return;

        $schedule = $this->model->getSchedule($workshopId);
        $services = $this->model->getServices($workshopId, false);

        $this->sendResponse(200, true, "", [
            'workshopId' => $workshopId,
            'schedule'   => $schedule,
            'services'   => $services,
        ]);
    }

    /** Guarda (upsert) el horario semanal completo del taller. */
    public function guardarConfig($data) {
        $workshopId = $this->requireOwnWorkshop();
        if ($workshopId === null) return;

        if (!isset($data['schedule']) || !is_array($data['schedule'])) {
            return $this->sendResponse(400, false, "Falta el horario a guardar");
        }

        foreach ($data['schedule'] as $day) {
            if (!isset($day['DayOfWeek'])) continue;
            // Validaciones básicas de coherencia horaria.
            if (!empty($day['IsOpen']) && $day['OpenTime'] >= $day['CloseTime']) {
                return $this->sendResponse(
                    400, false,
                    "La hora de apertura debe ser anterior a la de cierre (día " . $day['DayOfWeek'] . ")"
                );
            }
            if (!$this->model->upsertScheduleDay($workshopId, $day)) {
                return $this->sendResponse(500, false, "Error al guardar el horario");
            }
        }

        $this->sendResponse(200, true, "Horario guardado correctamente", [
            'schedule' => $this->model->getSchedule($workshopId),
        ]);
    }

    // ===============================================================
    //  SERVICIOS (rol Taller para crear/editar/borrar)
    // ===============================================================

    public function crearServicio($data) {
        $workshopId = $this->requireOwnWorkshop();
        if ($workshopId === null) return;

        if (empty($data['Name'])) {
            return $this->sendResponse(400, false, "El nombre del servicio es obligatorio");
        }

        $id = $this->model->createService(
            $workshopId,
            $data['Name'],
            $data['DurationMinutes'] ?? 60,
            isset($data['Price']) && $data['Price'] !== '' ? (float)$data['Price'] : null,
            isset($data['IsActive']) ? (bool)$data['IsActive'] : true
        );

        if ($id === false) {
            return $this->sendResponse(500, false, "Error al crear el servicio");
        }
        $this->sendResponse(200, true, "Servicio creado correctamente", ['serviceId' => $id]);
    }

    public function actualizarServicio($data) {
        $workshopId = $this->requireOwnWorkshop();
        if ($workshopId === null) return;

        if (empty($data['ServiceID'])) {
            return $this->sendResponse(400, false, "Falta el ID del servicio");
        }
        if (!$this->serviceBelongsToWorkshop($data['ServiceID'], $workshopId)) {
            return $this->sendResponse(403, false, "Ese servicio no pertenece a tu taller");
        }

        $ok = $this->model->updateService(
            (int)$data['ServiceID'],
            $workshopId,
            $data['Name'] ?? '',
            $data['DurationMinutes'] ?? 60,
            isset($data['Price']) && $data['Price'] !== '' ? (float)$data['Price'] : null,
            isset($data['IsActive']) ? (bool)$data['IsActive'] : true
        );

        if (!$ok) {
            return $this->sendResponse(500, false, "Error al actualizar el servicio");
        }
        $this->sendResponse(200, true, "Servicio actualizado correctamente");
    }

    public function eliminarServicio($data) {
        $workshopId = $this->requireOwnWorkshop();
        if ($workshopId === null) return;

        if (empty($data['ServiceID'])) {
            return $this->sendResponse(400, false, "Falta el ID del servicio");
        }
        if (!$this->serviceBelongsToWorkshop($data['ServiceID'], $workshopId)) {
            return $this->sendResponse(403, false, "Ese servicio no pertenece a tu taller");
        }

        if (!$this->model->deleteService((int)$data['ServiceID'], $workshopId)) {
            return $this->sendResponse(500, false, "Error al eliminar el servicio");
        }
        $this->sendResponse(200, true, "Servicio eliminado correctamente");
    }

    /** Lista pública (para usuarios) de servicios activos de un taller concreto. */
    public function listarServicios($data) {
        if (empty($data['WorkshopID'])) {
            return $this->sendResponse(400, false, "Falta el ID del taller");
        }
        $services = $this->model->getServices((int)$data['WorkshopID'], true);
        $this->sendResponse(200, true, "", ['services' => $services]);
    }

    // ===============================================================
    //  DISPONIBILIDAD
    // ===============================================================

    /**
     * Calcula los huecos reales disponibles para un taller y un servicio
     * (o una duración) en un rango de fechas.
     */
    public function disponibilidad($data) {
        if (empty($data['WorkshopID'])) {
            return $this->sendResponse(400, false, "Falta el ID del taller");
        }
        $workshopId = (int)$data['WorkshopID'];

        // Determinar la duración del servicio elegido.
        $duration = 60;
        if (!empty($data['ServiceID'])) {
            $service = $this->model->getServiceById((int)$data['ServiceID']);
            if (!$service) {
                return $this->sendResponse(404, false, "Servicio no encontrado");
            }
            $duration = (int)$service['DurationMinutes'];
        } elseif (!empty($data['DurationMinutes'])) {
            $duration = max(5, (int)$data['DurationMinutes']);
        }

        // Rango de fechas (por defecto: hoy + 30 días).
        $startDate = !empty($data['FechaInicio'])
            ? $data['FechaInicio']
            : (new DateTime())->format('Y-m-d');
        $endDate = !empty($data['FechaFin'])
            ? $data['FechaFin']
            : (new DateTime($startDate))->modify('+30 days')->format('Y-m-d');

        $schedule     = $this->indexScheduleByDay($this->model->getSchedule($workshopId));
        $appointments = $this->model->getAppointmentsInRange($workshopId, $startDate, $endDate);

        $availability = $this->buildAvailability($schedule, $appointments, $duration, $startDate, $endDate);

        $this->sendResponse(200, true, "", [
            'duration'     => $duration,
            'availability' => $availability,
        ]);
    }

    /**
     * Genera, día a día, la lista de slots con su estado (Disponible/Ocupada)
     * y la capacidad restante.
     */
    private function buildAvailability($schedule, $appointments, $duration, $startDate, $endDate) {
        $now = time();
        $result = [];

        $period = new DatePeriod(
            new DateTime($startDate),
            new DateInterval('P1D'),
            (new DateTime($endDate))->modify('+1 day')
        );

        foreach ($period as $dateObj) {
            $dow      = (int)$dateObj->format('N');   // 1=Lun ... 7=Dom
            $dateStr  = $dateObj->format('Y-m-d');
            $cfg      = $schedule[$dow] ?? null;

            if (!$cfg || !$cfg['IsOpen']) {
                continue; // taller cerrado ese día
            }

            $slots = $this->buildDaySlots($cfg, $appointments, $duration, $dateStr, $now);
            if (!empty($slots)) {
                $result[$dateStr] = $slots;
            }
        }
        return $result;
    }

    /** Construye los slots de un único día según su configuración. */
    private function buildDaySlots($cfg, $appointments, $duration, $dateStr, $now) {
        $slotStep   = $cfg['SlotMinutes'] * 60;
        $durationS  = $duration * 60;
        $capacity   = max(1, $cfg['Capacity']);

        $dayOpen    = strtotime($dateStr . ' ' . $cfg['OpenTime']);
        $dayClose   = strtotime($dateStr . ' ' . $cfg['CloseTime']);
        $breakStart = $cfg['BreakStart'] ? strtotime($dateStr . ' ' . $cfg['BreakStart']) : null;
        $breakEnd   = $cfg['BreakEnd'] ? strtotime($dateStr . ' ' . $cfg['BreakEnd']) : null;

        $slots = [];
        for ($t = $dayOpen; $t + $durationS <= $dayClose; $t += $slotStep) {
            $slotStart = $t;
            $slotEnd   = $t + $durationS;

            // Descartar si pisa el descanso.
            if ($breakStart !== null && $breakEnd !== null
                && $slotStart < $breakEnd && $slotEnd > $breakStart) {
                continue;
            }

            $hora = date('H:i', $slotStart);

            // Slot pasado respecto a ahora.
            if ($slotStart < $now) {
                $slots[] = ['hora' => $hora, 'estado' => 'Pasada', 'restantes' => 0];
                continue;
            }

            // Contar solapamientos con citas existentes para respetar capacidad.
            $ocupadas = 0;
            foreach ($appointments as $appt) {
                if ($appt['start'] < $slotEnd && $appt['end'] > $slotStart) {
                    $ocupadas++;
                }
            }

            $restantes = $capacity - $ocupadas;
            $slots[] = [
                'hora'      => $hora,
                'estado'    => $restantes > 0 ? 'Disponible' : 'Ocupada',
                'restantes' => max(0, $restantes),
            ];
        }
        return $slots;
    }

    // ===============================================================
    //  CITAS (llamadas NUEVAS de la Agenda Inteligente)
    //  No modifican el endpoint de citas original (appointments.php).
    // ===============================================================

    /**
     * (Usuario) Crea una cita respetando horario, descanso, duración del
     * servicio y capacidad del taller, de forma atómica (sin dobles reservas).
     */
    public function crearCita($data) {
        try {
            foreach (['Fecha', 'Hora', 'VehicleID', 'WorkshopID'] as $campo) {
                if (!isset($data[$campo])) {
                    return $this->sendResponse(400, false, "Falta el campo: $campo");
                }
            }
            if (DateTime::createFromFormat('Y-m-d', $data['Fecha']) === false ||
                DateTime::createFromFormat('H:i', $data['Hora']) === false) {
                return $this->sendResponse(400, false, "Formato de fecha u hora inválido");
            }

            $workshopId  = (int)$data['WorkshopID'];
            $descripcion = $data['Descripcion'] ?? '';

            // Seguridad: el vehículo debe pertenecer al usuario autenticado.
            if (!$this->model->vehicleBelongsToUser((int)$data['VehicleID'], (int)$this->userId)) {
                return $this->sendResponse(403, false, "El vehículo no pertenece a tu cuenta");
            }

            // Resolver servicio y duración real.
            $serviceId = !empty($data['ServiceID']) ? (int)$data['ServiceID'] : null;
            $serviceName = '';
            $duration = 60;
            if ($serviceId !== null) {
                $service = $this->model->getServiceById($serviceId);
                if (!$service || (int)$service['WorkshopID'] !== $workshopId) {
                    return $this->sendResponse(400, false, "El servicio seleccionado no es válido para este taller");
                }
                $serviceName = $service['Name'];
                $duration = (int)$service['DurationMinutes'];
            } elseif (!empty($data['DurationMinutes'])) {
                $duration = max(5, (int)$data['DurationMinutes']);
            }

            $startDateTime = $data['Fecha'] . ' ' . $data['Hora'] . ':00';
            $endDateTime   = date('Y-m-d H:i:s', strtotime($startDateTime) + $duration * 60);

            if (strtotime($startDateTime) < time()) {
                return $this->sendResponse(400, false, "No se puede reservar una cita en el pasado");
            }

            // Validar contra el horario configurado del taller.
            $dayOfWeek = (int)date('N', strtotime($data['Fecha']));
            $cfg = $this->model->getScheduleForDay($workshopId, $dayOfWeek);
            $capacity = 1;
            if ($cfg !== null) {
                $err = $this->validarContraHorario($cfg, $data['Fecha'], $startDateTime, $endDateTime);
                if ($err !== null) {
                    return $this->sendResponse(409, false, $err);
                }
                $capacity = max(1, (int)$cfg['Capacity']);
            }

            // Reserva atómica con control de capacidad/solapamiento.
            $this->conn->begin_transaction();
            try {
                $ocupadas = $this->model->countOverlapping($workshopId, $startDateTime, $endDateTime);
                if ($ocupadas >= $capacity) {
                    $this->conn->rollback();
                    return $this->sendResponse(409, false, "Ese horario ya está completo. Elige otro hueco.");
                }
                // Seguridad: una cita nueva siempre nace 'Pendiente'
                // (no se confía en un Status enviado por el cliente).
                $ok = $this->model->createAppointment(
                    (int)$this->userId, (int)$data['VehicleID'], $workshopId, $serviceId,
                    $serviceName !== '' ? $serviceName : ($descripcion ?: 'Cita'),
                    $startDateTime, $endDateTime, $descripcion, 'Pendiente'
                );
                if (!$ok) {
                    $this->conn->rollback();
                    return $this->sendResponse(500, false, "Error al crear la cita");
                }
                $this->conn->commit();
                return $this->sendResponse(200, true, "Cita creada correctamente");
            } catch (Exception $e) {
                $this->conn->rollback();
                throw $e;
            }
        } catch (Exception $e) {
            return $this->sendResponse(500, false, "Error: " . $e->getMessage());
        }
    }

    /** (Taller) Cambia el estado de una cita de su propio taller. */
    public function cambiarEstado($data) {
        if ($this->userRole !== 'Taller') {
            return $this->sendResponse(403, false, "No autorizado");
        }
        if (empty($data['AppointmentID']) || empty($data['Status'])) {
            return $this->sendResponse(400, false, "Faltan datos (AppointmentID o Status)");
        }
        if (!in_array($data['Status'], ['Pendiente', 'Confirmada', 'Finalizada', 'Cancelada'])) {
            return $this->sendResponse(400, false, "Estado no válido");
        }
        $workshopId = $this->model->getWorkshopIdByUserId($this->userId);
        if ($workshopId === null) {
            return $this->sendResponse(404, false, "No se encontró el taller asociado");
        }
        $cita = $this->model->getAppointmentOwner((int)$data['AppointmentID']);
        if (!$cita) {
            return $this->sendResponse(404, false, "Cita no encontrada");
        }
        if ((int)$cita['WorkshopID'] !== $workshopId) {
            return $this->sendResponse(403, false, "Esa cita no pertenece a tu taller");
        }
        if ($this->model->updateAppointmentStatus((int)$data['AppointmentID'], $data['Status'])) {
            return $this->sendResponse(200, true, "Estado actualizado correctamente");
        }
        return $this->sendResponse(500, false, "Error al actualizar el estado");
    }

    /** (Usuario) Devuelve las citas del cliente autenticado. */
    public function misCitas() {
        $result = $this->model->getUserAppointments((int)$this->userId);
        $citas = [];
        while ($row = $result->fetch_assoc()) {
            $citas[] = $row;
        }
        return $this->sendResponse(200, true, "", ["citas" => $citas]);
    }

    /** (Usuario) Cancela una cita propia (libera el hueco). */
    public function cancelar($data) {
        if (empty($data['AppointmentID'])) {
            return $this->sendResponse(400, false, "Falta el ID de la cita");
        }
        $cita = $this->model->getAppointmentOwner((int)$data['AppointmentID']);
        if (!$cita) {
            return $this->sendResponse(404, false, "Cita no encontrada");
        }
        if ((int)$cita['UserID'] !== (int)$this->userId) {
            return $this->sendResponse(403, false, "No puedes cancelar una cita que no es tuya");
        }
        if ($this->model->updateAppointmentStatus((int)$data['AppointmentID'], 'Cancelada')) {
            return $this->sendResponse(200, true, "Cita cancelada correctamente");
        }
        return $this->sendResponse(500, false, "Error al cancelar la cita");
    }

    /** (Taller) Citas del taller con el servicio incluido (para agenda y facturas). */
    public function citasTaller() {
        if ($this->userRole !== 'Taller') {
            return $this->sendResponse(403, false, "No autorizado");
        }
        $workshopId = $this->model->getWorkshopIdByUserId($this->userId);
        if ($workshopId === null) {
            return $this->sendResponse(404, false, "No se encontró el taller asociado");
        }
        $result = $this->model->getWorkshopAppointmentsWithService($workshopId);
        $citas = [];
        while ($row = $result->fetch_assoc()) {
            $citas[] = $row;
        }
        return $this->sendResponse(200, true, "", ["citas" => $citas]);
    }

    /**
     * Comprueba que el intervalo de la cita cabe en el horario del día
     * (abierto, dentro de apertura/cierre y sin pisar el descanso).
     */
    private function validarContraHorario($cfg, $fecha, $startDateTime, $endDateTime) {
        if (!$cfg['IsOpen']) {
            return "El taller está cerrado ese día";
        }
        $start = strtotime($startDateTime);
        $end   = strtotime($endDateTime);
        $open  = strtotime($fecha . ' ' . $cfg['OpenTime']);
        $close = strtotime($fecha . ' ' . $cfg['CloseTime']);
        if ($start < $open || $end > $close) {
            return "El horario seleccionado está fuera del horario de apertura del taller";
        }
        if (!empty($cfg['BreakStart']) && !empty($cfg['BreakEnd'])) {
            $bStart = strtotime($fecha . ' ' . $cfg['BreakStart']);
            $bEnd   = strtotime($fecha . ' ' . $cfg['BreakEnd']);
            if ($start < $bEnd && $end > $bStart) {
                return "El horario seleccionado coincide con el descanso del taller";
            }
        }
        return null;
    }

    // ===============================================================
    //  Helpers
    // ===============================================================

    private function indexScheduleByDay($schedule) {
        $byDay = [];
        foreach ($schedule as $row) {
            $byDay[(int)$row['DayOfWeek']] = $row;
        }
        return $byDay;
    }

    /**
     * Resuelve el WorkshopID del usuario logueado (que debe ser rol Taller).
     * Devuelve null y envía la respuesta de error si no procede.
     */
    private function requireOwnWorkshop() {
        if ($this->userRole !== 'Taller') {
            $this->sendResponse(403, false, "Solo los talleres pueden acceder a esta sección");
            return null;
        }
        $stmt = $this->conn->prepare("SELECT WorkshopID FROM Workshops WHERE UserID = ?");
        $stmt->bind_param("i", $this->userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            $this->sendResponse(404, false, "No se encontró el taller asociado a tu cuenta");
            return null;
        }
        return (int)$row['WorkshopID'];
    }

    private function serviceBelongsToWorkshop($serviceId, $workshopId) {
        $service = $this->model->getServiceById((int)$serviceId);
        return $service && (int)$service['WorkshopID'] === (int)$workshopId;
    }

    private function sendResponse($code, $success, $message, $data = []) {
        http_response_code($code);
        echo json_encode(array_merge(
            ["success" => $success, "message" => $message],
            $data
        ));
        return true;
    }
}
?>
