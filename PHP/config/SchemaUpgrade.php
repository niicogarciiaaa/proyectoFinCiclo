<?php
require_once __DIR__ . '/Logger.php';

/**
 * Crea, si todavía no existen, las tablas que necesitan las mejoras de
 * octubre de 2026 (días de cierre, reseñas y taller en 3D). Así las llamadas nuevas
 * funcionan aunque no se haya ejecutado a mano la migración
 * migrations/2026_10_mejoras.sql. Es idempotente y no toca las tablas
 * existentes.
 */
class SchemaUpgrade {
    private static $done = false;

    public static function ensure($conn) {
        if (self::$done || !$conn) {
            return;
        }
        self::$done = true;

        $sql = [
            "CREATE TABLE IF NOT EXISTS WorkshopClosures (
                ClosureID    INT AUTO_INCREMENT PRIMARY KEY,
                WorkshopID   INT NOT NULL,
                ClosureDate  DATE NOT NULL,
                Reason       VARCHAR(255) NULL,
                CreatedAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_closure_day (WorkshopID, ClosureDate),
                FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
            )",
            "CREATE TABLE IF NOT EXISTS WorkshopReviews (
                ReviewID       INT AUTO_INCREMENT PRIMARY KEY,
                AppointmentID  INT NOT NULL UNIQUE,
                UserID         INT NOT NULL,
                WorkshopID     INT NOT NULL,
                Rating         TINYINT NOT NULL,
                Comment        TEXT NULL,
                CreatedAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CHECK (Rating BETWEEN 1 AND 5),
                FOREIGN KEY (AppointmentID) REFERENCES Appointments(AppointmentID) ON DELETE CASCADE,
                FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
                FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE,
                INDEX idx_reviews_workshop (WorkshopID, CreatedAt)
            )",
            "CREATE TABLE IF NOT EXISTS WorkshopLayouts (
                WorkshopID   INT NOT NULL PRIMARY KEY,
                LayoutJSON   MEDIUMTEXT NOT NULL,
                UpdatedAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
            )",
            "CREATE TABLE IF NOT EXISTS WorkshopBayAssignments (
                AssignmentID   INT AUTO_INCREMENT PRIMARY KEY,
                WorkshopID     INT NOT NULL,
                BayKey         VARCHAR(40) NOT NULL,
                AppointmentID  INT NOT NULL UNIQUE,
                CarColor       VARCHAR(7) NOT NULL DEFAULT '#1976d2',
                Lifted         TINYINT(1) NOT NULL DEFAULT 0,
                AssignedAt     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_bay (WorkshopID, BayKey),
                FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE,
                FOREIGN KEY (AppointmentID) REFERENCES Appointments(AppointmentID) ON DELETE CASCADE
            )",
            "CREATE TABLE IF NOT EXISTS VehicleNotes (
                NoteID         INT AUTO_INCREMENT PRIMARY KEY,
                WorkshopID     INT NOT NULL,
                VehicleID      INT NOT NULL,
                AppointmentID  INT NULL,
                AuthorUserID   INT NOT NULL,
                Note           TEXT NOT NULL,
                CreatedAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_notes_vehicle (WorkshopID, VehicleID, CreatedAt),
                FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE,
                FOREIGN KEY (VehicleID) REFERENCES Vehicles(VehicleID) ON DELETE CASCADE,
                FOREIGN KEY (AppointmentID) REFERENCES Appointments(AppointmentID) ON DELETE SET NULL
            )",
        ];

        foreach ($sql as $query) {
            // Desde PHP 8.1 mysqli lanza excepciones por defecto: se capturan
            // para que un fallo aquí no tumbe la petición en curso.
            try {
                if (!$conn->query($query)) {
                    Logger::error("SchemaUpgrade: no se pudo crear una tabla de mejoras: " . $conn->error);
                }
            } catch (Throwable $e) {
                Logger::error("SchemaUpgrade: no se pudo crear una tabla de mejoras: " . $e->getMessage());
            }
        }
    }
}
?>
