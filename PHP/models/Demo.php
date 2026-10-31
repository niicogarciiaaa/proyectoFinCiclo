<?php
require_once __DIR__ . '/Garage.php';
require_once __DIR__ . '/Tracking.php';
require_once __DIR__ . '/Review.php';

/**
 * Modo demostración: crea datos de ejemplo para un taller y los borra después.
 *
 * Todo cuelga de clientes ficticios con un email del dominio reservado
 * «.invalid» (demo<taller>-<n>@autocarehub.invalid), con los que nadie puede
 * iniciar sesión. Al borrar esos usuarios, las claves foráneas eliminan en
 * cascada sus vehículos, citas, facturas, puestos, etapas y reseñas: lo real
 * no se toca.
 */
class DemoModel {
    private $conn;

    private const CLIENTES = [
        ['Cliente Demo Uno', 'Seat', 'León', 2019, '1111DMO', '#3b82f6'],
        ['Cliente Demo Dos', 'Renault', 'Clio', 2021, '2222DMO', '#dc2626'],
        ['Cliente Demo Tres', 'Toyota', 'Corolla', 2020, '3333DMO', '#f5f5f5'],
        ['Cliente Demo Cuatro', 'BMW', 'Serie 1', 2018, '4444DMO', '#212121'],
        ['Cliente Demo Cinco', 'Peugeot', '208', 2022, '5555DMO', '#388e3c'],
        ['Cliente Demo Seis', 'Volkswagen', 'Golf', 2017, '6666DMO', '#7b1fa2'],
    ];

    /** Trabajos de ejemplo: nombre, minutos y líneas (concepto, cantidad, precio, IVA). */
    private const TRABAJOS = [
        ['Cambio de aceite y filtro', 60, [['Aceite 5W30 (5 L)', 1, 42.0, 21], ['Filtro de aceite', 1, 12.5, 21], ['Mano de obra', 0.5, 45.0, 21]]],
        ['Revisión general', 120, [['Revisión de 40 puntos', 1, 79.0, 21], ['Líquidos y niveles', 1, 18.0, 21]]],
        ['Cambio de pastillas de freno', 90, [['Pastillas delanteras', 2, 38.5, 21], ['Mano de obra', 1, 45.0, 21]]],
        ['Cambio de neumáticos', 60, [['Neumático 205/55 R16', 4, 72.0, 21], ['Montaje y equilibrado', 4, 9.0, 21]]],
        ['Diagnosis electrónica', 45, [['Diagnosis con máquina', 1, 49.0, 21]]],
        ['Carga de aire acondicionado', 60, [['Carga de gas R134a', 1, 85.0, 21]]],
    ];

    private const COMENTARIOS = [
        [5, 'Datos de ejemplo: muy buen trato y entrega a tiempo.'],
        [4, 'Datos de ejemplo: buen servicio, algo de espera al recoger.'],
        [5, 'Datos de ejemplo: me explicaron todo con detalle.'],
        [3, 'Datos de ejemplo: correcto, aunque tardaron un poco más.'],
    ];

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getWorkshop($userId) {
        $stmt = $this->conn->prepare("SELECT WorkshopID, Name FROM Workshops WHERE UserID = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc() ?: null;
    }

    private function patron($wid) {
        return 'demo' . (int)$wid . '-%@autocarehub.invalid';
    }

    public function contar($wid) {
        $patron = $this->patron($wid);
        $stmt = $this->conn->prepare(
            "SELECT (SELECT COUNT(*) FROM Users WHERE Email LIKE ?) AS Clientes,
                    (SELECT COUNT(*) FROM Appointments a JOIN Users u ON u.UserID = a.UserID WHERE u.Email LIKE ?) AS Citas,
                    (SELECT COUNT(*) FROM Invoices i JOIN Users u ON u.UserID = i.UserID WHERE u.Email LIKE ?) AS Facturas"
        );
        $stmt->bind_param("sss", $patron, $patron, $patron);
        $stmt->execute();
        return array_map('intval', $stmt->get_result()->fetch_assoc());
    }

    /** Crea todos los datos en una transacción: o se crean todos o ninguno. */
    public function crear($wid, $tallerUserId) {
        // Los modelos crean sus tablas fuera de la transacción (un CREATE TABLE la cerraría).
        $garage = new GarageModel($this->conn);
        $tracking = new TrackingModel($this->conn);
        $reviews = new ReviewModel($this->conn);

        $this->conn->begin_transaction();
        try {
            $clientes = $this->crearClientes($wid);
            $this->crearHistorico($wid, $clientes, $reviews);
            $this->crearHoy($wid, $clientes, $garage, $tracking, $tallerUserId);
            $this->conn->commit();
        } catch (Throwable $e) {
            $this->conn->rollback();
            throw $e;
        }
    }

    private function crearClientes($wid) {
        $clientes = [];
        foreach (self::CLIENTES as $i => $c) {
            $email = 'demo' . (int)$wid . '-' . ($i + 1) . '@autocarehub.invalid';
            // Contraseña aleatoria que no se guarda en ningún sitio: no se puede entrar.
            $hash = password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT);
            $stmt = $this->conn->prepare("INSERT INTO Users (Email, FullName, Password, Role) VALUES (?, ?, ?, 'Usuario')");
            $stmt->bind_param("sss", $email, $c[0], $hash);
            $stmt->execute();
            $userId = $this->conn->insert_id;

            $stmt = $this->conn->prepare("INSERT INTO Vehicles (UserID, Marca, Modelo, Anyo, Matricula) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("issis", $userId, $c[1], $c[2], $c[3], $c[4]);
            $stmt->execute();
            $clientes[] = ['user' => $userId, 'vehiculo' => $this->conn->insert_id, 'color' => $c[5]];
        }
        return $clientes;
    }

    /** Seis meses de citas finalizadas y facturadas en horas laborables, para estadísticas y mapa de calor. */
    private function crearHistorico($wid, $clientes, $reviews) {
        // Más demanda a primera hora y los lunes y viernes, para que el mapa de calor diga algo.
        $horas = [9, 9, 9, 10, 10, 11, 12, 16, 16, 17];
        $dias = [1, 1, 1, 2, 3, 4, 5, 5];
        $resenas = 0;
        for ($n = 0; $n < 48; $n++) {
            $dia = new DateTime('monday this week');
            $dia->modify('-' . (1 + intdiv($n * 26, 48)) . ' weeks');
            $dia->modify('+' . ($dias[$n % count($dias)] - 1) . ' days');
            $dia->setTime($horas[($n * 3) % count($horas)], 0);

            $cliente = $clientes[$n % count($clientes)];
            $trabajo = self::TRABAJOS[($n * 5) % count(self::TRABAJOS)];
            $citaId = $this->crearCita($wid, $cliente, $trabajo, $dia, 'Finalizada');
            // Las más recientes quedan pendientes de cobro.
            $this->crearFactura($citaId, $cliente, $trabajo, $dia, $n < 4 ? 'Pendiente' : 'Pagado');

            if ($n % 6 === 0 && $resenas < count(self::COMENTARIOS)) {
                [$nota, $texto] = self::COMENTARIOS[$resenas++];
                $reviews->create($citaId, $cliente['user'], $wid, $nota, $texto);
            }
        }
    }

    /** Los coches de hoy: en elevador, con retraso, listo, por colocar y por confirmar. */
    private function crearHoy($wid, $clientes, $garage, $tracking, $tallerUserId) {
        $ahora = new DateTime();
        $finDia = (new DateTime())->setTime(22, 0);
        $luego = min((clone $ahora)->modify('+1 hour'), $finDia);
        $manana = (new DateTime('tomorrow'))->setTime(10, 0);

        // [cliente, trabajo, inicio, estado, ¿elevado?, etapas, nota]
        $plan = [
            [0, 2, (clone $ahora)->modify('-30 minutes'), 'Confirmada', true, ['recibido', 'diagnostico', 'reparacion'], 'Pastillas cambiadas, falta probar el coche.'],
            // Con retraso: su hora de fin ya pasó y no está finalizada.
            [1, 0, (clone $ahora)->modify('-3 hours'), 'Confirmada', false, ['recibido', 'esperando_piezas'], 'Filtro pedido, llega a última hora.'],
            [2, 1, (clone $ahora)->modify('-4 hours'), 'Finalizada', false, ['recibido', 'diagnostico', 'reparacion', 'listo'], 'Ya puedes pasar a recogerlo.'],
            [3, 4, $luego, 'Confirmada', null, [], null],
            [4, 5, (clone $luego)->modify('+30 minutes'), 'Pendiente', null, [], null],
            [5, 3, $manana, 'Pendiente', null, [], null],
        ];

        $puestos = $this->puestosLibres($wid, $garage);
        foreach ($plan as [$c, $t, $inicio, $estado, $elevado, $etapas, $nota]) {
            // Las citas de hoy no pueden pasarse a ayer si se crean de madrugada.
            $hoy = (new DateTime())->setTime(0, 5);
            $inicio = max($inicio, $hoy);
            $citaId = $this->crearCita($wid, $clientes[$c], self::TRABAJOS[$t], $inicio, $estado);

            if ($elevado !== null && $puestos) {
                $puesto = array_shift($puestos);
                $garage->assign($wid, $citaId, $puesto['key'], $clientes[$c]['color']);
                if ($elevado && in_array($puesto['tipo'], ['elevador2', 'elevador4'], true)) {
                    $garage->updateCar($wid, $citaId, $clientes[$c]['color'], 1);
                }
            }
            foreach ($etapas as $i => $etapa) {
                $tracking->add($citaId, $wid, $etapa, $i === count($etapas) - 1 ? $nota : null, $tallerUserId);
            }
        }
    }

    /** Puestos sin coche, primero los elevadores. */
    private function puestosLibres($wid, $garage) {
        $layout = $garage->getLayout($wid) ?? GarageModel::defaultLayout('');
        $libres = array_filter($layout['puestos'], fn($p) => $garage->getBayOccupant($wid, $p['key']) === null);
        usort($libres, fn($a, $b) => (strpos($b['tipo'], 'elevador') === 0) <=> (strpos($a['tipo'], 'elevador') === 0));
        return $libres;
    }

    private function crearCita($wid, $cliente, $trabajo, DateTime $inicio, $estado) {
        $fin = (clone $inicio)->modify('+' . $trabajo[1] . ' minutes');
        $a = $inicio->format('Y-m-d H:i:s');
        $b = $fin->format('Y-m-d H:i:s');
        $desc = 'Cita de demostración';
        $stmt = $this->conn->prepare(
            "INSERT INTO Appointments (UserID, VehicleID, WorkshopID, Service, Status, StartDateTime, EndDateTime, Description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("iiisssss", $cliente['user'], $cliente['vehiculo'], $wid, $trabajo[0], $estado, $a, $b, $desc);
        $stmt->execute();
        return $this->conn->insert_id;
    }

    private function crearFactura($citaId, $cliente, $trabajo, DateTime $dia, $estado) {
        $total = 0.0;
        foreach ($trabajo[2] as [, $cant, $precio, $iva]) {
            $total += $cant * $precio * (1 + $iva / 100);
        }
        $fecha = $dia->format('Y-m-d');
        $stmt = $this->conn->prepare("INSERT INTO Invoices (AppointmentID, UserID, Date, TotalAmount, Estado) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("iisds", $citaId, $cliente['user'], $fecha, $total, $estado);
        $stmt->execute();
        $facturaId = $this->conn->insert_id;
        foreach ($trabajo[2] as [$concepto, $cant, $precio, $iva]) {
            $importe = $cant * $precio * (1 + $iva / 100);
            $stmt = $this->conn->prepare(
                "INSERT INTO InvoiceItems (InvoiceID, Description, Quantity, UnitPrice, TaxRate, Amount) VALUES (?, ?, ?, ?, ?, ?)"
            );
            $stmt->bind_param("isdddd", $facturaId, $concepto, $cant, $precio, $iva, $importe);
            $stmt->execute();
        }
    }

    /**
     * ¿Hay facturas reales con registro VeriFactu posterior a uno de una factura
     * demo? Borrar el registro demo rompería la cadena de huellas de las reales.
     */
    public function rompeCadenaVerifactu($wid) {
        $patron = $this->patron($wid);
        try {
            $stmt = $this->conn->prepare(
                "SELECT COUNT(*) AS N
                 FROM VerifactuRegistros real_r
                 JOIN Invoices real_i ON real_i.InvoiceID = real_r.InvoiceID
                 JOIN Users real_u ON real_u.UserID = real_i.UserID
                 WHERE real_r.WorkshopID = ? AND real_u.Email NOT LIKE ?
                   AND real_r.RegistroID > (
                       SELECT COALESCE(MIN(d.RegistroID), 2147483647)
                       FROM VerifactuRegistros d
                       JOIN Invoices di ON di.InvoiceID = d.InvoiceID
                       JOIN Users du ON du.UserID = di.UserID
                       WHERE d.WorkshopID = ? AND du.Email LIKE ?
                   )"
            );
            $stmt->bind_param("isis", $wid, $patron, $wid, $patron);
            $stmt->execute();
            return (int)$stmt->get_result()->fetch_assoc()['N'] > 0;
        } catch (Throwable $e) {
            return false; // Sin tablas de VeriFactu no hay cadena que romper
        }
    }

    /** Borra los clientes ficticios; lo demás cae en cascada. */
    public function borrar($wid) {
        $patron = $this->patron($wid);
        $stmt = $this->conn->prepare("DELETE FROM Users WHERE Email LIKE ? AND Role = 'Usuario'");
        $stmt->bind_param("s", $patron);
        $stmt->execute();
        return $stmt->affected_rows;
    }
}
?>
