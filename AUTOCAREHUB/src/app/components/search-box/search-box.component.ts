import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Caja de búsqueda reutilizable para las listas (citas, facturas...).
 * Muestra cuántos resultados hay y un botón para limpiar.
 */
@Component({
  selector: 'app-search-box',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-box" role="search">
      <i class="bi bi-search" aria-hidden="true"></i>
      <input
        type="search"
        [attr.aria-label]="placeholder"
        [placeholder]="placeholder"
        [ngModel]="valor"
        (ngModelChange)="valorChange.emit($event)"
        (keydown.escape)="valorChange.emit('')"
      />
      <button type="button" *ngIf="valor" class="limpiar" (click)="valorChange.emit('')" aria-label="Limpiar búsqueda">
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
    </div>
    <p class="resultado" *ngIf="valor" role="status">
      {{ encontrados }} de {{ total }} {{ encontrados === 1 ? 'resultado' : 'resultados' }}
    </p>
  `,
  styles: [`
    :host { display: block; margin-bottom: 12px; }
    .search-box {
      display: flex; align-items: center; gap: 8px;
      max-width: 460px; padding: 6px 10px;
      border: 1px solid #ced4da; border-radius: 8px; background: #fff;
    }
    .search-box:focus-within { border-color: #fb8c00; box-shadow: 0 0 0 3px rgba(251, 140, 0, .2); }
    .search-box i.bi-search { color: #888; }
    input { flex: 1; border: 0; outline: 0; background: transparent; font-size: 15px; min-width: 0; color: inherit; }
    input::-webkit-search-cancel-button { display: none; }
    .limpiar { border: 0; background: transparent; color: #888; padding: 0 2px; cursor: pointer; }
    .limpiar:hover { color: #333; }
    .resultado { margin: 6px 2px 0; font-size: 13px; color: #6c757d; }
  `],
})
export class SearchBoxComponent {
  @Input() valor = '';
  @Output() valorChange = new EventEmitter<string>();
  @Input() placeholder = 'Buscar...';
  @Input() total = 0;
  @Input() encontrados = 0;
}
