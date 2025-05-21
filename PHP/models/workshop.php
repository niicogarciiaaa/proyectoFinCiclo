<?php
class Workshop {
    private $conn;
    private $table_name = "Workshops";
    private $users_table = "Users";

    public $WorkshopID;
    public $UserID;
    public $Name;
    public $Address;
    public $Phone;
    public $Description;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function query($query) {
        return $this->conn->query($query);
    }

    public function prepare($query) {
        return $this->conn->prepare($query);
    }

    public function getById($id) {
        $query = "SELECT w.*, u.Email, u.FullName 
                 FROM {$this->table_name} w
                 INNER JOIN {$this->users_table} u ON w.UserID = u.UserID
                 WHERE w.WorkshopID = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $id);
        $stmt->execute();
        return $stmt->get_result();
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

    public function createWorkshopUser($email, $fullName, $password) {
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $role = "Taller";

        $query = "INSERT INTO {$this->users_table} (Email, FullName, Password, Role) VALUES (?, ?, ?, ?)";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("ssss", $email, $fullName, $hashedPassword, $role);
        
        if ($stmt->execute()) {
            return $stmt->insert_id;
        }
        return false;
    }

    public function createWorkshopInfo($userId, $name, $address, $phone, $description = '') {
        $query = "INSERT INTO {$this->table_name} (UserID, Name, Address, Phone, Description) VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("issss", $userId, $name, $address, $phone, $description);
        
        return $stmt->execute();
    }

    public function updateWorkshopInfo($data) {
        $query = "UPDATE {$this->table_name} SET ";
        $params = [];
        $types = "";
        $values = [];

        if (isset($data['name'])) {
            $params[] = "Name = ?";
            $types .= "s";
            $values[] = $data['name'];
        }
        if (isset($data['address'])) {
            $params[] = "Address = ?";
            $types .= "s";
            $values[] = $data['address'];
        }
        if (isset($data['phone'])) {
            $params[] = "Phone = ?";
            $types .= "s";
            $values[] = $data['phone'];
        }
        if (isset($data['description'])) {
            $params[] = "Description = ?";
            $types .= "s";
            $values[] = $data['description'];
        }

        if (empty($params)) {
            return false;
        }

        $query .= implode(", ", $params);
        $query .= " WHERE WorkshopID = ?";
        $types .= "i";
        $values[] = $data['workshopId'];

        $stmt = $this->conn->prepare($query);
        $stmt->bind_param($types, ...$values);
        
        return $stmt->execute();
    }

    public function deleteUser($userId) {
        $query = "DELETE FROM {$this->users_table} WHERE UserID = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $userId);
        return $stmt->execute();
    }
}
