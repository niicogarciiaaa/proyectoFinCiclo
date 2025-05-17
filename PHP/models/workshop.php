<?php
class Workshop {
    private $conn;
    private $table_name = "Workshops";

    public $WorkshopID;
    public $UserID;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getWorkshopByUser($userID) {
        $query = "SELECT WorkshopID FROM {$this->table_name} WHERE UserID = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $userID);
        $stmt->execute();
        return $stmt->get_result();
    }

    public function exists($workshopID) {
        $query = "SELECT * FROM {$this->table_name} WHERE WorkshopID = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $workshopID);
        $stmt->execute();
        $result = $stmt->get_result();
        return ($result->num_rows > 0);
    }
}
