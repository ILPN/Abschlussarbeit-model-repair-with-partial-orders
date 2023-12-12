import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Arc, Breakpoint } from 'src/app/classes/diagram/arc';

import {
  addArc,
  addEventItem,
  addPlace,
  addTransition,
  generateEventItem,
  getElementsWithArcs,
  setRefs,
} from '../../classes/diagram/functions/net-helper.fn';
import {
  determineInitialAndFinalEvents,
  PartialOrder,
} from '../../classes/diagram/partial-order';
import { PetriNet } from '../../classes/diagram/petri-net';
import { Place } from '../../classes/diagram/place';
import { concatEvents, Transition } from '../../classes/diagram/transition';
import {
  arcsAttribute,
  attributesAttribute,
  caseIdAttribute,
  conceptNameAttribute,
  eventIdAttribute,
  eventsAttribute,
  followsAttribute,
  logTypeKey,
  netTypeKey,
  placesAttribute,
  transitionsAttribute,
} from './parsing-constants';

type ParsingStates = 'initial' | 'type' | 'transitions' | 'places' | 'arcs';

type LogParsingStates = 'initial' | 'type' | 'attributes' | 'events';

@Injectable({
  providedIn: 'root',
})
export class ParserService {
  constructor(private toastr: ToastrService) {}

  private readonly transitionRegex = /^(\S*)\s*(.*)$/;
  private readonly placeRegex = /^(\S*)\s*(\d*)$/;
  private readonly arcRegex = /^(\S*)\s*(\S*)\s*(\d*)$/;

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
                events: [],
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
                    breakpoints: [],
                  });
                });
              } else if (lastCaseId) {
                this.addArcToPartialOrder(currentPartialOrder, {
                  target: id,
                  source: lastCaseId,
                  weight: 1,
                  breakpoints: [],
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
    const contentLines = content.split('\n');
    const petriNet: PetriNet = {
      transitions: [],
      arcs: [],
      places: [],
    };

    let currentParsingState: ParsingStates = 'initial';
    this.toastr.toasts.forEach((t) => {
      this.toastr.remove(t.toastId);
    });

    for (const line of contentLines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '') {
        continue;
      }

      switch (currentParsingState) {
        case 'initial':
          if (trimmedLine === netTypeKey) {
            currentParsingState = 'type';
            break;
          } else {
            errors.add(
              `The type of the file with the net has to be '` + netTypeKey + `'`
            );
            this.toastr.error(
              `The type has to be '` + netTypeKey + `'`,
              `Unable to parse file`
            );
            return null;
          }
        case 'type':
          if (trimmedLine === transitionsAttribute) {
            currentParsingState = 'transitions';
            break;
          } else if (trimmedLine === arcsAttribute) {
            currentParsingState = 'arcs';
            break;
          } else if (trimmedLine === placesAttribute) {
            currentParsingState = 'places';
            break;
          } else {
            errors.add(`The file contains invalid parts`);
            this.toastr.error(
              `The file contains invalid parts`,
              `Unable to parse file`
            );
            return null;
          }
        case 'transitions':
          if (
            trimmedLine !== arcsAttribute &&
            trimmedLine !== placesAttribute
          ) {
            const transition = this.parseTransition(trimmedLine);

            if (!addTransition(petriNet, transition)) {
              this.toastr.warning(
                `File contains duplicate transitions`,
                `Duplicate transitions are ignored`
              );
            }
            break;
          } else if (trimmedLine === arcsAttribute) {
            currentParsingState = 'arcs';
            break;
          } else if (trimmedLine === placesAttribute) {
            currentParsingState = 'places';
            break;
          } else {
            errors.add(`Unable to parse file`);
            this.toastr.error(`Error`, `Unable to parse file`);
            return null;
          }
        case 'places':
          if (
            trimmedLine !== arcsAttribute &&
            trimmedLine !== transitionsAttribute
          ) {
            const place = this.parsePlace(trimmedLine);

            if (!addPlace(petriNet, place)) {
              this.toastr.warning(
                `File contains duplicate places`,
                `Duplicate places are ignored`
              );
            }
            break;
          } else if (trimmedLine === arcsAttribute) {
            currentParsingState = 'arcs';
            break;
          } else if (trimmedLine === transitionsAttribute) {
            currentParsingState = 'transitions';
            break;
          } else {
            errors.add(`Unable to parse file`);
            this.toastr.error(`Error`, `Unable to parse file`);
            return null;
          }
        case 'arcs':
          if (
            trimmedLine !== transitionsAttribute &&
            trimmedLine !== placesAttribute
          ) {
            let source: string, target: string, weight: number;
            const breakpoints: Breakpoint[] = [];

            if (this.arcRegex.test(trimmedLine)) {
              const match = this.arcRegex.exec(trimmedLine);

              if (match) {
                source = match[1];
                target = match[2];
                weight = Number(match[3]);
              } else {
                const splitLine = trimmedLine.split(' ');
                source = splitLine[0];
                target = splitLine[1];
                weight = Number(splitLine[2]);
              }

              const elements = getElementsWithArcs(petriNet);
              const parsedSource = elements.find(
                (transition) => transition.id === source
              );
              const parsedTarget = elements.find(
                (transition) => transition.id === target
              );
              if (!parsedSource || !parsedTarget) {
                this.toastr.error(
                  `An arc between ${source} and ${target} is invalid`,
                  `Unable to parse file`
                );
                errors.add(`An arc between ${source} and ${target} is invalid`);
                throw Error(
                  `An arc between ${source} and ${target} is invalid`
                );
              }

              const arc = {
                weight: weight || 1,
                source: source,
                target: target,
                breakpoints: breakpoints,
              };
              if (!addArc(petriNet, arc)) {
                this.toastr.warning(
                  `File contains duplicate arcs`,
                  `Duplicate arcs are ignored`
                );
              }
            } else {
              this.toastr.warning(
                `Invalid arcs are ignored`,
                `File contains invalid arcs`
              );
            }
            break;
          } else if (trimmedLine === transitionsAttribute) {
            currentParsingState = 'transitions';
            break;
          } else {
            errors.add(`Unable to parse file`);
            this.toastr.error(`Error`, `Unable to parse file`);
            return null;
          }
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

  private parseTransition(trimmedLine: string): Transition {
    const match = this.transitionRegex.exec(trimmedLine);
    const id = match ? match[1] : trimmedLine;
    const label = match ? match[2] || match[1] : trimmedLine;

    return {
      id,
      label,
      type: 'transition',
      incomingArcs: [],
      outgoingArcs: [],
    };
  }

  private parsePlace(trimmedLine: string): Place {
    const match = this.placeRegex.exec(trimmedLine);
    const id = match ? match[1] : trimmedLine;
    const tokens = match ? Number(match[2]) : 0;

    return {
      id,
      type: 'place',
      marking: isNaN(tokens) ? 0 : tokens,
      incomingArcs: [],
      outgoingArcs: [],
    };
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
