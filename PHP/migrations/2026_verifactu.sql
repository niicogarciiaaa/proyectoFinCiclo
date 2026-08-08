-- ============================================================
--  VeriFactu (RD 1007/2023) - Migración de base de datos
--  AutoCareHub
--  Tablas NUEVAS; no modifica las existentes.
-- ============================================================

USE AutoCareHub;

-- ------------------------------------------------------------
-- 1) Datos fiscales del emisor (taller) necesarios para VeriFactu
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS VerifactuEmisor (
    WorkshopID    INT NOT NULL PRIMARY KEY,
    NIF           VARCHAR(20) NOT NULL,
    RazonSocial   VARCHAR(255) NOT NULL,
    UpdatedAt     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 2) Registros de facturación VeriFactu (huella encadenada).
--    El encadenamiento es por emisor: cada registro guarda la
--    huella del registro inmediatamente anterior del mismo taller.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS VerifactuRegistros (
    RegistroID            INT AUTO_INCREMENT PRIMARY KEY,
    InvoiceID             INT NOT NULL UNIQUE,
    WorkshopID            INT NOT NULL,
    NIF                   VARCHAR(20) NOT NULL,
    NumSerieFactura       VARCHAR(60) NOT NULL,
    FechaExpedicion       VARCHAR(10) NOT NULL,      -- dd-mm-yyyy
    TipoFactura           VARCHAR(4) NOT NULL DEFAULT 'F1',
    CuotaTotal            DECIMAL(10,2) NOT NULL,
    ImporteTotal          DECIMAL(10,2) NOT NULL,
    HuellaAnterior        VARCHAR(64) NOT NULL DEFAULT '',
    Huella                VARCHAR(64) NOT NULL,       -- SHA-256 hex mayúsculas
    FechaHoraGenRegistro  VARCHAR(40) NOT NULL,       -- ISO-8601 con huso
    QrUrl                 TEXT NOT NULL,
    CreatedAt             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (InvoiceID) REFERENCES Invoices(InvoiceID) ON DELETE CASCADE,
    FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE,
    INDEX idx_verifactu_workshop (WorkshopID, RegistroID)
);
