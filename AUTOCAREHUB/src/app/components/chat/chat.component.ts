import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataAccessService, Chat, Message } from '../../services/dataAccess.service';
import { MenuComponent } from '../menu/menu.component';
import { interval, Subscription } from 'rxjs';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuComponent],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
})
export class ChatComponent implements OnInit, OnDestroy {
  chats: Chat[] = [];
  mensajes: Message[] = [];
  selectedChat: Chat | null = null;
  nuevoMensaje: string = '';
  userRole: string = '';
  userId: number = 0;
  mostrandoModalTalleres = false;
  talleres: any[] = [];
  talleresFiltrados: any[] = [];
  busquedaTaller = '';

  private actualizacionAutomatica: Subscription | undefined;
  private actualizacionMensajes: Subscription | undefined;

  constructor(
    private dataService: DataAccessService,
    public i18n: I18nService
  ) {}

  ngOnInit() {
    const user = this.dataService.getCurrentUser();
    if (user) {
      this.userRole = user.role;
      this.userId = user.id;
      this.cargarChats();
      if (this.userRole !== 'Taller') {
        this.cargarTalleres();
      }
    }
    this.iniciarActualizacionAutomatica();
  }

  ngOnDestroy() {
    if (this.actualizacionAutomatica) {
      this.actualizacionAutomatica.unsubscribe();
    }
    if (this.actualizacionMensajes) {
      this.actualizacionMensajes.unsubscribe();
    }
  }

  private iniciarActualizacionAutomatica() {
    // Actualizar cada 20 segundos
    this.actualizacionAutomatica = interval(20000).subscribe(() => {
      this.cargarChats();
      if (this.selectedChat) {
        this.cargarMensajes(this.selectedChat.ChatID);
      }
    });
  }

  cargarChats() {
    this.dataService.obtenerChats().subscribe(
      (response) => {
        if (response.success) {
          this.chats = response.chats;
        }
      },
      (error) => console.error(this.i18n.t('CHAT.ERROR_CARGAR_CHATS'), error)
    );
  }

  seleccionarChat(chat: Chat) {
    this.selectedChat = chat;
    this.cargarMensajes(chat.ChatID);
    
    // Cancelar la suscripción anterior si existe
    if (this.actualizacionMensajes) {
      this.actualizacionMensajes.unsubscribe();
    }
    
    // Actualizar mensajes del chat seleccionado cada 20 segundos
    this.actualizacionMensajes = interval(20000).subscribe(() => {
      this.cargarMensajes(chat.ChatID);
    });
  }

  cargarMensajes(chatId: number) {
    this.dataService.obtenerMensajes(chatId).subscribe(
      (response) => {
        if (response.success) {
          this.mensajes = response.messages;
        }
      },
      (error) => console.error(this.i18n.t('CHAT.ERROR_CARGAR_MENSAJES'), error)
    );
  }

  enviarMensaje() {
    if (!this.nuevoMensaje.trim() || !this.selectedChat) return;

    this.dataService.enviarMensaje(this.selectedChat.ChatID, this.nuevoMensaje).subscribe(
      (response) => {
        if (response.success) {
          this.nuevoMensaje = '';
          this.cargarMensajes(this.selectedChat!.ChatID);
        }
      },
      (error) => console.error('Error al enviar mensaje:', error)
    );
  }

  esMiMensaje(mensaje: Message): boolean {
    return mensaje.SenderID === this.userId;
  }

  iniciarNuevoChat(workshopId: number) {
    this.dataService.iniciarChat(workshopId).subscribe(
      (response) => {
        if (response.success) {
          this.cargarChats();
          this.seleccionarChat({ ChatID: response.chat_id } as Chat);
        }
      },
      (error) => console.error('Error al iniciar chat:', error)
    );
  }

  cargarTalleres() {
    this.dataService.obtenerTalleres().subscribe(
      (response: any) => {
        if (response.success) {
          this.talleres = response.workshops;
          this.talleresFiltrados = [...this.talleres];
        }
      },
      (error) => console.error('Error al cargar talleres:', error)
    );
  }

  mostrarModalTalleres() {
    this.mostrandoModalTalleres = true;
    this.busquedaTaller = '';
    this.filtrarTalleres();
  }

  filtrarTalleres() {
    const busqueda = this.busquedaTaller.toLowerCase();
    this.talleresFiltrados = this.talleres.filter((taller) =>
      taller.Name.toLowerCase().includes(busqueda) ||
      taller.Address.toLowerCase().includes(busqueda)
    );
  }

  iniciarChatConTaller(taller: any) {
    this.dataService.iniciarChat(taller.WorkshopID).subscribe(
      (response: any) => {
        if (response.success) {
          this.mostrandoModalTalleres = false;
          this.cargarChats();
          const nuevoChat: Chat = {
            ChatID: response.chat_id,
            UserID: this.userId,
            WorkshopID: taller.WorkshopID,
            WorkshopName: taller.Name,
            LastMessage: 'Chat iniciado',
            Status: 'Active',
            CreateAt: new Date().toISOString(),
            unreadCount: 0
          };
          this.seleccionarChat(nuevoChat);
        }
      },
      (error) => console.error('Error al iniciar chat:', error)
    );
  }
}