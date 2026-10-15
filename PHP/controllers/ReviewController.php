<?php
require_once __DIR__ . '/../models/Review.php';

/**
 * Controlador de reseñas y valoraciones de talleres (llamada nueva).
 */
class ReviewController {
    private $model;
    private $userId;
    private $userRole;

    public function __construct($db, $userId, $userRole) {
        $this->model    = new ReviewModel($db);
        $this->userId   = (int)$userId;
        $this->userRole = $userRole;
    }

    /** (Usuario) Valora una cita propia ya finalizada. */
    public function crear($data) {
        if (empty($data['AppointmentID'])) {
            return $this->sendResponse(400, false, "Falta el ID de la cita");
        }
        $rating = isset($data['Rating']) ? (int)$data['Rating'] : 0;
        if ($rating < 1 || $rating > 5) {
            return $this->sendResponse(400, false, "La valoración debe estar entre 1 y 5 estrellas");
        }
        $comment = mb_substr(trim((string)($data['Comment'] ?? '')), 0, 1000);

        $cita = $this->model->getAppointment((int)$data['AppointmentID']);
        if (!$cita) {
            return $this->sendResponse(404, false, "Cita no encontrada");
        }
        if ((int)$cita['UserID'] !== $this->userId) {
            return $this->sendResponse(403, false, "Solo puedes valorar tus propias citas");
        }
        if ($cita['Status'] !== 'Finalizada') {
            return $this->sendResponse(409, false, "Solo se pueden valorar citas finalizadas");
        }
        if ($this->model->existsForAppointment((int)$cita['AppointmentID'])) {
            return $this->sendResponse(409, false, "Ya has valorado esta cita");
        }

        $id = $this->model->create(
            (int)$cita['AppointmentID'], $this->userId, (int)$cita['WorkshopID'], $rating, $comment
        );
        if ($id === false) {
            return $this->sendResponse(500, false, "Error al guardar la valoración");
        }
        $this->sendResponse(200, true, "¡Gracias por tu valoración!", ['reviewId' => $id]);
    }

    /** Media y número de reseñas de cada taller. */
    public function resumenTalleres() {
        $this->sendResponse(200, true, "", ['resumen' => $this->model->getSummaryAllWorkshops()]);
    }

    /**
     * Reseñas de un taller. El taller ve las suyas sin indicar WorkshopID;
     * cualquier usuario puede consultar las de un taller concreto.
     */
    public function listarTaller($data) {
        $workshopId = !empty($data['WorkshopID']) ? (int)$data['WorkshopID'] : null;
        if ($workshopId === null && $this->userRole === 'Taller') {
            $workshopId = $this->model->getWorkshopIdByUserId($this->userId);
        }
        if ($workshopId === null) {
            return $this->sendResponse(400, false, "Falta el ID del taller");
        }
        $this->sendResponse(200, true, "", [
            'resumen'  => $this->model->getWorkshopSummary($workshopId),
            'reviews'  => $this->model->getWorkshopReviews($workshopId, $data['Limite'] ?? 20),
        ]);
    }

    private function sendResponse($code, $success, $message, $data = []) {
        http_response_code($code);
        echo json_encode(array_merge(["success" => $success, "message" => $message], $data));
        return true;
    }
}
?>
