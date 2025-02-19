using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AutoCareHub.Data
{
    public class AutoCareHubContext : DbContext
    {
        public AutoCareHubContext(DbContextOptions<AutoCareHubContext> options) : base(options) { }

        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<Taller> Talleres { get; set; }
        public DbSet<Cita> Citas { get; set; }
        public DbSet<Vehiculo> Vehiculos { get; set; }
        public DbSet<Factura> Facturas { get; set; }
        public DbSet<Pago> Pagos { get; set; }
        public DbSet<PiezaRepuesto> PiezasRepuesto { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Usuario>().HasIndex(u => u.Correo).IsUnique();
            modelBuilder.Entity<Cita>().HasOne(c => c.Usuario).WithMany(u => u.Citas).HasForeignKey(c => c.UsuarioId);
            modelBuilder.Entity<Cita>().HasOne(c => c.Taller).WithMany(t => t.Citas).HasForeignKey(c => c.TallerId);
            modelBuilder.Entity<Factura>().HasOne(f => f.Cita).WithOne().HasForeignKey<Factura>(f => f.CitaId);
            modelBuilder.Entity<Pago>().HasOne(p => p.Factura).WithMany().HasForeignKey(p => p.FacturaId);
        }
    }

    public class Usuario
    {
        public int Id { get; set; }
        [Required, MaxLength(100)]
        public string Nombre { get; set; }
        [Required, EmailAddress]
        public string Correo { get; set; }
        [Required]
        public string Contrasena { get; set; }
        [Required]
        public string Rol { get; set; } // Cliente o Taller
        public List<Cita> Citas { get; set; } = new();
        public List<Vehiculo> Vehiculos { get; set; } = new();
    }

    public class Taller
    {
        public int Id { get; set; }
        [Required]
        public string Nombre { get; set; }
        public string Direccion { get; set; }
        public string Telefono { get; set; }
        public List<Cita> Citas { get; set; } = new();
        public List<PiezaRepuesto> Inventario { get; set; } = new();
    }

    public class Cita
    {
        public int Id { get; set; }
        public int UsuarioId { get; set; }
        public Usuario Usuario { get; set; }
        public int TallerId { get; set; }
        public Taller Taller { get; set; }
        public DateTime Fecha { get; set; }
        [Required]
        public string Estado { get; set; } // Pendiente, Confirmada, Cancelada
    }

    public class Vehiculo
    {
        public int Id { get; set; }
        public string Marca { get; set; }
        public string Modelo { get; set; }
        public string Matricula { get; set; }
        public int UsuarioId { get; set; }
        public Usuario Usuario { get; set; }
    }

    public class Factura
    {
        public int Id { get; set; }
        public int CitaId { get; set; }
        public Cita Cita { get; set; }
        [Precision(18, 2)]
        public decimal Total { get; set; }
        public DateTime FechaEmision { get; set; }
    }

    public class Pago
    {
        public int Id { get; set; }
        public int FacturaId { get; set; }
        public Factura Factura { get; set; }
        public string MetodoPago { get; set; } // Tarjeta, Transferencia
        public DateTime FechaPago { get; set; }
    }

    public class PiezaRepuesto
    {
        public int Id { get; set; }
        public string Nombre { get; set; }
        public int Cantidad { get; set; }
        public int TallerId { get; set; }
        public Taller Taller { get; set; }
    }
}