import { Injectable } from '@angular/core';
import { first, map, Observable, of, tap } from 'rxjs';
import { AutoRepair } from '../../algorithms/regions/parse-solutions.fn';
import { PetriNet } from '../../classes/diagram/petri-net';
import { Place } from '../../classes/diagram/place';
import { DisplayService } from '../display.service';
import {
  generateJsonObjectFromNet,
  generateTextFromNet,
  generateTextFromNetJsonObject
} from '../parser/net-to-text.func';
import { UploadService } from '../upload/upload.service';
import { JsonPetriNet } from '../parser/json-petri-net';

@Injectable({
  providedIn: 'root'
})
export class NetCommandService {
  undoQueue: string[] = [];
  redoQueue: string[] = [];

  constructor(
    private uploadService: UploadService,
    private displayService: DisplayService
  ) {
  }

  repairNetForNewTransition(
    missingTransition: string,
    solution: AutoRepair
  ): Observable<string | null> {
    if (!missingTransition) {
      return of(null);
    }

    return this.displayService.getPetriNet$().pipe(
      first(),
      map((petriNet) => {
        this.undoQueue.push(generateTextFromNet(petriNet));
        return generateTextForNetWithTransition(
          missingTransition,
          petriNet,
          solution
        );
      }),
      tap((newNet) => {
        if (newNet) {
          this.uploadService.setUploadText(newNet);
        }
      })
    );
  }

  repairNet(placeId: string, solution: AutoRepair): Observable<string | null> {
    if (!placeId) {
      return of(null);
    }

    return this.displayService.getPetriNet$().pipe(
      first(),
      map((petriNet) => {
        const placeIndex = petriNet.places.findIndex((p) => p.id === placeId);
        if (placeIndex === -1) {
          return null;
        }

        this.undoQueue.push(generateTextFromNet(petriNet));
        return generateTextForNewNet(placeIndex, petriNet, solution);
      }),
      tap((newNet) => {
        if (newNet) {
          this.uploadService.setUploadText(newNet);
        }
      })
    );
  }

  undo(): void {
    const net = this.undoQueue.pop();
    if (!net) {
      return;
    }

    this.uploadService
      .getNetUpload$()
      .pipe(first())
      .subscribe((currentUpload) => {
        this.redoQueue.push(currentUpload);
        this.uploadService.setUploadText(net);
      });
  }

  redo(): void {
    const net = this.redoQueue.pop();
    if (!net) {
      return;
    }

    this.uploadService
      .getNetUpload$()
      .pipe(first())
      .subscribe((currentUpload) => {
        this.undoQueue.push(currentUpload);
        this.uploadService.setUploadText(net);
      });
  }
}

function generateTextForNetWithTransition(
  newTransition: string,
  petriNet: PetriNet,
  solution: AutoRepair
): string {
  const netObject = generateJsonObjectFromNet(petriNet);

  // Handle completely new transitions
  const requiredTransitions = getRequiredTransitions(solution);
  const transitionsThatDontExist = requiredTransitions.filter(
    (requiredLabel) =>
      !petriNet.transitions.some(
        (transition) => transition.label === requiredLabel
      )
  );
  netObject.transitions.push(...transitionsThatDontExist);

  let placeId = 'p' + petriNet.places.length;
  while (petriNet.places.find((t) => t.id === placeId)) {
    placeId += '_';
  }
  netObject.places.push(placeId);
  if ('newMarking' in solution && (solution?.newMarking ?? 0 > 0)) {
    if (netObject.marking === undefined) {
      netObject.marking = {};
    }
    netObject.marking[placeId] = solution.newMarking as number;
  }

  generateArcsForSolution(
    placeId,
    solution,
    netObject
  );

  return generateTextFromNetJsonObject(netObject);
}

function generateTextForNewNet(
  placeIndex: number,
  petriNet: PetriNet,
  solution: AutoRepair
): string {
  const netObject = generateJsonObjectFromNet(petriNet);

  // Handle completely new transitions
  const requiredTransitions = getRequiredTransitions(solution);
  const transitionsThatDontExist = requiredTransitions.filter(
    (requiredLabel) =>
      !petriNet.transitions.some(
        (transition) => transition.label === requiredLabel
      )
  );
  netObject.transitions.push(...transitionsThatDontExist);

  const oldPlace: Place = petriNet.places[placeIndex];
  generatePlaceForSolution(
    oldPlace.id,
    oldPlace.marking,
    solution,
    netObject,
    placeIndex
  );

  generateArcsForSolution(
    oldPlace.id,
    solution,
    netObject
  );

  return generateTextFromNetJsonObject(netObject);
}

function getRequiredTransitions(solution: AutoRepair): string[] {
  if (solution.type === 'modify-place') {
    return Array.from(
      new Set([
        ...solution.incoming.map((arc) => arc.transitionLabel),
        ...solution.outgoing.map((arc) => arc.transitionLabel)
      ])
    );
  }

  if (solution.type === 'replace-place') {
    return Array.from(
      new Set(
        solution.places.flatMap((place) => [
          ...place.incoming.map((arc) => arc.transitionLabel),
          ...place.outgoing.map((arc) => arc.transitionLabel)
        ])
      )
    );
  }

  return [];
}

function generatePlaceForSolution(
  placeId: string,
  oldMarking: number,
  solution: AutoRepair,
  netObject: JsonPetriNet,
  oldPlaceIndex?: number
): void {
  if (netObject.marking === undefined) {
    netObject.marking = {};
  }

  if (solution.type === 'marking') {
    netObject.marking[placeId] = solution.newMarking;
    return;
  }
  if (solution.type === 'modify-place' && solution.newMarking) {
    netObject.marking[placeId] = solution.newMarking;
    return;
  }
  if (solution.type === 'replace-place') {
    if (oldPlaceIndex === undefined) {
      throw new Error('unexpected state');
    }
    const newPlaces = [];
    for (let index = 0; index < solution.places.length; index++) {
      const pid = `${placeId}_${index}`;
      newPlaces.push(pid);
      if (solution.places[index].newMarking) {
        netObject.marking[pid] = solution.places[index].newMarking as number;
      }
    }
    netObject.places.splice(oldPlaceIndex, 1, ...newPlaces);
    return;
  }

  netObject.marking[placeId] = oldMarking;
}

function generateArcsForSolution(
  oldPlaceId: string,
  solution: AutoRepair,
  netObject: JsonPetriNet
): void {
  if (solution.type === 'marking') {
    return;
  }

  if (netObject.arcs === undefined) {
    netObject.arcs = {};
  }

  for (const arc of Object.entries(netObject.arcs)) {
    const split = arc[0].split(',');
    if (split[0] === oldPlaceId || split[1] === oldPlaceId) {
      delete netObject.arcs[arc[0]];
    }
  }

  if (solution.type === 'modify-place') {
    for (const arcDef of solution.incoming) {
      netObject.arcs[`${arcDef.transitionLabel},${oldPlaceId}`] = arcDef.weight;
    }
    for (const arcDef of solution.outgoing) {
      netObject.arcs[`${oldPlaceId},${arcDef.transitionLabel}`] = arcDef.weight;
    }
    return;
  }

  for (let index = 0; index < solution.places.length; index++) {
    const place = solution.places[index];
    for (const arcDef of place.incoming) {
      netObject.arcs[`${arcDef.transitionLabel},${oldPlaceId}_${index}`] = arcDef.weight;
    }
    for (const arcDef of place.outgoing) {
      netObject.arcs[`${oldPlaceId}_${index},${arcDef.transitionLabel}`] = arcDef.weight;
    }
  }
}
