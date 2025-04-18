<?php
require_once 'models/TablaModel.php';

class TablaController {
    private $modelo;

    public function __construct($conn) {
        $this->modelo = new TablaModel($conn);
    }

    public function mostrarTabla($tablaSeleccionada) {
        $datos = $this->modelo->obtenerDatos($tablaSeleccionada);
        include 'views/tabla_view.php';
    }
}
?>
    