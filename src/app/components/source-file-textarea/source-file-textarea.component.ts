import { Component, Input, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  Observable,
  Subscription,
} from 'rxjs';

import { PartialOrder } from '../../classes/diagram/partial-order';
import { isNetEmpty, PetriNet } from '../../classes/diagram/petri-net';
import { DisplayService } from '../../services/display.service';
import { ParserService } from '../../services/parser/parser.service';
import { UploadService } from '../../services/upload/upload.service';

type Valid = 'error' | 'warn' | 'success';

const emptyContent =
  '.type pn\n' + '.transitions\n\n' + '.places\n\n' + '.arcs\n';

@Component({
  selector: 'app-source-file-textarea',
  templateUrl: './source-file-textarea.component.html',
  styleUrls: ['./source-file-textarea.component.scss'],
})
export class SourceFileTextareaComponent implements OnDestroy {
  @Input() events: Observable<void> | undefined;
  private _sub: Subscription;
  private _fileSub: Subscription;

  private _resetEventSubscription?: Subscription;

  petriNetTextarea: FormControl<string | null>;
  logTextarea: FormControl<string | null>;

  isCurrentNetEmpty$: Observable<boolean>;

  netValidationStatus: Valid | null = null;
  logValidationStatus: Valid | null = null;
  netHint = '';
  logHint = '';

  constructor(
    private parserService: ParserService,
    private displayService: DisplayService,
    private uploadService: UploadService
  ) {

    this.logTextarea = new FormControl<string | null>(null);
    this.petriNetTextarea = new FormControl<string>(emptyContent);

    this.isCurrentNetEmpty$ = this.displayService
      .isCurrentNetEmpty$()
      .pipe(distinctUntilChanged());

    this._sub = this.petriNetTextarea.valueChanges
      .pipe(debounceTime(400))
      .subscribe((val) => this.processSourceChange(val, 'net'));

    this.logTextarea.valueChanges
      .pipe(debounceTime(400))
      .subscribe((val) => this.processSourceChange(val, 'po'));

    this._fileSub = this.uploadService
      .getNetUpload$()
      .subscribe((content) => this.petriNetTextarea.setValue(content));

    this._fileSub = this.uploadService
      .getLogUpload$()
      .subscribe((content) => this.logTextarea.setValue(content));

    combineLatest([
      this.displayService.getPetriNet$(),
      this.displayService.getCurrentErrors$(),
    ]).subscribe(([petriNet, errors]) => {
      this.updateValidationForNet(petriNet, errors);
    });
  }

  ngOnDestroy(): void {
    this._resetEventSubscription?.unsubscribe();
    this._sub.unsubscribe();
    this._fileSub.unsubscribe();
  }

  private processSourceChange(
    newSource: string | null,
    type: 'net' | 'po'
  ): void {
    if (newSource === null || newSource === emptyContent) {
      return;
    }

    if (type === 'net') {
      const errors = new Set<string>();
      const result = this.parserService.parsePetriNet(newSource, errors);

      this.updateValidationForNet(result, errors);
      if (!result) return;

      this.displayService.setNewNet(result, errors);
    } else {
      const errors = new Set<string>();
      const result = this.parserService.parsePartialOrders(newSource, errors);

      this.updateValidationForLog(result, errors);
      if (!result) return;

      this.displayService.setPartialOrders(result);
    }
  }

  private updateValidationForNet(
    run: PetriNet | null,
    errors: Set<string> = new Set<string>()
  ): void {
    this.netHint = [...errors].join('\n');

    if (!run || errors.size > 0) {
      this.petriNetTextarea.setErrors({ 'invalid net': true });
      this.netValidationStatus = 'error';
    } else if (!isNetEmpty(run)) {
      this.netValidationStatus = 'success';
    } else {
      this.netValidationStatus = null;
    }
  }

  private updateValidationForLog(
    orders: PartialOrder[],
    errors: Set<string> = new Set<string>()
  ): void {
    this.logHint = [...errors].join('\n');

    if (orders.length === 0 || errors.size > 0) {
      this.logTextarea.setErrors({ 'invalid log': true });
      this.logValidationStatus = 'error';
    } else if (orders.length > 0) {
      this.logValidationStatus = 'success';
    } else {
      this.logValidationStatus = null;
    }
  }
}
