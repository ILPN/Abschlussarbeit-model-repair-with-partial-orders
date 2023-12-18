import { AfterViewInit, Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { combineLatest, map, Observable, Subject, take } from 'rxjs';
import { DisplayService } from './services/display.service';
import { NetCommandService } from './services/repair/net-command.service';
import { StructureType, UploadService } from './services/upload/upload.service';
import { FD_LOG } from './components/ilpn/file-display';
import { DescriptiveLinkComponent } from './components/ilpn/descriptive-link/descriptive-link.component';
import { APP_BASE_HREF } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  fdLog = FD_LOG;

  hasPartialOrders = false;
  isCurrentNetEmpty$: Observable<boolean>;
  resetPositioningSubject: Subject<void> = new Subject<void>();
  shouldShowSuggestions$: Observable<boolean>;

  @ViewChild('firstExample') firstExampleComp: DescriptiveLinkComponent | undefined;

  constructor(
    private displayService: DisplayService,
    private uploadService: UploadService,
    public netCommandService: NetCommandService,
    @Inject(APP_BASE_HREF) public baseHref: string
  ) {

    this.isCurrentNetEmpty$ = displayService.isCurrentNetEmpty$();

    this.shouldShowSuggestions$ = displayService.getShouldShowSuggestions();

    window.onresize = () => this.resetSvgPositioning();
  }

  get hasPartialOrders$(): Observable<boolean> {
    return this.displayService.getPartialOrders$()
      .pipe(map((pos) => ((pos?.length ?? 0) > 0)));
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
      this.uploadService.uploadFilesFromLinks(linkData).pipe(take(1)).subscribe();
    } else if (event.dataTransfer?.files) {
      this.uploadService.uploadFiles(event.dataTransfer.files, type);
    }
  }

  startEditing(): void {
    this.hasPartialOrders = true;
    setTimeout(() => this.resetSvgPositioning());
  }

  ngOnInit(): void {
    combineLatest([
      this.hasPartialOrders$,
      this.isCurrentNetEmpty$
    ]).subscribe(([pos, empty]) => {
      if (pos && !empty) {
        this.startEditing();
      }
    });
  }

  ngAfterViewInit(): void {
    // if (!this.firstExampleComp) {
    //   return;
    // }
    //
    // const fakeDrag = {dataTransfer: new DataTransfer()} as DragEvent;
    // this.firstExampleComp.addDragInformation(fakeDrag);
    //
    // const signal$ = this.uploadService.uploadFilesFromLinks(fakeDrag.dataTransfer!.getData(DescriptiveLinkComponent.DRAG_DATA_KEY));
    //
    // signal$.pipe(take(1)).subscribe(() => {
    //   this.hasPartialOrders = true;
    //   setTimeout(() => this.resetSvgPositioning());
    // });
  }

  changeToggle(event: MatSlideToggleChange): void {
    this.displayService.setShouldShowSuggestions(event.checked);
  }

  thesisLink(): string {
    return this.baseHref + 'assets/Nico Lueg - Model Repair von Geschäftsprozessmodellen mit Partiell Geordneten Event-Logs.pdf';
  }
}
