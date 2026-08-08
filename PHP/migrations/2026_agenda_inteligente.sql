-- ============================================================
--  Agenda Inteligente - Migración de base de datos
--  AutoCareHub
--  Ejecutar sobre la base de datos AutoCareHub existente.
-- ============================================================

USE AutoCareHub;

-- ------------------------------------------------------------
-- 1) Horario semanal configurable por taller
--    DayOfWeek sigue el estándar ISO-8601 (1 = Lunes ... 7 = Domingo),
--    igual que DateTime::format('N') en PHP.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkshopSchedules (
    ScheduleID   INT AUTO_INCREMENT PRIMARY KEY,
    WorkshopID   INT NOT NULL,
    DayOfWeek    TINYINT NOT NULL,                 -- 1=Lunes ... 7=Domingo
    IsOpen       BOOLEAN NOT NULL DEFAULT TRUE,
    OpenTime     TIME NOT NULL DEFAULT '09:00:00',
    CloseTime    TIME NOT NULL DEFAULT '18:00:00',
    BreakStart   TIME NULL,                        -- inicio del descanso (opcional)
    BreakEnd     TIME NULL,                        -- fin del descanso (opcional)
    Capacity     INT NOT NULL DEFAULT 1,           -- coches simultáneos (bahías)
    SlotMinutes  INT NOT NULL DEFAULT 60,          -- granularidad de la rejilla en minutos
    UNIQUE KEY uq_workshop_day (WorkshopID, DayOfWeek),
    FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 2) Catálogo de servicios por taller, con duración estimada
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkshopServices (
    ServiceID       INT AUTO_INCREMENT PRIMARY KEY,
    WorkshopID      INT NOT NULL,
    Name            VARCHAR(255) NOT NULL,
    DurationMinutes INT NOT NULL DEFAULT 60,
    Price           DECIMAL(10,2) NULL,
    IsActive        BOOLEAN NOT NULL DEFAULT TRUE,
    CreateAt        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 3) Vincular cada cita con el servicio elegido (opcional)
--    Se usa SQL preparado para que la migración sea idempotente
--    aunque la versión de MySQL no soporte "ADD COLUMN IF NOT EXISTS".
-- ------------------------------------------------------------
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'AutoCareHub'
      AND TABLE_NAME = 'Appointments'
      AND COLUMN_NAME = 'ServiceID'
);
SET @ddl := IF(@col_exists = 0,
    'ALTER TABLE Appointments ADD COLUMN ServiceID INT NULL AFTER WorkshopID',
    'SELECT "La columna ServiceID ya existe" AS info');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Clave foránea hacia WorkshopServices (SET NULL si se borra el servicio)
SET @fk_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = 'AutoCareHub'
      AND TABLE_NAME = 'Appointments'
      AND CONSTRAINT_NAME = 'fk_appt_service'
);
SET @ddl_fk := IF(@fk_exists = 0,
    'ALTER TABLE Appointments ADD CONSTRAINT fk_appt_service FOREIGN KEY (ServiceID) REFERENCES WorkshopServices(ServiceID) ON DELETE SET NULL',
    'SELECT "La FK fk_appt_service ya existe" AS info');
PREPARE stmt2 FROM @ddl_fk;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- ------------------------------------------------------------
-- 4) Índice para acelerar las consultas de disponibilidad
-- ------------------------------------------------------------
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = 'AutoCareHub'
      AND TABLE_NAME = 'Appointments'
      AND INDEX_NAME = 'idx_appt_workshop_time'
);
SET @ddl_idx := IF(@idx_exists = 0,
    'CREATE INDEX idx_appt_workshop_time ON Appointments (WorkshopID, StartDateTime)',
    'SELECT "El índice idx_appt_workshop_time ya existe" AS info');
PREPARE stmt3 FROM @ddl_idx;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- ------------------------------------------------------------
-- 5) Sembrar horario por defecto (L-V 09:00-18:00, descanso 14-15,
--    1 bahía, rejilla de 30 min) para los talleres que aún no lo tengan.
-- ------------------------------------------------------------
INSERT INTO WorkshopSchedules (WorkshopID, DayOfWeek, IsOpen, OpenTime, CloseTime, BreakStart, BreakEnd, Capacity, SlotMinutes)
SELECT w.WorkshopID, d.DayOfWeek,
       IF(d.DayOfWeek <= 5, TRUE, FALSE) AS IsOpen,
       '09:00:00', '18:00:00', '14:00:00', '15:00:00', 1, 30
FROM Workshops w
CROSS JOIN (
    SELECT 1 AS DayOfWeek UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
    UNION SELECT 5 UNION SELECT 6 UNION SELECT 7
) d
WHERE NOT EXISTS (
    SELECT 1 FROM WorkshopSchedules s
    WHERE s.WorkshopID = w.WorkshopID AND s.DayOfWeek = d.DayOfWeek
);
