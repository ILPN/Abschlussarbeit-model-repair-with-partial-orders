import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { DownloadPopoverComponent } from './download-popover/download-popover.component';
import { FD_PETRI_NET } from '../ilpn/file-display';

@Component({
  selector: 'app-download',
  templateUrl: './download.component.html',
  styleUrls: ['./download.component.scss'],
})
export class DownloadComponent {

  public fdPn = FD_PETRI_NET;

  constructor(public dialog: MatDialog) {}

  openDialog(): void {
    this.dialog.open(DownloadPopoverComponent);
  }
}
