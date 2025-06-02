<?php
// loginView.php contenido ejemplo para MVC

require_once __DIR__ . '/../config/database.php';

session_start();

// Si el usuario ya está autenticado, redirigir según su rol
if (isset($_SESSION['user'])) {
    switch ($_SESSION['user']['role']) {
        case 'Administrador':
            header('Location: /admin/dashboard.php');
            break;
        case 'Taller':
            header('Location: /workshop/dashboard.php');
            break;
        default:
            header('Location: /dashboard.php');
    }
    exit();
}

// Si hay un error de login en la sesión, mostrarlo y limpiarlo
if (isset($_SESSION['login_error'])) {
    $error = $_SESSION['login_error'];
    unset($_SESSION['login_error']);
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Login - AutoCare Hub</title>
    <!-- ...resto del código HTML... -->
</head>
<body>
    <!-- ...resto del código HTML... -->
</body>
</html>
