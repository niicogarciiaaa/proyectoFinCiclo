<?php
$host = "localhost";
$usuario = "hmi";
$contrasena = "hmi";
$nombreBD = "AutoCareHub";

$conn = new mysqli($host, $usuario, $contrasena, $nombreBD);
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}
?>
