using Microsoft.EntityFrameworkCore;

namespace AutoCareHubAPI
{
    public class AutoCareHubContext : DbContext
    {
        public AutoCareHubContext(DbContextOptions<AutoCareHubContext> options) : base(options) { }

        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<Vehiculo> Vehiculos { get; set; }
        public DbSet<Cita> Citas { get; set; }
        public DbSet<Taller> Talleres { get; set; }
        public DbSet<Factura> Facturas { get; set; }
        public DbSet<Pago> Pagos { get; set; }
        public DbSet<PiezaRepuesto> PiezasRepuesto { get; set; }
    }

    public class Usuario
    {
        public int Id { get; set; }
        public string Nombre { get; set; }
        public string Correo { get; set; }
        public string Contrasena { get; set; }
        public string Rol { get; set; }
    }

    public class Vehiculo
    {
        public int Id { get; set; }
        public string Marca { get; set; }
        public string Modelo { get; set; }
        public string Matricula { get; set; }
        public int UsuarioId { get; set; }
        
    }

    public class Cita
    {
        public int Id { get; set; }
        public int UsuarioId { get; set; }
        public int TallerId { get; set; }
        public DateTime Fecha { get; set; }
        public string Estado { get; set; }
        
    }

    public class Taller
    {
        public int Id { get; set; }
        public string Nombre { get; set; }
        public string Direccion { get; set; }
        public string Telefono { get; set; }
    }

    public class Factura
    {
        public int Id { get; set; }
        public int CitaId { get; set; }
        public decimal Total { get; set; }
        public DateTime FechaEmision { get; set; }
    }

    public class Pago
    {
        public int Id { get; set; }
        public int FacturaId { get; set; }
        public string MetodoPago { get; set; }
        public DateTime FechaPago { get; set; }
    }

    public class PiezaRepuesto
    {
        public int Id { get; set; }
        public string Nombre { get; set; }
        public int Cantidad { get; set; }
        public int TallerId { get; set; }
        
    }
}
