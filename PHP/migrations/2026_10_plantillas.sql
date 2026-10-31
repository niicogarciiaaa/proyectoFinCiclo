-- ============================================================
--  Plantillas de trabajo - Migración de base de datos
--  AutoCareHub
--  Tabla NUEVA; no modifica ni borra las existentes.
--  (El endpoint routes/templates.php también la crea si no existe.)
-- ============================================================

CREATE TABLE IF NOT EXISTS WorkTemplates (
    TemplateID  INT AUTO_INCREMENT PRIMARY KEY,
    WorkshopID  INT NOT NULL,
    Name        VARCHAR(80) NOT NULL,
    ItemsJSON   TEXT NOT NULL,
    UpdatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_template_name (WorkshopID, Name),
    FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
);
