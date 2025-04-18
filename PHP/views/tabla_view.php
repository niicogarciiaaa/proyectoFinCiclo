<h2>Contenido de la tabla: <?= htmlspecialchars($tablaSeleccionada) ?></h2>

<?php if (empty($datos['filas'])): ?>
    <p>No hay datos en la tabla o ocurrió un error.</p>
<?php else: ?>
    <table border="1" cellpadding="5" cellspacing="0">
        <tr>
            <?php foreach (array_keys($datos['filas'][0]) as $campo): ?>
                <th><?= htmlspecialchars($campo) ?></th>
            <?php endforeach; ?>
        </tr>
        <?php foreach ($datos['filas'] as $fila): ?>
            <tr>
                <?php foreach ($fila as $valor): ?>
                    <td><?= htmlspecialchars($valor) ?></td>
                <?php endforeach; ?>
            </tr>
        <?php endforeach; ?>
    </table>
<?php endif; ?>
