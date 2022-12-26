import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Observable, ReplaySubject, Subject } from 'rxjs';

const allowedExtensions = ['txt', 'pn', 'pnml'];

@Injectable({
  providedIn: 'root',
})
export class UploadService {
  private currentUpload$: Subject<string>;

  constructor(private toastr: ToastrService) {
    this.currentUpload$ = new ReplaySubject<string>(1);
  }

  setUploadText(text: string): void {
    this.currentUpload$.next(text);
  }

  getUpload$(): Observable<string> {
    return this.currentUpload$.asObservable();
  }

  checkFiles(files: FileList): boolean {
    let check = true;

    Array.from(files).forEach((file) => {
      if (!fileExtensionIsValid(file.name)) {
        check = false;
        this.toastr.error(
          `File '${file.name}' has to be a valid extension`,
          `Unable to upload file`
        );
      }
    });

    return check;
  }

  openFileSelector(): void {
    const fileUpload = document.createElement('input');
    fileUpload.setAttribute('type', 'file');
    fileUpload.setAttribute('multiple', 'multiple');
    fileUpload.setAttribute(
      'accept',
      allowedExtensions.map((e) => '.' + e).join(',')
    );
    fileUpload.onchange = (event) => {
      if (event.target instanceof HTMLInputElement && event.target?.files) {
        this.uploadFiles(event.target.files);
      }
    };

    fileUpload.click();
  }

  uploadFiles(files: FileList): void {
    if (!this.checkFiles(files)) {
      return;
    }

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      const fileExtension = getExtensionForFileName(file.name);

      reader.onload = () => {
        const content: string = reader.result as string;

        if (fileExtension?.toLowerCase() === 'pnml') {
          // TODO: Parse pnml!
        }
        this.currentUpload$.next(content);
      };

      reader.readAsText(file);
    });
  }
}

function fileExtensionIsValid(fileName: string): boolean {
  const fileExtension = getExtensionForFileName(fileName);
  if (!fileExtension) {
    return false;
  }
  return allowedExtensions.includes(fileExtension.trim());
}

function getExtensionForFileName(fileName: string): string | undefined {
  return fileName.split('.').pop();
}
