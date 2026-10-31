<?php
/**
 * Modelo de las plantillas de trabajo del taller (llamada nueva): paquetes de
 * conceptos y precios que rellenan una factura de una vez.
 */
class WorkTemplateModel {
    private $conn;
    private static $tablaLista = false;

    public function __construct($db) {
        $this->conn = $db;
        if (self::$tablaLista) return;
        self::$tablaLista = true;
        try {
            $this->conn->query(
                "CREATE TABLE IF NOT EXISTS WorkTemplates (
                    TemplateID  INT AUTO_INCREMENT PRIMARY KEY,
                    WorkshopID  INT NOT NULL,
                    Name        VARCHAR(80) NOT NULL,
                    ItemsJSON   TEXT NOT NULL,
                    UpdatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_template_name (WorkshopID, Name),
                    FOREIGN KEY (WorkshopID) REFERENCES Workshops(WorkshopID) ON DELETE CASCADE
                )"
            );
        } catch (Throwable $e) {
            Logger::error("WorkTemplate: no se pudo crear WorkTemplates: " . $e->getMessage());
        }
    }

    public function getWorkshopIdByUserId($userId) {
        $stmt = $this->conn->prepare("SELECT WorkshopID FROM Workshops WHERE UserID = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return $row ? (int)$row['WorkshopID'] : null;
    }

    public function listar($workshopId) {
        $stmt = $this->conn->prepare(
            "SELECT TemplateID, Name, ItemsJSON FROM WorkTemplates WHERE WorkshopID = ? ORDER BY Name"
        );
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = [
                'TemplateID' => (int)$row['TemplateID'],
                'Name'       => $row['Name'],
                'Items'      => json_decode($row['ItemsJSON'], true) ?: [],
            ];
        }
        return $rows;
    }

    /** Crea la plantilla o, si ya hay una con ese nombre, la sustituye. */
    public function guardar($workshopId, $nombre, $items) {
        $json = json_encode($items, JSON_UNESCAPED_UNICODE);
        $stmt = $this->conn->prepare(
            "INSERT INTO WorkTemplates (WorkshopID, Name, ItemsJSON) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE ItemsJSON = VALUES(ItemsJSON)"
        );
        $stmt->bind_param("iss", $workshopId, $nombre, $json);
        return $stmt->execute();
    }

    public function eliminar($templateId, $workshopId) {
        $stmt = $this->conn->prepare("DELETE FROM WorkTemplates WHERE TemplateID = ? AND WorkshopID = ?");
        $stmt->bind_param("ii", $templateId, $workshopId);
        $stmt->execute();
        return $stmt->affected_rows > 0;
    }
}
?>
