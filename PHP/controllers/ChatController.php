<?php
require_once __DIR__ . '/../models/Chat.php';

class ChatController {
    private $model;
    private $userId;
    private $userRole;
    
    public function __construct($db, $userId, $userRole) {
        $this->model = new ChatModel($db);
        $this->userId = $userId;
        $this->userRole = $userRole;
    }
    
    public function iniciarChat($data) {
        try {
            if (!isset($data['workshop_id'])) {
                return $this->sendResponse(400, false, "Falta el ID del taller");
            }
            
            // Verificar si ya existe un chat activo
            $existingChatId = $this->model->checkExistingChat($this->userId, $data['workshop_id']);
            if ($existingChatId) {
                return $this->sendResponse(200, true, "Chat existente recuperado", 
                    ['chat_id' => $existingChatId]);
            }
            
            $chatId = $this->model->createChat($this->userId, $data['workshop_id']);
            if ($chatId) {
                // Enviar mensaje automático de bienvenida
                $this->model->sendMessage($chatId, $this->userId, "¡Hola! He iniciado un nuevo chat.");
                return $this->sendResponse(200, true, "Chat iniciado correctamente", 
                    ['chat_id' => $chatId]);
            }
            
            return $this->sendResponse(500, false, "Error al iniciar el chat");
        } catch (Exception $e) {
            return $this->sendResponse(500, false, $e->getMessage());
        }
    }
    
    public function enviarMensaje($data) {
        try {
            if (!isset($data['chat_id']) || !isset($data['message'])) {
                return $this->sendResponse(400, false, "Faltan datos requeridos");
            }
            
            if ($this->model->sendMessage($data['chat_id'], $this->userId, $data['message'])) {
                return $this->sendResponse(200, true, "Mensaje enviado correctamente");
            }
            
            return $this->sendResponse(500, false, "Error al enviar el mensaje");
        } catch (Exception $e) {
            return $this->sendResponse(500, false, $e->getMessage());
        }
    }
    
    public function obtenerChats() {
        try {
            $chats = $this->userRole === 'Taller' ? 
                     $this->model->getWorkshopChats($this->getWorkshopId()) : 
                     $this->model->getUserChats($this->userId);
            
            $result = [];
            while ($chat = $chats->fetch_assoc()) {
                $chat['unreadCount'] = $this->model->getUnreadCount($chat['ChatID'], $this->userId);
                $result[] = $chat;
            }
                     
            return $this->sendResponse(200, true, "", ['chats' => $result]);
        } catch (Exception $e) {
            return $this->sendResponse(500, false, $e->getMessage());
        }
    }
    
    public function obtenerMensajes($chatId) {
        try {
            $messages = $this->model->getMessages($chatId);
            $this->model->markAsRead($chatId, $this->userId);
            
            return $this->sendResponse(200, true, "", 
                ['messages' => $messages->fetch_all(MYSQLI_ASSOC)]);
        } catch (Exception $e) {
            return $this->sendResponse(500, false, $e->getMessage());
        }
    }
    
    private function getWorkshopId() {
        $query = "SELECT WorkshopID FROM Workshops WHERE UserID = ?";
        $stmt = $this->model->getConnection()->prepare($query);
        $stmt->bind_param("i", $this->userId);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_assoc()['WorkshopID'];
    }
    
    private function sendResponse($code, $success, $message, $data = []) {
        http_response_code($code);
        echo json_encode(array_merge(
            ["success" => $success, "message" => $message],
            $data
        ));
        return true;
    }
}
?>
