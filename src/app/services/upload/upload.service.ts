import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, forkJoin, map, Observable, of, ReplaySubject, Subject, take } from 'rxjs';
import { netTypeKey } from '../parser/parsing-constants';
import { getRunTextFromPnml } from './pnml/pnml-to-run.fn';
import { parseXesFileToCustomLogFormat } from './xes/xes-parser';
import { HttpClient } from '@angular/common/http';

export type StructureType = 'petri-net' | 'log';

const allowedExtensions: { [key in StructureType]: string[] } = {
  'petri-net': ['pn', 'pnml'],
  log: ['txt', 'log', 'xes']
};

interface LinkContent {
  content?: string,
  link: string
}

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private currentNetUpload$: Subject<string>;
  private currentLogUpload$: Subject<string>;

  constructor(private toastr: ToastrService, private _http: HttpClient) {
    this.currentNetUpload$ = new ReplaySubject<string>(1);
    this.currentLogUpload$ = new ReplaySubject<string>(1);
  }

  setUploadText(text: string): void {
    this.currentNetUpload$.next(text);
  }

  getNetUpload$(): Observable<string> {
    return this.currentNetUpload$.asObservable();
  }

  getLogUpload$(): Observable<string> {
    return this.currentLogUpload$.asObservable();
  }

  openFileSelector(type?: StructureType): void {
    const fileUpload = document.createElement('input');
    fileUpload.setAttribute('type', 'file');

    const relevantExtensions = type
      ? allowedExtensions[type]
      : Object.values(allowedExtensions).flat();

    fileUpload.setAttribute(
      'accept',
      relevantExtensions.map((e) => '.' + e).join(',')
    );
    fileUpload.onchange = (event) => {
      if (event.target instanceof HTMLInputElement && event.target?.files) {
        this.uploadFiles(event.target.files);
      }
    };

    fileUpload.click();
  }

  uploadFiles(files: FileList, type?: StructureType): void {
    const filteredFiles = Array.from(files).filter((file) =>
      fileExtensionIsValid(file.name, type)
    );
    if (filteredFiles.length === 0) {
      this.toastr.error("Couldn't find any valid file");
      return;
    }

    filteredFiles.forEach((file) => {
      const reader = new FileReader();
      const fileExtension = getExtensionForFileName(file.name);

      reader.onload = () => {
        const content: string = reader.result as string;
        this.processTextFileContent(content, fileExtension);
      };

      reader.readAsText(file);
    });

    if (filteredFiles.length === 1) {
      this.toastr.success(`Processed file`);
    } else {
      this.toastr.success(`Processed files`);
    }
  }

  uploadFilesFromLinks(links: string): Observable<void> {
    const linkData$: Array<Observable<LinkContent>> = [];
    const signal$ = new ReplaySubject<void>();

    if (!links.startsWith('[')) {
      linkData$.push(this.fetchLinkData(links));
    } else {
      const parsed = JSON.parse(links) as Array<string>;
      for (const l of parsed) {
        linkData$.push(this.fetchLinkData(l));
      }
    }

    forkJoin(linkData$).pipe(take(1)).subscribe(results => {
      results.filter(r => !!r.content).forEach(r => {
        this.processTextFileContent(r.content as string, getExtensionForFileName(r.link), signal$);
      });
    });

    return signal$.asObservable();
  }

  private fetchLinkData(link: string): Observable<LinkContent> {
    return this._http.get(link, {
      responseType: 'text'
    }).pipe(
      catchError(err => {
        console.error('fetch data error', err);
        return of(undefined);
      }),
      map( content => ({content, link}))
    );
  }

  private processTextFileContent(content: string, fileExtension?: string, signal$?: ReplaySubject<void>) {
    if (fileExtension?.toLowerCase() === 'pnml') {
      content = getRunTextFromPnml(content);
    }
    if (fileExtension?.toLowerCase() === 'xes') {
      content = parseXesFileToCustomLogFormat(content);
    }
    this.processNewSource(content, signal$);
  }

  private processNewSource(newSource: string, signal$?: ReplaySubject<void>): void {
    if (newSource.trim().startsWith(netTypeKey)) {
      this.currentNetUpload$.next(newSource);
    } else {
      this.currentLogUpload$.next(newSource);
    }
    signal$?.next();
    signal$?.complete();
  }
}

function fileExtensionIsValid(fileName: string, type?: StructureType): boolean {
  const fileExtension = getExtensionForFileName(fileName);
  if (!fileExtension) {
    return false;
  }

  const relevantExtensions = type
    ? allowedExtensions[type]
    : Object.values(allowedExtensions).flat();
  return relevantExtensions.includes(fileExtension.trim());
}

function getExtensionForFileName(fileName: string): string | undefined {
  const split = fileName.split('.');
  if (split.length === 0) {
    return undefined;
  }
  return split.pop();
}
