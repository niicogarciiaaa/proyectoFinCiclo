<?php
require_once __DIR__ . '/../models/Appointment.php';

class AppointmentController {
    private $model;
    private $userId;
    private $userRole;

    public function __construct($db, $userId, $userRole) {
        $this->model = new AppointmentModel($db);
        $this->userId = $userId;
        $this->userRole = $userRole;
    }

    public function consultarSemana($data) {
        try {
            if (!isset($data['WorkshopID'])) {
                return $this->sendResponse(400, false, "Falta el ID del taller");
            }

            $workshopId = $data['WorkshopID'];

            // Verificar que el taller existe
            if (!$this->model->checkWorkshopExists($workshopId)) {
                return $this->sendResponse(404, false, "Taller no encontrado");
            }

            $fechaActual = new DateTime();
            $fechaInicio = $fechaActual->format('Y-m-d');
            $fechaFin = (clone $fechaActual)->modify('+30 days')->format('Y-m-d');

            $result = $this->model->getWeeklySlots($workshopId, $fechaInicio, $fechaFin);
            $slots = $this->procesarSlotsSemanales($result, $fechaInicio, $fechaFin);

            return $this->sendResponse(200, true, "", ["slotsSemana" => $slots]);
        } catch (Exception $e) {
            return $this->sendResponse(500, false, "Error al consultar disponibilidad: " . $e->getMessage());
        }
    }

    public function crear($data) {
        try {
            // Validar campos requeridos
            $camposRequeridos = ['Fecha', 'Hora', 'VehicleID', 'WorkshopID'];
            foreach ($camposRequeridos as $campo) {
                if (!isset($data[$campo])) {
                    return $this->sendResponse(400, false, "Falta el campo: $campo");
                }
            }

            // Establecer descripción por defecto si no se proporciona
            $data['Descripcion'] = $data['Descripcion'] ?? '';

            // Validar fecha y hora
            if (!$this->validarFechaHora($data['Fecha'], $data['Hora'])) {
                return $this->sendResponse(400, false, "Formato de fecha u hora inválido");
            }

            $startDateTime = $data['Fecha'] . ' ' . $data['Hora'] . ':00';
            $endDateTime = date('Y-m-d H:i:s', strtotime($startDateTime . ' +1 hour'));

            // Verificar disponibilidad
            if (!$this->model->checkSlotAvailability($data['WorkshopID'], $startDateTime)) {
                return $this->sendResponse(409, false, "Horario no disponible");
            }

            // Crear la cita
            $this->model->UserID = $this->userId;
            $this->model->VehicleID = $data['VehicleID'];
            $this->model->WorkshopID = $data['WorkshopID'];
            $this->model->StartDateTime = $startDateTime;
            $this->model->EndDateTime = $endDateTime;
            $this->model->Descripcion = $data['Descripcion'];
            $this->model->Status = $data['Status'] ?? 'Pendiente';

            if ($this->model->create()) {
                return $this->sendResponse(200, true, "Cita creada correctamente");
            } else {
                return $this->sendResponse(500, false, "Error al crear la cita");
            }
        } catch (Exception $e) {
            return $this->sendResponse(500, false, "Error: " . $e->getMessage());
        }
    }

    public function verCitasTaller() {
        try {
            if ($this->userRole !== 'Taller') {
                return $this->sendResponse(403, false, "No autorizado");
            }

            $workshop = $this->model->getWorkshopByUserId($this->userId)->fetch_assoc();
            if (!$workshop) {
                return $this->sendResponse(404, false, "No se encontró el taller asociado");
            }

            $result = $this->model->getWorkshopAppointments($workshop['WorkshopID']);
            $citas = [];
            while ($row = $result->fetch_assoc()) {
                $citas[] = $row;
            }

            return $this->sendResponse(200, true, "", ["citas" => $citas]);
        } catch (Exception $e) {
            return $this->sendResponse(500, false, "Error: " . $e->getMessage());
        }
    }

    private function procesarSlotsSemanales($result, $fechaInicio, $fechaFin) {
        $ocupadas = [];
        while ($row = $result->fetch_assoc()) {
            $fechaHora = $row['StartDateTime'];
            $fecha = date('Y-m-d', strtotime($fechaHora));
            $hora = date('H:i', strtotime($fechaHora));
            $ocupadas[$fecha][] = $hora;
        }

        $slotsDelMes = [];
        $period = new DatePeriod(
            new DateTime($fechaInicio),
            new DateInterval('P1D'),
            (new DateTime($fechaFin))->modify('+1 day')
        );

        foreach ($period as $fechaObj) {
            if ($fechaObj->format('N') >= 6) continue;

            $fechaStr = $fechaObj->format('Y-m-d');
            $slots = [];
            for ($h = 9; $h < 18; $h++) {
                $horaSlot = sprintf('%02d:00', $h);
                $estado = (isset($ocupadas[$fechaStr]) && in_array($horaSlot, $ocupadas[$fechaStr])) 
                    ? 'Ocupada' 
                    : 'Disponible';
                $slots[] = ["hora" => $horaSlot, "estado" => $estado];
            }
            $slotsDelMes[$fechaStr] = $slots;
        }

        return $slotsDelMes;
    }

    private function validarFechaHora($fecha, $hora) {
        return DateTime::createFromFormat('Y-m-d', $fecha) !== false && 
               DateTime::createFromFormat('H:i', $hora) !== false;
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