using AutoCareHubAPI;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AutoCareHubAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public abstract class BaseController<T> : ControllerBase where T : class
    {
        protected readonly AutoCareHubContext _context;
        protected readonly DbSet<T> _dbSet;

        protected BaseController(AutoCareHubContext context, DbSet<T> dbSet)
        {
            _context = context;
            _dbSet = dbSet;
        }

        [HttpGet]
        public virtual async Task<ActionResult<IEnumerable<T>>> GetAll()
        {
            try
            {
                return await _dbSet.ToListAsync();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno del servidor: {ex.Message}");
            }
        }

        [HttpGet("{id}")]
        public virtual async Task<ActionResult<T>> GetById(int id)
        {
            try
            {
                var entity = await _dbSet.FindAsync(id);
                if (entity == null)
                {
                    return NotFound($"No se encontró la entidad con ID: {id}");
                }
                return entity;
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno del servidor: {ex.Message}");
            }
        }

        [HttpPost]
        public virtual async Task<ActionResult<T>> Create([FromBody] T entity)
        {
            try
            {
                _dbSet.Add(entity);
                await _context.SaveChangesAsync();
                
                // Utilizamos reflection para obtener el ID
                var idProperty = entity.GetType().GetProperty("Id");
                var id = idProperty?.GetValue(entity);
                
                return CreatedAtAction(nameof(GetById), new { id }, entity);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno del servidor: {ex.Message}");
            }
        }

        [HttpPut("{id}")]
        public virtual async Task<IActionResult> Update(int id, [FromBody] T entity)
        {
            try
            {
                var idProperty = entity.GetType().GetProperty("Id");
                var entityId = (int?)idProperty?.GetValue(entity);

                if (id != entityId)
                {
                    return BadRequest("El ID de la ruta no coincide con el ID de la entidad");
                }

                _context.Entry(entity).State = EntityState.Modified;

                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!await EntityExists(id))
                    {
                        return NotFound($"No se encontró la entidad con ID: {id}");
                    }
                    throw;
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno del servidor: {ex.Message}");
            }
        }

        [HttpDelete("{id}")]
        public virtual async Task<IActionResult> Delete(int id)
        {
            try
            {
                var entity = await _dbSet.FindAsync(id);
                if (entity == null)
                {
                    return NotFound($"No se encontró la entidad con ID: {id}");
                }

                _dbSet.Remove(entity);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno del servidor: {ex.Message}");
            }
        }

        protected virtual async Task<bool> EntityExists(int id)
        {
            return await _dbSet.FindAsync(id) != null;
        }
    }

    public class UsuariosController : BaseController<Usuario>
    {
        public UsuariosController(AutoCareHubContext context) 
            : base(context, context.Usuarios) { }

        // Nuevo método para iniciar sesión
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                // Buscar el usuario por nombre de usuario
                var user = await _context.Usuarios
                    .FirstOrDefaultAsync(u => u.NombreUsuario == request.Username);

                if (user == null)
                {
                    return Unauthorized("Usuario no encontrado.");
                }

                // Aquí debes comparar las contraseñas (asegurate de utilizar un hash en producción)
                if (user.Contrasena != request.Password)
                {
                    return Unauthorized("Contraseña incorrecta.");
                }

                return Ok(new { message = "Login exitoso", user });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno del servidor: {ex.Message}");
            }
        }
    }

    // Clase para las credenciales de login
    public class LoginRequest
    {
        public string Username { get; set; }
        public string Password { get; set; }
    }

    public class VehiculosController : BaseController<Vehiculo>
    {
        public VehiculosController(AutoCareHubContext context) 
            : base(context, context.Vehiculos) { }
    }

    public class CitasController : BaseController<Cita>
    {
        public CitasController(AutoCareHubContext context) 
            : base(context, context.Citas) { }
    }

    public class PagosController : BaseController<Pago>
    {
        public PagosController(AutoCareHubContext context) 
            : base(context, context.Pagos) { }
    }

    public class PiezasRepuestoController : BaseController<PiezaRepuesto>
    {
        public PiezasRepuestoController(AutoCareHubContext context) 
            : base(context, context.PiezasRepuesto) { }
    }

    public class TalleresController : BaseController<Taller>
    {
        public TalleresController(AutoCareHubContext context) 
            : base(context, context.Talleres) { }
    }

    public class FacturasController : BaseController<Factura>
    {
        public FacturasController(AutoCareHubContext context) 
            : base(context, context.Facturas) { }
    }
}
