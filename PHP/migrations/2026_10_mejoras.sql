-- ============================================================
--  Mejoras octubre 2026 - Migración de base de datos
--  AutoCareHub
--  Tablas NUEVAS; no modifica ni borra las existentes.
--  Requiere haber aplicado antes 2026_agenda_inteligente.sql.
-- ============================================================

USE AutoCareHub;

-- ------------------------------------------------------------
-- 1) Días festivos / cierres puntuales del taller.
--    Bloquean fechas concretas además del horario semanal.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkshopClosures (
    ClosureID    INT AUTO_INCREMENT PRIMARY KEY,
    WorkshopID   INT NOT NULL,
    ClosureDate  DATE NOT NULL,
    Reason       VARCHAR(255) NULL,
    CreatedAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_closure_day (WorkshopID, ClosureDate),
    FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 2) Reseñas y valoraciones del taller tras una cita finalizada.
--    Una reseña por cita.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkshopReviews (
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
);

-- ------------------------------------------------------------
-- 3) Taller en 3D: distribución personalizable del taller
--    (puestos, elevadores, colores...) guardada como JSON.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkshopLayouts (
    WorkshopID   INT NOT NULL PRIMARY KEY,
    LayoutJSON   MEDIUMTEXT NOT NULL,
    UpdatedAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 4) Qué coche (cita) está en qué puesto del taller.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkshopBayAssignments (
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
);

-- ------------------------------------------------------------
-- 5) Notas del taller sobre un vehículo (ficha del coche).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS VehicleNotes (
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
);
