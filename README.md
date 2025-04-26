# proyectoFinCiclo
Este es el repositorio que tengo para el proyecto de final de  ciclo.


if ($accion === 'crear_invoices') {
    $sqlInvoices = "CREATE TABLE IF NOT EXISTS Invoices (
        InvoiceID INT AUTO_INCREMENT PRIMARY KEY,
        AppointmentID INT NOT NULL,
        Date DATE NOT NULL,
        TotalAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        Estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente',
        FOREIGN KEY (AppointmentID) REFERENCES Appointments(AppointmentID) ON DELETE CASCADE
    )";
    if ($conn->query($sqlInvoices)) {
        echo "✅ Tabla 'Invoices' creada correctamente<br>";
    } else {
        echo "❌ Error creando tabla 'Invoices': " . $conn->error . "<br>";
    }
}

if ($accion === 'crear_invoice_items') {
    $sqlInvoiceItems = "CREATE TABLE IF NOT EXISTS InvoiceItems (
        ItemID INT AUTO_INCREMENT PRIMARY KEY,
        InvoiceID INT NOT NULL,
        Description TEXT NOT NULL,
        Quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
        UnitPrice DECIMAL(10,2) NOT NULL,
        TaxRate DECIMAL(5,2) NOT NULL DEFAULT 21.00,
        Amount DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (InvoiceID) REFERENCES Invoices(InvoiceID) ON DELETE CASCADE
    )";
    if ($conn->query($sqlInvoiceItems)) {
        echo "✅ Tabla 'InvoiceItems' creada correctamente<br>";
    } else {
        echo "❌ Error creando tabla 'InvoiceItems': " . $conn->error . "<br>";
    }
}
