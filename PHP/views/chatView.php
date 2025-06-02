<?php
session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/ChatController.php';
require_once __DIR__ . '/../config/mockSession.php';

// Simular sesión para desarrollo
MockSession::mockAs('Usuario'); // Cambia a 'Taller' para probar la vista del taller

// Verificar si el usuario está autenticado
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    echo "<p>Debe iniciar sesión para ver esta página.</p>";
    exit();
}

$db = new Database();
$conn = $db->getConnection();
$chatController = new ChatController(
    $conn,
    $_SESSION['user']['id'],
    $_SESSION['user']['role']
);

// Obtener la lista de chats del usuario
$result = $chatController->obtenerChats();
$chats = json_decode($result, true);
?>

<div class="chat-container">
    <div class="chat-list">
        <h2>Mis Conversaciones</h2>
        <?php if ($chats['success'] && !empty($chats['chats'])): ?>
            <?php foreach ($chats['chats'] as $chat): ?>
                <div class="chat-item" onclick="loadMessages(<?php echo $chat['ChatID']; ?>)">
                    <h3><?php echo htmlspecialchars($chat['WorkshopName'] ?? $chat['UserName']); ?></h3>
                    <?php if ($chat['LastMessage']): ?>
                        <p class="last-message"><?php echo htmlspecialchars($chat['LastMessage']); ?></p>
                    <?php endif; ?>
                    <?php if ($chat['unreadCount'] > 0): ?>
                        <span class="unread-badge"><?php echo $chat['unreadCount']; ?></span>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
        <?php else: ?>
            <p>No hay conversaciones activas.</p>
        <?php endif; ?>
    </div>

    <div class="chat-messages" id="chat-messages">
        <p class="select-chat">Seleccione una conversación para ver los mensajes.</p>
    </div>

    <div class="chat-input" style="display: none;">
        <form id="message-form">
            <input type="text" id="message" name="message" placeholder="Escriba su mensaje..." required>
            <button type="submit">Enviar</button>
        </form>
    </div>
</div>

<style>
.chat-container {
    display: flex;
    height: 500px;
    border: 1px solid #ccc;
}

.chat-list {
    width: 300px;
    border-right: 1px solid #ccc;
    overflow-y: auto;
    padding: 10px;
}

.chat-item {
    padding: 10px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
}

.chat-item:hover {
    background-color: #f5f5f5;
}

.chat-messages {
    flex-grow: 1;
    padding: 20px;
    overflow-y: auto;
}

.chat-input {
    position: fixed;
    bottom: 0;
    width: 100%;
    padding: 10px;
    background: white;
    border-top: 1px solid #ccc;
}

.chat-input form {
    display: flex;
    gap: 10px;
}

.chat-input input {
    flex-grow: 1;
    padding: 8px;
}

.unread-badge {
    background: red;
    color: white;
    border-radius: 50%;
    padding: 2px 6px;
    font-size: 12px;
}

.message {
    margin: 10px 0;
    padding: 10px;
    border-radius: 5px;
}

.message.sent {
    background: #e3f2fd;
    margin-left: 20%;
}

.message.received {
    background: #f5f5f5;
    margin-right: 20%;
}
</style>

<script>
let currentChatId = null;

function loadMessages(chatId) {
    currentChatId = chatId;
    // Aquí iría la lógica para cargar los mensajes usando el controlador
    fetch(`chats.php?chat_id=${chatId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayMessages(data.messages);
                document.querySelector('.chat-input').style.display = 'block';
            }
        });
}

function displayMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.SenderID == <?php echo $_SESSION['user']['id']; ?> ? 'sent' : 'received'}`;
        messageDiv.textContent = message.Message;
        container.appendChild(messageDiv);
    });
    
    container.scrollTop = container.scrollHeight;
}

document.getElementById('message-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!currentChatId) return;

    const message = document.getElementById('message').value;
    if (!message) return;

    fetch('chats.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'enviar_mensaje',
            chat_id: currentChatId,
            message: message
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('message').value = '';
            loadMessages(currentChatId);
        }
    });
});
</script>