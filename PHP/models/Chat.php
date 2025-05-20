<?php
class ChatModel {
    private $conn;
    private $chatsTable = 'Chats';
    private $messagesTable = 'Messages';
    
    public function __construct($db) {
        $this->conn = $db;
    }
    
    public function createChat($userId, $workshopId) {
        $query = "INSERT INTO " . $this->chatsTable . " 
                 (UserID, WorkshopID) VALUES (?, ?)";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("ii", $userId, $workshopId);
        
        if ($stmt->execute()) {
            return $this->conn->insert_id;
        }
        return false;
    }
    
    public function sendMessage($chatId, $senderId, $message) {
        $query = "INSERT INTO " . $this->messagesTable . " 
                 (ChatID, SenderID, Message) VALUES (?, ?, ?)";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("iis", $chatId, $senderId, $message);
        
        if ($stmt->execute()) {
            // Actualizar timestamp del último mensaje
            $this->updateLastMessage($chatId);
            return true;
        }
        return false;
    }
    
    public function getMessages($chatId, $limit = 50) {
        $query = "SELECT m.*, u.FullName as SenderName 
                 FROM " . $this->messagesTable . " m
                 JOIN Users u ON m.SenderID = u.UserID
                 WHERE m.ChatID = ?
                 ORDER BY m.CreateAt DESC LIMIT ?";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("ii", $chatId, $limit);
        $stmt->execute();
        
        return $stmt->get_result();
    }
    
    public function getUserChats($userId) {
        $query = "SELECT c.*, w.Name as WorkshopName, 
                        (SELECT Message FROM Messages 
                         WHERE ChatID = c.ChatID 
                         ORDER BY CreateAt DESC LIMIT 1) as LastMessage
                 FROM " . $this->chatsTable . " c
                 JOIN Workshops w ON c.WorkshopID = w.WorkshopID
                 WHERE c.UserID = ? AND c.Status = 'Active'
                 ORDER BY c.LastMessage DESC";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        
        return $stmt->get_result();
    }
    
    public function getWorkshopChats($workshopId) {
        $query = "SELECT c.*, u.FullName as UserName,
                        (SELECT Message FROM Messages 
                         WHERE ChatID = c.ChatID 
                         ORDER BY CreateAt DESC LIMIT 1) as LastMessage
                 FROM " . $this->chatsTable . " c
                 JOIN Users u ON c.UserID = u.UserID
                 WHERE c.WorkshopID = ? AND c.Status = 'Active'
                 ORDER BY c.LastMessage DESC";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        
        return $stmt->get_result();
    }
    
    private function updateLastMessage($chatId) {
        $query = "UPDATE " . $this->chatsTable . " 
                 SET LastMessage = CURRENT_TIMESTAMP 
                 WHERE ChatID = ?";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $chatId);
        $stmt->execute();
    }
    
    public function markAsRead($chatId, $userId) {
        $query = "UPDATE " . $this->messagesTable . " 
                 SET IsRead = TRUE 
                 WHERE ChatID = ? AND SenderID != ?";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("ii", $chatId, $userId);
        return $stmt->execute();
    }
    
    public function getConnection() {
        return $this->conn;
    }
    
    public function checkExistingChat($userId, $workshopId) {
        $query = "SELECT ChatID FROM " . $this->chatsTable . " 
                 WHERE UserID = ? AND WorkshopID = ? AND Status = 'Active'";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("ii", $userId, $workshopId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        return $result->fetch_assoc()['ChatID'] ?? null;
    }
    
    public function getUnreadCount($chatId, $userId) {
        $query = "SELECT COUNT(*) as count FROM " . $this->messagesTable . " 
                 WHERE ChatID = ? AND SenderID != ? AND IsRead = FALSE";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("ii", $chatId, $userId);
        $stmt->execute();
        
        return $stmt->get_result()->fetch_assoc()['count'];
    }
    

}
?>
