import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Arc } from 'src/app/classes/diagram/arc';
import {
  addArc,
  addEventItem,
  addPlace,
  addTransition,
  generateEventItem,
  getElementsWithArcs,
  setRefs
} from '../../classes/diagram/functions/net-helper.fn';
import {
  determineInitialAndFinalEvents,
  PartialOrder
} from '../../classes/diagram/partial-order';
import { PetriNet } from '../../classes/diagram/petri-net';
import { concatEvents } from '../../classes/diagram/transition';
import {
  attributesAttribute,
  caseIdAttribute,
  conceptNameAttribute,
  eventIdAttribute,
  eventsAttribute,
  followsAttribute,
  logTypeKey,
  netTypeKey,
} from './parsing-constants';
import { JsonPetriNet } from './json-petri-net';

type LogParsingStates = 'initial' | 'type' | 'attributes' | 'events';

@Injectable({
  providedIn: 'root'
})
export class ParserService {
  constructor(private toastr: ToastrService) {
  }

  private readonly logEventRegex = /^(\S+)\s*(\S+)\s*(\S+)?\s*(.*)$/;

  parsePartialOrders(content: string, errors: Set<string>): PartialOrder[] {
    const contentLines = content.split('\n');

    let currentParsingState: LogParsingStates = 'initial';

    let caseIdIndex = 0;
    let conceptNameIndex = 1;
    let eventIdIndex = -1;
    let followsIndex = -1;
    let attributesCounter = 1;

    let currentCaseId: number | undefined;

    const returnList: PartialOrder[] = [];
    let currentPartialOrder: PartialOrder | undefined;
    let lastCaseId: string | undefined;

    for (const line of contentLines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '') {
        continue;
      }

      switch (currentParsingState) {
        case 'initial':
          if (trimmedLine === logTypeKey) {
            currentParsingState = 'type';
          } else {
            errors.add(
              `The type of the file with the net has to be '` + netTypeKey + `'`
            );
            this.toastr.error(
              `The type has to be '` + netTypeKey + `'`,
              `Unable to parse file`
            );
            return [];
          }
          break;
        case 'type':
          if (trimmedLine === attributesAttribute) {
            currentParsingState = 'attributes';
            break;
          } else {
            errors.add(`The log contains invalid parts`);
            this.toastr.error(
              `The log contains invalid parts. '${trimmedLine}' is not a valid attribute`,
              `Unable to parse log`
            );
            return [];
          }
        case 'attributes':
          if (trimmedLine !== eventsAttribute) {
            if (trimmedLine === caseIdAttribute) {
              caseIdIndex = attributesCounter;
            } else if (trimmedLine === conceptNameAttribute) {
              conceptNameIndex = attributesCounter;
            } else if (trimmedLine === eventIdAttribute) {
              eventIdIndex = attributesCounter;
            } else if (trimmedLine === followsAttribute) {
              followsIndex = attributesCounter;
            }
            attributesCounter++;
            break;
          } else if (trimmedLine === eventsAttribute) {
            currentParsingState = 'events';
            break;
          } else {
            errors.add(`The log contains invalid parts`);
            this.toastr.error(
              `The log contains invalid parts. '${trimmedLine}' is not a valid attribute`,
              `Unable to parse log`
            );
            return [];
          }
        case 'events':
          if (trimmedLine !== eventsAttribute) {
            const match = this.logEventRegex.exec(trimmedLine);
            if (!match) {
              break;
            }

            const caseId = Number(match[caseIdIndex]);
            let conceptName = match[conceptNameIndex];
            let eventId: string | undefined = match[eventIdIndex];
            if (conceptName === undefined && eventId !== undefined) {
              conceptName = eventId;
              eventId = undefined;
            }

            const isPartialOrder =
              followsIndex !== -1 &&
              match[followsIndex].includes('[') &&
              match[followsIndex].includes(']');
            const follows =
              followsIndex === -1
                ? []
                : match[followsIndex]
                  .replace('[', '')
                  .replace(']', '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => !!s);

            if (currentCaseId !== caseId) {
              if (currentPartialOrder) {
                determineInitialAndFinalEvents(currentPartialOrder);
                returnList.push(currentPartialOrder);
              }

              lastCaseId = undefined;
              currentCaseId = caseId;
              currentPartialOrder = {
                arcs: [],
                events: []
              };
            }

            const id = addEventItem(
              currentPartialOrder,
              generateEventItem(eventId ?? conceptName, conceptName)
            );
            if (lastCaseId || isPartialOrder) {
              if (isPartialOrder) {
                follows.forEach((follow) => {
                  this.addArcToPartialOrder(currentPartialOrder, {
                    target: id,
                    source: follow,
                    weight: 1,
                    breakpoints: []
                  });
                });
              } else if (lastCaseId) {
                this.addArcToPartialOrder(currentPartialOrder, {
                  target: id,
                  source: lastCaseId,
                  weight: 1,
                  breakpoints: []
                });
              }
            }
            lastCaseId = id;
            break;
          } else {
            errors.add(`Unable to parse log`);
            this.toastr.error(`Unable to parse log`, 'Error');
            return [];
          }
      }
    }
    if (currentPartialOrder) {
      determineInitialAndFinalEvents(currentPartialOrder);
      returnList.push(currentPartialOrder);
    }

    if (returnList.length === 0 && errors.size === 0) {
      errors.add(`No parsable traces where found`);
      this.toastr.error(
        `No parsable traces where found in the log`,
        'No traces found'
      );
    }
    return returnList;
  }

  parsePetriNet(content: string, errors: Set<string>): PetriNet | null {
    this.toastr.toasts.forEach((t) => {
      this.toastr.remove(t.toastId);
    });

    let contentObject: JsonPetriNet;
    try {
      contentObject = JSON.parse(content);
    } catch (e) {
      errors.add(
        `The provided Petri net file is not a JSON. [${(e as SyntaxError).name}]: ${(e as SyntaxError).message}`
      );
      this.toastr.error(
        'The provided Petri net file is not a JSON.',
        'Unable to parse file'
      );
      return null;
    }

    const petriNet: PetriNet = {
      transitions: [],
      arcs: [],
      places: []
    };

    if (contentObject.transitions === undefined || !Array.isArray(contentObject.transitions)) {
      errors.add(`The Petri net JSON file must contain a 'transitions' string array attribute`);
      this.toastr.error(
        `The Petri net file does not specify any transitions`,
        `Unable to parse file`
      );
      return null;
    }
    for (const t of contentObject.transitions) {
      if (!addTransition(petriNet, {
        id: t,
        label: t,
        type: 'transition',
        incomingArcs: [],
        outgoingArcs: []
      })) {
        this.toastr.warning(
          `File contains duplicate transitions`,
          `Duplicate transitions are ignored`
        );
      }
    }

    if (contentObject.places === undefined || !Array.isArray(contentObject.places)) {
      errors.add(`The Petri net JSON file must contain a 'places' string array attribute`);
      this.toastr.error(
        `The Petri net file does not specify any places`,
        `Unable to parse file`
      );
      return null;
    }
    for (const p of contentObject.places) {
      if (!addPlace(petriNet, {
        id: p,
        type: 'place',
        marking: 0,
        incomingArcs: [],
        outgoingArcs: []
      })) {
        this.toastr.warning(
          `File contains duplicate places`,
          `Duplicate places are ignored`
        );
      }
    }

    if (contentObject.arcs !== undefined && typeof contentObject.arcs === 'object') {
      for (const a of Object.entries(contentObject.arcs)) {
        const ids = a[0].split(',');
        if (ids.length !== 2) {
          this.toastr.warning(
            `Arc id '${a[0]}' is malformed. Arc id must be of the form '<id>,<id>'.`,
            `Malformed arc ignored`
          );
          continue;
        }
        const elements = getElementsWithArcs(petriNet);
        const parsedSource = elements.find(
          (transition) => transition.id === ids[0]
        );
        const parsedTarget = elements.find(
          (transition) => transition.id === ids[1]
        );
        if (!parsedSource || !parsedTarget) {
          this.toastr.error(
            `An arc between ${ids[0]} and ${ids[1]} is invalid`,
            `Unable to parse file`
          );
          errors.add(`An arc between ${ids[0]} and ${ids[1]} is invalid`);
          throw Error(
            `An arc between ${ids[0]} and ${ids[1]} is invalid`
          );
        }
        if (parsedSource.type === parsedTarget.type) {
          this.toastr.warning(
            `Arc between ${ids[0]} and ${ids[1]} connect elements of the same type and will be ignored`,
            `Malformed arc ignored`
          );
          continue;
        }
        if (!addArc(petriNet, {
          weight: a[1],
          source: ids[0],
          target: ids[1],
          breakpoints: []
        })) {
          this.toastr.warning(
            `File contains duplicate arcs`,
            `Duplicate arcs are ignored`
          );
        }
      }
    }

    if (contentObject.marking !== undefined && typeof contentObject.marking === 'object') {
      for (const p of Object.entries(contentObject.marking)) {
        const place = petriNet.places.find(pp => pp.id === p[0]);
        if (place === undefined) {
          this.toastr.warning(
            `The net does not contain a place with the id '${p[0]}'. Marking of this place will be ignored`,
            `Malformed marking ignored`
          );
          continue;
        }
        if (p[1] < 0) {
          this.toastr.warning(
            `The marking of the place '${p[0]}' is negative.`,
            `Malformed marking ignored`
          );
          continue;
        }
        place.marking = p[1];
      }
    }

    if (petriNet.arcs.length === 0 && petriNet.transitions.length === 0) {
      errors.add(`Petri net does not contain events and arcs`);
      this.toastr.error(
        `Petri net does not contain events and arcs`,
        `Unable to parse petri net`
      );
      return null;
    }

    if (!setRefs(petriNet)) {
      this.toastr.warning(
        `File contains arcs for non existing events`,
        `Invalid arcs are ignored`
      );
    }

    return petriNet;
  }

  private addArcToPartialOrder(
    currentPartialOrder: PartialOrder | undefined,
    arc: Arc
  ): void {
    if (!addArc(currentPartialOrder, arc)) {
      this.toastr.warning(
        `File contains duplicate arcs`,
        `Duplicate arcs are ignored`
      );
    } else if (currentPartialOrder) {
      const source = currentPartialOrder!.events.find(
        (event) => event.id === arc.source
      );
      const target = currentPartialOrder.events.find(
        (event) => event.id === arc.target
      );
      if (source && target) {
        concatEvents(source, target);
      }
    }
  }
}
