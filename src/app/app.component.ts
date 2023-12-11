import { Component, OnInit } from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { first, map, Observable, Subject } from 'rxjs';
import { DisplayService } from './services/display.service';
import { NetCommandService } from './services/repair/net-command.service';
import { StructureType, UploadService } from './services/upload/upload.service';
import { FD_LOG } from './components/ilpn/file-display';
import { DescriptiveLinkComponent } from './components/ilpn/descriptive-link/descriptive-link.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  fdLog = FD_LOG;

  hasPartialOrders = false;
  isCurrentNetEmpty$: Observable<boolean>;
  partialOrderCount$: Observable<{ count: number }>;
  resetPositioningSubject: Subject<void> = new Subject<void>();
  shouldShowSuggestions$: Observable<boolean>;

  constructor(
    private displayService: DisplayService,
    private uploadService: UploadService,
    public netCommandService: NetCommandService
  ) {
    this.partialOrderCount$ = displayService
      .getPartialOrders$()
      .pipe(map((pos) => ({ count: pos?.length ?? 0 })));

    this.isCurrentNetEmpty$ = displayService.isCurrentNetEmpty$();

    this.shouldShowSuggestions$ = displayService.getShouldShowSuggestions();

    window.onresize = () => this.resetSvgPositioning();
  }

  resetSvgPositioning(): void {
    this.resetPositioningSubject.next();
  }

  openFileSelector(type: StructureType | undefined): void {
    this.uploadService.openFileSelector(type);
  }

  dropFiles(event: DragEvent, type: StructureType | undefined): void {
    const linkData = event.dataTransfer?.getData(DescriptiveLinkComponent.DRAG_DATA_KEY);
    if (linkData) {
      this.uploadService.uploadFilesFromLinks(linkData);
    } else if (event.dataTransfer?.files) {
      this.uploadService.uploadFiles(event.dataTransfer.files, type);
    }
  }

  startEditing(count: number): void {
    if (count > 0) {
      this.hasPartialOrders = true;
      setTimeout(() => this.resetSvgPositioning());
    }
  }

  ngOnInit(): void {
    this.partialOrderCount$
      .pipe(first())
      .subscribe((count) => this.startEditing(count.count));
  }

  changeToggle(event: MatSlideToggleChange): void {
    this.displayService.setShouldShowSuggestions(event.checked);
  }
}
