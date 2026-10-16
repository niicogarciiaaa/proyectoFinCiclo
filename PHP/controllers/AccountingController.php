<?php
require_once __DIR__ . '/../models/Accounting.php';

/**
 * Controlador de la exportación para el gestor (solo rol Taller).
 * Devuelve las facturas de un trimestre con el desglose de bases e IVA por
 * tipo, listo para el libro de IVA repercutido y el modelo 303.
 */
class AccountingController {
    private $model;
    private $userId;
    private $userRole;

    public function __construct($db, $userId, $userRole) {
        $this->model    = new AccountingModel($db);
        $this->userId   = (int)$userId;
        $this->userRole = $userRole;
    }

    public function trimestre($data) {
        if ($this->userRole !== 'Taller') {
            return $this->sendResponse(403, false, "Solo los talleres pueden exportar su facturación");
        }
        $taller = $this->model->getWorkshop($this->userId);
        if (!$taller) {
            return $this->sendResponse(404, false, "No se encontró el taller asociado a tu cuenta");
        }

        $anyo = (int)($data['Anyo'] ?? 0);
        $trimestre = (int)($data['Trimestre'] ?? 0);
        if ($anyo < 2000 || $anyo > 2100 || $trimestre < 1 || $trimestre > 4) {
            return $this->sendResponse(400, false, "Año o trimestre no válido");
        }
        $mesInicio = ($trimestre - 1) * 3 + 1;
        $inicio = sprintf('%04d-%02d-01', $anyo, $mesInicio);
        $fin = date('Y-m-t', strtotime(sprintf('%04d-%02d-01', $anyo, $mesInicio + 2)));

        $wid = (int)$taller['WorkshopID'];
        $facturas = $this->model->getInvoices($wid, $inicio, $fin);
        $ids = array_keys($facturas);
        $desglose = $this->model->getTaxBreakdown($ids);
        $numSerie = $this->model->getVerifactuNumbers($ids);

        $lista = [];
        $porTipo = [];
        $totales = ['Base' => 0.0, 'Cuota' => 0.0, 'Total' => 0.0, 'Cobrado' => 0.0, 'Pendiente' => 0.0];

        foreach ($facturas as $id => $f) {
            $tipos = [];
            $base = 0.0;
            $cuota = 0.0;
            foreach ($desglose[$id] ?? [] as $d) {
                $b = round($d['Base'], 2);
                $c = round($d['Base'] * $d['Tipo'] / 100, 2);
                $tipos[] = ['Tipo' => $d['Tipo'], 'Base' => $b, 'Cuota' => $c];
                $base += $b;
                $cuota += $c;

                $k = (string)$d['Tipo'];
                if (!isset($porTipo[$k])) {
                    $porTipo[$k] = ['Tipo' => $d['Tipo'], 'Base' => 0.0, 'Cuota' => 0.0, 'Facturas' => 0];
                }
                $porTipo[$k]['Base'] += $b;
                $porTipo[$k]['Cuota'] += $c;
                $porTipo[$k]['Facturas']++;
            }
            $total = round($base + $cuota, 2);
            $pagada = $f['Estado'] === 'Pagado';

            $lista[] = [
                'InvoiceID' => $id,
                'Numero'    => $numSerie[$id] ?? ('AUTOCARE-' . $id),
                'Fecha'     => $f['Date'],
                'Estado'    => $f['Estado'],
                'Cliente'   => $f['Cliente'],
                'Email'     => $f['Email'],
                'Vehiculo'  => trim((string)$f['Vehiculo']),
                'Matricula' => $f['Matricula'],
                'Tipos'     => $tipos,
                'Base'      => round($base, 2),
                'Cuota'     => round($cuota, 2),
                'Total'     => $total,
                'VeriFactu' => isset($numSerie[$id]),
            ];

            $totales['Base'] += $base;
            $totales['Cuota'] += $cuota;
            $totales['Total'] += $total;
            $totales[$pagada ? 'Cobrado' : 'Pendiente'] += $total;
        }

        krsort($porTipo, SORT_NUMERIC);
        $resumen = array_map(function ($t) {
            return [
                'Tipo'     => $t['Tipo'],
                'Base'     => round($t['Base'], 2),
                'Cuota'    => round($t['Cuota'], 2),
                'Total'    => round($t['Base'] + $t['Cuota'], 2),
                'Facturas' => $t['Facturas'],
            ];
        }, array_values($porTipo));

        $emisor = $this->model->getEmisor($wid);
        $this->sendResponse(200, true, "", [
            'periodo'  => ['anyo' => $anyo, 'trimestre' => $trimestre, 'inicio' => $inicio, 'fin' => $fin],
            'taller'   => [
                'Nombre'      => $taller['Name'],
                'Direccion'   => $taller['Address'],
                'NIF'         => $emisor['NIF'] ?? null,
                'RazonSocial' => $emisor['RazonSocial'] ?? null,
            ],
            'facturas' => $lista,
            'resumen'  => $resumen,
            'totales'  => array_map(fn($v) => round($v, 2), $totales) + ['Facturas' => count($lista)],
        ]);
    }

    private function sendResponse($code, $success, $message, $data = []) {
        http_response_code($code);
        echo json_encode(array_merge(["success" => $success, "message" => $message], $data));
        return true;
    }
}
?>
