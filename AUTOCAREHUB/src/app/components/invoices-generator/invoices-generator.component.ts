import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DataAccessService, Invoice } from '../../services/dataAccess.service';
import { InvoicePdfService } from '../../services/invoice-pdf.service';
import { MenuComponent } from '../menu/menu.component';
import { AppointmentsViewerComponent } from '../appointments-viewer/appointments-viewer.component';

interface InvoiceItemWorkshop {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

@Component({
  selector: 'app-invoices-generator',
  standalone: true,
  templateUrl: './invoices-generator.component.html',
  styleUrls: ['./invoices-generator.component.css'],
  imports: [FormsModule, CommonModule, MenuComponent],
})
export class InvoicesGeneratorComponent implements OnInit {
  facturas: Invoice[] = [];
  appointment_id: number | null = null;
  items: InvoiceItemWorkshop[] = [];
  estado: string = 'Pendiente';
  citasTaller: any[] = [];
  errorCitas: string = '';

  // Campos para el nuevo ítem
  newItemDescription: string = '';
  newItemQuantity: number = 1;
  newItemPrice: number = 0;
  newItemTaxRate: number = 21; // IVA predeterminado

  // Catálogo de servicios del taller para autocompletar ítems
  services: any[] = [];
  selectedServiceId: number | 'manual' = 'manual';

  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  isTaller: boolean = false;

  // Precarga de borrador desde una cita finalizada (?appointmentId=)
  private pendingAppointmentId: number | null = null;
  private citasCargadas = false;
  private serviciosCargados = false;
  prefillNotice: string = '';

  constructor(
    private dataAccessService: DataAccessService,
    private invoicePdf: InvoicePdfService,
    private route: ActivatedRoute
  ) {}

  /**
   * Descarga el PDF de una factura (lado taller). Antes genera/recupera el
   * registro VeriFactu para incrustar el QR de verificación de la AEAT.
   */
  descargarPDF(factura: Invoice): void {
    this.dataAccessService.generarVerifactu(factura.InvoiceID).subscribe({
      next: (res) => {
        const registro = res && res.success ? res.registro : null;
        if (!registro) {
          this.errorMessage =
            res?.message || 'Configura tus datos fiscales (NIF) para emitir con VeriFactu.';
        }
        this.invoicePdf.generatePDF(factura, registro);
      },
      error: () => {
        // Si VeriFactu falla, se descarga el PDF sin QR para no bloquear.
        this.invoicePdf.generatePDF(factura);
      },
    });
  }

  ngOnInit(): void {
    this.obtenerFacturas();

    // Comprobar si el usuario es un taller
    const currentUser = this.dataAccessService.getCurrentUser();
    if (currentUser && currentUser.role === 'Taller') {
      this.isTaller = true;
    } else {
      console.warn(
        'Este componente está diseñado para usuarios con rol de Taller'
      );
    }
    // ¿Venimos de "Facturar" una cita finalizada? (borrador automático)
    const idParam = this.route.snapshot.queryParamMap.get('appointmentId');
    this.pendingAppointmentId = idParam ? +idParam : null;

    if (this.isTaller) {
      this.obtenerCitasDelTaller();
      this.cargarServicios();
    }
  }

  /** Carga el catálogo de servicios del taller para autocompletar ítems. */
  cargarServicios(): void {
    this.dataAccessService.obtenerConfigAgenda().subscribe({
      next: (res) => {
        if (res && res.success) {
          this.services = (res.services || []).filter((s: any) => s.IsActive);
        }
      },
      error: () => {},
      complete: () => {
        this.serviciosCargados = true;
        this.precargarDesdeCita();
      },
    });
  }

  /**
   * Si se llegó con ?appointmentId=, precarga el borrador: selecciona la cita y
   * añade automáticamente el servicio realizado como ítem de la factura.
   * Espera a que estén cargadas tanto las citas como el catálogo de servicios.
   */
  private precargarDesdeCita(): void {
    if (this.pendingAppointmentId === null) return;
    if (!this.citasCargadas || !this.serviciosCargados) return;

    const cita = this.citasTaller.find(
      (c) => +c.AppointmentID === this.pendingAppointmentId
    );
    if (!cita) return;

    this.appointment_id = cita.AppointmentID;

    // Añadir el servicio de la cita como ítem (si está en el catálogo y no hay ítems aún).
    if (this.items.length === 0 && cita.ServiceID) {
      const serv = this.services.find((s) => +s.ServiceID === +cita.ServiceID);
      if (serv) {
        this.items.push({
          description: serv.Name,
          quantity: 1,
          unit_price: serv.Price != null ? serv.Price : 0,
          tax_rate: 21,
        });
      }
    }

    this.prefillNotice = `Borrador precargado desde la cita #${cita.AppointmentID}. Revisa los ítems antes de crear la factura.`;
    this.pendingAppointmentId = null; // evitar repetir
  }

  /**
   * Al elegir un servicio del catálogo, autocompleta los campos del nuevo ítem.
   * Con 'manual' se rellenan a mano como siempre.
   */
  onServiceSelected(): void {
    if (this.selectedServiceId === 'manual') {
      this.newItemDescription = '';
      this.newItemPrice = 0;
      return;
    }
    const serv = this.services.find((s) => s.ServiceID === +this.selectedServiceId);
    if (serv) {
      this.newItemDescription = serv.Name;
      this.newItemPrice = serv.Price != null ? serv.Price : 0;
      this.newItemQuantity = 1;
      this.newItemTaxRate = 21;
    }
  }

  /** Devuelve la cita seleccionada (para mostrar su resumen). */
  get citaSeleccionada(): any {
    return this.citasTaller.find((c) => c.AppointmentID === +(this.appointment_id ?? 0));
  }

  /** Formatea fecha+hora de una cita para el desplegable. */
  formatCita(c: any): string {
    const fecha = (c.StartDateTime || '').substring(0, 16).replace('T', ' ');
    return `#${c.AppointmentID} · ${fecha} · ${c.Vehiculo} · ${c.UserName}`;
  }

  /**  Método para obtener todas las facturas */
  obtenerFacturas(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.dataAccessService.obtenerFacturas().subscribe({
      next: (response) => {
        this.facturas = response.invoices || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al obtener las facturas:', error);
        this.errorMessage =
          error.message || 'Hubo un error al recuperar las facturas';
        this.isLoading = false;
      },
    });
  }

  /**Método para crear una nueva factura */
  crearFactura(): void {
    if (!this.appointment_id) {
      this.errorMessage = 'Debes proporcionar el ID de la cita';
      return;
    }

    if (this.items.length === 0) {
      this.errorMessage = 'Debes añadir al menos un ítem a la factura';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.dataAccessService
      .crearFactura(this.appointment_id, this.items, this.estado)
      .subscribe({
        next: (response) => {
          console.log('Respuesta del servidor:', response);
          this.successMessage = 'Factura creada con éxito';
          this.resetForm();
          this.obtenerFacturas(); // Recargar las facturas
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error al crear la factura:', error);
          this.errorMessage = error.message || 'Error al crear la factura';
          this.isLoading = false;
        },
      });
  }

  /**Método para agregar un ítem a la factura*/
  agregarItem(): void {
    if (
      !this.newItemDescription ||
      this.newItemQuantity <= 0 ||
      this.newItemPrice < 0 ||
      this.newItemTaxRate < 0
    ) {
      this.errorMessage = 'Todos los campos del ítem deben ser válidos.';
      return;
    }

    this.items.push({
      description: this.newItemDescription,
      quantity: this.newItemQuantity,
      unit_price: this.newItemPrice,
      tax_rate: this.newItemTaxRate,
    });

    // Limpiar campos del ítem
    this.newItemDescription = '';
    this.newItemQuantity = 1;
    this.newItemPrice = 0;
    this.newItemTaxRate = 21;
    this.selectedServiceId = 'manual';
  }

  /**  Método para eliminar un ítem de la lista */
  eliminarItem(index: number): void {
    this.items.splice(index, 1);
  }

  /**Método para calcular el subtotal (sin IVA)*/
  calcularSubtotal(): number {
    return this.items.reduce((total, item) => {
      return total + item.quantity * item.unit_price;
    }, 0);
  }

  /**  Método para calcular el IVA total */
  calcularIVA(): number {
    return this.items.reduce((total, item) => {
      return total + item.quantity * item.unit_price * (item.tax_rate / 100);
    }, 0);
  }

  /**Método para calcular el total con IVA*/
  calcularTotal(): number {
    return this.calcularSubtotal() + this.calcularIVA();
  }
  obtenerCitasDelTaller(): void {
    this.dataAccessService.obtenerCitasTallerAgenda().subscribe({
      next: (respuesta) => {
        if (respuesta) {
          this.citasTaller = respuesta.citas || [];
          console.log('Citas del taller:', this.citasTaller);
        } else {
          this.errorCitas =
            respuesta.message || 'No se pudieron obtener las citas del taller';
        }
      },
      error: (error) => {
        this.errorCitas = error.message || 'Error al obtener las citas';
      },
      complete: () => {
        this.citasCargadas = true;
        this.precargarDesdeCita();
      },
    });
  }

  /** Método para resetear el formulario*/
  resetForm(): void {
    this.appointment_id = null;
    this.items = [];
    this.estado = 'Pendiente';
    this.newItemDescription = '';
    this.newItemQuantity = 1;
    this.newItemPrice = 0;
    this.newItemTaxRate = 21;
    this.selectedServiceId = 'manual';
    this.errorMessage = '';
    this.prefillNotice = '';
  }
}
