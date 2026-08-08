<?php
// invoiceView.php contenido ejemplo para MVC
session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/InvoiceController.php';

if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    echo "<p>Debe iniciar sesión para ver esta página.</p>";
    exit();
}

$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    echo "<p>Error al conectar con la base de datos.</p>";
    exit();
}

try {
    $controller = new InvoiceController(
        $conn,
        $_SESSION['user']['id'],
        $_SESSION['user']['role']
    );

    if ($_SESSION['user']['role'] === 'Taller') {
        // Mostrar formulario de creación de facturas y listado
?>
        <div class="invoices-container">
            <h2>Gestión de Facturas</h2>
            <div class="stats-container">
                <?php
                $stats = json_decode($controller->obtenerEstadisticas(), true);
                if ($stats['success']) {
                ?>
                    <div class="stat-card">
                        <h3>Total Facturas</h3>
                        <p><?php echo $stats['stats']['total_facturas']; ?></p>
                    </div>
                    <div class="stat-card">
                        <h3>Total Facturado</h3>
                        <p><?php echo number_format($stats['stats']['total_facturado'], 2); ?>€</p>
                    </div>
                <?php } ?>
            </div>

            <div class="search-container">
                <h3>Buscar Facturas</h3>
                <form id="searchForm">
                    <input type="date" name="start_date" id="start_date">
                    <input type="date" name="end_date" id="end_date">
                    <select name="estado" id="estado">
                        <option value="">Todos los estados</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="Pagada">Pagada</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                    <button type="submit">Buscar</button>
                </form>
            </div>

            <div id="invoicesList">
                <!-- Las facturas se cargarán aquí dinámicamente -->
            </div>
        </div>

        <script>
        document.getElementById('searchForm')?.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const queryParams = new URLSearchParams(formData);
            
            fetch(`Invoices.php?tipo=buscar&${queryParams.toString()}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        displayInvoices(data.invoices);
                    } else {
                        alert('Error: ' + data.message);
                    }
                });
        });

        function displayInvoices(invoices) {
            const container = document.getElementById('invoicesList');
            container.innerHTML = '';
            
            invoices.forEach(invoice => {
                const card = document.createElement('div');
                card.className = 'invoice-card';
                card.innerHTML = `
                    <h3>Factura #${invoice.InvoiceID}</h3>
                    <p><strong>Cliente:</strong> ${invoice.ClientName}</p>
                    <p><strong>Fecha:</strong> ${new Date(invoice.Date).toLocaleDateString()}</p>
                    <p><strong>Total:</strong> ${invoice.TotalAmount.toFixed(2)}€</p>
                    <p><strong>Estado:</strong> ${invoice.Status}</p>
                `;
                container.appendChild(card);
            });
        }
        </script>
<?php
    } else {
        // Mostrar listado de facturas del cliente
        $result = json_decode($controller->listar(), true);
?>
        <div class="invoices-container">
            <h2>Mis Facturas</h2>
            <?php if ($result['success'] && !empty($result['invoices'])): ?>
                <div class="invoices-grid">
                    <?php foreach ($result['invoices'] as $invoice): ?>
                        <div class="invoice-card">
                            <h3>Factura #<?php echo $invoice['InvoiceID']; ?></h3>
                            <p><strong>Fecha:</strong> <?php echo date('d/m/Y', strtotime($invoice['Date'])); ?></p>
                            <p><strong>Total:</strong> <?php echo number_format($invoice['TotalAmount'], 2); ?>€</p>
                            <p><strong>Estado:</strong> <?php echo $invoice['Status']; ?></p>
                            <button onclick="downloadInvoice(<?php echo $invoice['InvoiceID']; ?>)">Descargar PDF</button>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php else: ?>
                <p>No hay facturas disponibles.</p>
            <?php endif; ?>
        </div>

        <script>
        function downloadInvoice(invoiceId) {
            window.location.href = `download_invoice.php?id=${invoiceId}`;
        }
        </script>
<?php
    }
} catch (Exception $e) {
    echo "<p>Error: " . $e->getMessage() . "</p>";
}
?>