-- ============================================================
--  Seguimiento de la reparación - Migración de base de datos
--  AutoCareHub
--  Tabla NUEVA; no modifica ni borra las existentes.
--  (El endpoint routes/tracking.php también la crea si no existe.)
-- ============================================================

CREATE TABLE IF NOT EXISTS AppointmentProgress (
    ProgressID     INT AUTO_INCREMENT PRIMARY KEY,
    AppointmentID  INT NOT NULL,
    WorkshopID     INT NOT NULL,
    Stage          VARCHAR(30) NOT NULL,   -- recibido, diagnostico, esperando_piezas, reparacion, listo, entregado
    Note           VARCHAR(500) NULL,
    CreatedBy      INT NOT NULL,
    CreatedAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_progress_appt (AppointmentID, ProgressID),
    INDEX idx_progress_workshop (WorkshopID),
    FOREIGN KEY (AppointmentID) REFERENCES Appointments(AppointmentID) ON DELETE CASCADE,
    FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
);
