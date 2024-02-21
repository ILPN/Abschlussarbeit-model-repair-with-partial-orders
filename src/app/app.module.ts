import { OverlayModule } from '@angular/cdk/overlay';
import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { AppComponent } from './app.component';
import { CanvasComponent } from './components/canvas/canvas.component';
import { DisplayComponent } from './components/display/display.component';
import { DownloadComponent } from './components/download/download.component';
import { DownloadPopoverComponent } from './components/download/download-popover/download-popover.component';
import { FooterComponent } from './components/footer/footer.component';
import { RepairMenuComponent } from './components/repair-menu/repair-menu.component';
import { SourceFileTextareaComponent } from './components/source-file-textarea/source-file-textarea.component';
import { TemplateButtonComponent } from './components/template-button/template-button.component';
import { DescriptiveLinkComponent } from './components/ilpn/descriptive-link/descriptive-link.component';
import { InfoCardComponent } from './components/ilpn/info-card/info-card.component';
import { APP_BASE_HREF, PlatformLocation } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent,
    DisplayComponent,
    FooterComponent,
    TemplateButtonComponent,
    SourceFileTextareaComponent,
    DownloadComponent,
    CanvasComponent,
    DownloadPopoverComponent,
    RepairMenuComponent,
    DescriptiveLinkComponent,
    InfoCardComponent,
  ],
  imports: [
    BrowserModule,
    FlexLayoutModule,
    BrowserAnimationsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    ReactiveFormsModule,
    ToastrModule.forRoot({
      preventDuplicates: true,
    }),
    MatTabsModule,
    MatRadioModule,
    MatCheckboxModule,
    FormsModule,
    MatDialogModule,
    OverlayModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    HttpClientModule,
  ],
  providers: [
    {
      provide: APP_BASE_HREF,
      useFactory: (s: PlatformLocation) => s.getBaseHrefFromDOM(),
      deps: [PlatformLocation]
    }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
