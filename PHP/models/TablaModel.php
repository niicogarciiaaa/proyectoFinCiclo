<?php
class TablaModel {
    private $conn;

    public function __construct($conn) {
        $this->conn = $conn;
    }

    public function obtenerDatos($tabla) {
        $tabla = $this->conn->real_escape_string($tabla);
        $sql = "SELECT * FROM $tabla";
        $result = $this->conn->query($sql);
        $datos = [];

        if ($result && $result->num_rows > 0) {
            while ($fila = $result->fetch_assoc()) {
                $datos[] = $fila;
            }
        }

        return [
            'campos' => $result ? $result->fetch_fields() : [],
            'filas' => $datos
        ];
    }
}
?>
