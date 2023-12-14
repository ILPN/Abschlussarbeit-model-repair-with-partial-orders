import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FileDisplay } from '../ilpn/file-display';

@Component({
  selector: 'app-template-button',
  templateUrl: './template-button.component.html',
  styleUrls: ['./template-button.component.scss'],
})
export class TemplateButtonComponent {
  @Input() styleClass?: string;
  @Input() buttonText: string | undefined;
  @Input() buttonContent?: string | FileDisplay;
  @Output() buttonAction = new EventEmitter<void>();
  @Output() dropAction = new EventEmitter<DragEvent>();

  prevent(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  hoverStart(e: MouseEvent): void {
    this.prevent(e);
    const target = e.target as HTMLElement;
    target.classList.add('mouse-hover');
  }

  hoverEnd(e: MouseEvent): void {
    this.prevent(e);
    const target = e.target as HTMLElement;
    target.classList.remove('mouse-hover');
  }

  processMouseClick(): void {
    this.buttonAction.emit();
  }

  processDrop(e: DragEvent): void {
    this.prevent(e);
    const target = e.target as HTMLElement;
    target.classList.remove('drag-hover');

    this.dropAction.emit(e);
  }

  dragStart(e: DragEvent): void {
    this.prevent(e);
    const target = e.target as HTMLElement;
    target.classList.add('drag-hover');
  }

  dragEnd(e: DragEvent): void {
    this.prevent(e);
    const target = e.target as HTMLElement;
    target.classList.remove('drag-hover');
  }

  resolveSquareContent(): string {
    if (typeof this.buttonContent === 'object') {
      return this.buttonContent.icon;
    }
    return this.buttonContent ?? '?';
  }

  resolveSquareColor(): string {
    if (typeof this.buttonContent === 'object') {
      return this.buttonContent.color;
    }
    return 'black';
  }
}
