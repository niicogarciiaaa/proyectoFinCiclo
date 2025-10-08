<?php
/**
 * download_invoice.php
 * Genera y descarga una factura en formato PDF
 */

session_start();
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/Invoice.php';
require_once __DIR__ . '/lib/fpdf.php';

// Verificar que el usuario esté autenticado
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    http_response_code(401);
    die('Debe iniciar sesión para descargar facturas.');
}

// Verificar que se proporcionó un ID de factura
if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
    http_response_code(400);
    die('ID de factura no válido.');
}

$invoiceId = intval($_GET['id']);
$userId = $_SESSION['user']['id'];
$userRole = $_SESSION['user']['role'];

// Conectar a la base de datos
$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    http_response_code(500);
    die('Error al conectar con la base de datos.');
}

try {
    // Obtener los datos de la factura
    $invoiceModel = new InvoiceModel($conn);
    $invoices = $invoiceModel->getInvoices($userRole, $userId);
    
    // Buscar la factura específica
    $invoice = null;
    foreach ($invoices as $inv) {
        if ($inv['InvoiceID'] == $invoiceId) {
            $invoice = $inv;
            break;
        }
    }
    
    if (!$invoice) {
        http_response_code(404);
        die('Factura no encontrada o no tiene permisos para acceder a ella.');
    }
    
    // Crear el PDF
    $pdf = new FPDF('P', 'mm', 'A4');
    $pdf->AddPage();
    $pdf->SetMargins(15, 15, 15);
    
    // Configurar fuente para el título
    $pdf->SetFont('helvetica', 'B', 20);
    $pdf->Cell(0, 10, 'FACTURA', 0, 1, 'C');
    $pdf->Ln(5);
    
    // Información de la factura
    $pdf->SetFont('helvetica', 'B', 12);
    $pdf->Cell(0, 8, 'Informacion de la Factura', 0, 1);
    $pdf->SetFont('helvetica', '', 10);
    $pdf->Cell(50, 6, 'Numero de factura:', 0, 0);
    $pdf->SetFont('helvetica', 'B', 10);
    $pdf->Cell(0, 6, '#' . $invoice['InvoiceID'], 0, 1);
    $pdf->SetFont('helvetica', '', 10);
    $pdf->Cell(50, 6, 'Fecha:', 0, 0);
    $pdf->Cell(0, 6, date('d/m/Y', strtotime($invoice['Date'])), 0, 1);
    $pdf->Cell(50, 6, 'Estado:', 0, 0);
    $pdf->Cell(0, 6, $invoice['Estado'], 0, 1);
    $pdf->Ln(5);
    
    // Información del taller
    if (isset($invoice['WorkshopName'])) {
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->Cell(0, 8, 'Datos del Taller', 0, 1);
        $pdf->SetFont('helvetica', '', 10);
        $pdf->Cell(50, 6, 'Nombre:', 0, 0);
        $pdf->Cell(0, 6, $invoice['WorkshopName'], 0, 1);
        if (isset($invoice['WorkshopAddress'])) {
            $pdf->Cell(50, 6, 'Direccion:', 0, 0);
            $pdf->Cell(0, 6, $invoice['WorkshopAddress'], 0, 1);
        }
        if (isset($invoice['WorkshopPhone'])) {
            $pdf->Cell(50, 6, 'Telefono:', 0, 0);
            $pdf->Cell(0, 6, $invoice['WorkshopPhone'], 0, 1);
        }
        $pdf->Ln(5);
    }
    
    // Información del cliente (solo para talleres)
    if ($userRole === 'Taller' && isset($invoice['UserName'])) {
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->Cell(0, 8, 'Datos del Cliente', 0, 1);
        $pdf->SetFont('helvetica', '', 10);
        $pdf->Cell(50, 6, 'Cliente:', 0, 0);
        $pdf->Cell(0, 6, $invoice['UserName'], 0, 1);
        $pdf->Ln(5);
    }
    
    // Información del vehículo
    if (isset($invoice['Modelo'])) {
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->Cell(0, 8, 'Datos del Vehiculo', 0, 1);
        $pdf->SetFont('helvetica', '', 10);
        if (isset($invoice['Marca'])) {
            $pdf->Cell(50, 6, 'Marca:', 0, 0);
            $pdf->Cell(0, 6, $invoice['Marca'], 0, 1);
        }
        $pdf->Cell(50, 6, 'Modelo:', 0, 0);
        $pdf->Cell(0, 6, $invoice['Modelo'], 0, 1);
        if (isset($invoice['Anyo'])) {
            $pdf->Cell(50, 6, 'Ano:', 0, 0);
            $pdf->Cell(0, 6, $invoice['Anyo'], 0, 1);
        }
        $pdf->Ln(5);
    }
    
    // Línea separadora
    $pdf->Line(15, $pdf->GetY(), 195, $pdf->GetY());
    $pdf->Ln(5);
    
    // Detalles de productos/servicios
    $pdf->SetFont('helvetica', 'B', 12);
    $pdf->Cell(0, 8, 'Detalle de Productos/Servicios', 0, 1);
    $pdf->SetFont('helvetica', '', 9);
    
    // Encabezado de la tabla
    $pdf->SetFillColor(220, 220, 220);
    $pdf->SetFont('helvetica', 'B', 9);
    $pdf->Cell(85, 7, 'Descripcion', 1, 0, 'L', true);
    $pdf->Cell(20, 7, 'Cant.', 1, 0, 'C', true);
    $pdf->Cell(25, 7, 'Precio Unit.', 1, 0, 'R', true);
    $pdf->Cell(20, 7, 'IVA %', 1, 0, 'C', true);
    $pdf->Cell(30, 7, 'Total', 1, 1, 'R', true);
    
    // Contenido de la tabla
    $pdf->SetFont('helvetica', '', 9);
    $subtotal = 0;
    
    if (isset($invoice['items']) && !empty($invoice['items'])) {
        foreach ($invoice['items'] as $item) {
            $pdf->Cell(85, 6, substr($item['Description'], 0, 40), 1, 0, 'L');
            $pdf->Cell(20, 6, number_format($item['Quantity'], 2), 1, 0, 'C');
            $pdf->Cell(25, 6, number_format($item['UnitPrice'], 2) . ' EUR', 1, 0, 'R');
            $pdf->Cell(20, 6, number_format($item['TaxRate'], 0) . '%', 1, 0, 'C');
            $pdf->Cell(30, 6, number_format($item['Amount'], 2) . ' EUR', 1, 1, 'R');
            $subtotal += $item['Amount'];
        }
    }
    
    // Línea separadora
    $pdf->Ln(5);
    $pdf->Line(15, $pdf->GetY(), 195, $pdf->GetY());
    $pdf->Ln(5);
    
    // Total
    $pdf->SetFont('helvetica', 'B', 12);
    $pdf->Cell(150, 8, 'TOTAL:', 0, 0, 'R');
    $pdf->Cell(30, 8, number_format($invoice['TotalAmount'], 2) . ' EUR', 0, 1, 'R');
    
    // Pie de página
    $pdf->Ln(10);
    $pdf->SetFont('helvetica', 'I', 8);
    $pdf->Cell(0, 5, 'Generado por AutocareHub - Sistema de Gestion de Talleres', 0, 1, 'C');
    $pdf->Cell(0, 5, 'Fecha de generacion: ' . date('d/m/Y H:i:s'), 0, 1, 'C');
    
    // Generar el nombre del archivo
    $workshopName = isset($invoice['WorkshopName']) ? $invoice['WorkshopName'] : 'Taller';
    $workshopName = preg_replace('/[^A-Za-z0-9_-]/', '_', $workshopName);
    $fileName = 'Factura_' . $workshopName . '_' . $invoiceId . '.pdf';
    
    // Enviar el PDF al navegador
    $pdf->Output('D', $fileName);
    
} catch (Exception $e) {
    http_response_code(500);
    die('Error al generar la factura: ' . $e->getMessage());
}
?>
