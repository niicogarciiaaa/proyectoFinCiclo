<?php
require_once __DIR__ . '/../config/SchemaUpgrade.php';

/**
 * Modelo de reseñas y valoraciones de talleres.
 * Un cliente puede valorar (1-5 estrellas + comentario) cada una de sus
 * citas finalizadas, una sola vez.
 */
class ReviewModel {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
        SchemaUpgrade::ensure($db);
    }

    /** Cita con los datos necesarios para validar si se puede valorar. */
    public function getAppointment($appointmentId) {
        $stmt = $this->conn->prepare(
            "SELECT AppointmentID, UserID, WorkshopID, Status FROM Appointments WHERE AppointmentID = ?"
        );
        $stmt->bind_param("i", $appointmentId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc() ?: null;
    }

    public function existsForAppointment($appointmentId) {
        $stmt = $this->conn->prepare("SELECT ReviewID FROM WorkshopReviews WHERE AppointmentID = ?");
        $stmt->bind_param("i", $appointmentId);
        $stmt->execute();
        return $stmt->get_result()->num_rows > 0;
    }

    public function create($appointmentId, $userId, $workshopId, $rating, $comment) {
        $comment = htmlspecialchars(strip_tags((string)$comment));
        $stmt = $this->conn->prepare(
            "INSERT INTO WorkshopReviews (AppointmentID, UserID, WorkshopID, Rating, Comment)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("iiiis", $appointmentId, $userId, $workshopId, $rating, $comment);
        if ($stmt->execute()) {
            return $stmt->insert_id;
        }
        return false;
    }

    /** Media y número de reseñas de todos los talleres (para el selector de reserva). */
    public function getSummaryAllWorkshops() {
        $result = $this->conn->query(
            "SELECT WorkshopID, ROUND(AVG(Rating), 1) AS Media, COUNT(*) AS Total
             FROM WorkshopReviews GROUP BY WorkshopID"
        );
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = [
                'WorkshopID' => (int)$row['WorkshopID'],
                'Media'      => (float)$row['Media'],
                'Total'      => (int)$row['Total'],
            ];
        }
        return $rows;
    }

    /** Resumen (media, total y reparto por estrellas) de un taller. */
    public function getWorkshopSummary($workshopId) {
        $stmt = $this->conn->prepare(
            "SELECT Rating, COUNT(*) AS Total FROM WorkshopReviews WHERE WorkshopID = ? GROUP BY Rating"
        );
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        $result = $stmt->get_result();

        $reparto = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
        $total = 0;
        $suma = 0;
        while ($row = $result->fetch_assoc()) {
            $r = (int)$row['Rating'];
            $n = (int)$row['Total'];
            $reparto[$r] = $n;
            $total += $n;
            $suma += $r * $n;
        }
        return [
            'Media'   => $total > 0 ? round($suma / $total, 1) : null,
            'Total'   => $total,
            'Reparto' => $reparto,
        ];
    }

    /** Últimas reseñas de un taller (sin datos personales salvo el nombre). */
    public function getWorkshopReviews($workshopId, $limit = 20) {
        $limit = max(1, min(100, (int)$limit));
        $stmt = $this->conn->prepare(
            "SELECT r.ReviewID, r.Rating, r.Comment, r.CreatedAt, a.Service, u.FullName AS UserName
             FROM WorkshopReviews r
             JOIN Appointments a ON a.AppointmentID = r.AppointmentID
             JOIN Users u ON u.UserID = r.UserID
             WHERE r.WorkshopID = ?
             ORDER BY r.CreatedAt DESC
             LIMIT ?"
        );
        $stmt->bind_param("ii", $workshopId, $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['ReviewID'] = (int)$row['ReviewID'];
            $row['Rating']   = (int)$row['Rating'];
            $row['UserName'] = $this->nombrePublico($row['UserName']);
            $rows[] = $row;
        }
        return $rows;
    }

    /** Privacidad: solo nombre e inicial del primer apellido ("Ana G."). */
    private function nombrePublico($fullName) {
        $partes = preg_split('/\s+/', trim((string)$fullName));
        if (empty($partes[0])) {
            return 'Cliente';
        }
        $nombre = $partes[0];
        if (isset($partes[1]) && $partes[1] !== '') {
            $nombre .= ' ' . mb_strtoupper(mb_substr($partes[1], 0, 1)) . '.';
        }
        return $nombre;
    }

    public function getWorkshopIdByUserId($userId) {
        $stmt = $this->conn->prepare("SELECT WorkshopID FROM Workshops WHERE UserID = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return $row ? (int)$row['WorkshopID'] : null;
    }
}
?>
