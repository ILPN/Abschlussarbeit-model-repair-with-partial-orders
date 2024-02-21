import { Point } from '@angular/cdk/drag-drop';
import { Injectable } from '@angular/core';

import { Arc, Breakpoint } from '../../classes/diagram/arc';
import { ConcreteElement } from '../../classes/diagram/draggable';
import { getElementsWithArcs } from '../../classes/diagram/functions/net-helper.fn';
import { PetriNet } from '../../classes/diagram/petri-net';
import { Place } from '../../classes/diagram/place';
import { Transition } from '../../classes/diagram/transition';
import { getSvgOffset } from '../../components/canvas/bind-events.fn';
import {
  ARC_END_STYLE,
  ARC_STYLE,
  DRAG_POINT_STYLE,
  PLACE_STYLE,
  TEXT_STYLE, TOKEN_STYLE,
  TRANSITION_STYLE
} from '../element-style';
import { RepairService } from '../repair/repair.service';
import { idAttribute } from './svg-constants';

const hashAttribute = 'element-hash';

const foreignElementHeight = 40;
const foreignElementWidth = 120;

const foreignElementXOffset = foreignElementWidth / 2;
const foreignElementYOffset = foreignElementHeight / 2 - 5;

@Injectable({
  providedIn: 'root',
})
export class SvgService {
  private readonly TEXT_OFFSET = 20;
  private readonly ARC_WEIGHT_OFFSET_VERTICAL = 15;
  private readonly ARC_WEIGHT_OFFSET_HORIZONTAL = 10;

  private lastElements: SVGElement[] = [];
  private currentElements: SVGElement[] = [];

  constructor(private repairService: RepairService) {}

  createNetElements(
    net: PetriNet,
    offset: Point,
    renderChanges: boolean
  ): Array<SVGElement> {
    const result: Array<SVGElement> = [];
    for (const transition of net.transitions) {
      result.push(...this.createTransitionElement(transition, offset));
    }
    for (const place of net.places) {
      result.push(...this.createPlaceElement(place, offset));
    }

    const elements = getElementsWithArcs(net);
    for (const arc of net.arcs) {
      result.push(...this.createArc(elements, arc, offset));
    }

    if (this.lastElements.length > 0) {
      const newElements = result.filter(
        (element) =>
          !this.lastElements.find(
            (lastElement) =>
              lastElement.getAttribute(hashAttribute) ===
              element.getAttribute(hashAttribute)
          )
      );
      newElements.forEach((element) => {
        element.classList.add('new-svg-element');
        if (element.tagName === 'line' && element.hasAttribute('marker-end')) {
          element.setAttribute('marker-end', 'url(#arrowhead-changed)');
        }

        const titleEl = this.createSvgElement('title');
        titleEl.textContent =
          'This element was changed or added since the last display.';
        element.appendChild(titleEl);
      });
    }

    if (renderChanges) {
      this.lastElements = this.currentElements;
      this.currentElements = result;
    }

    return result;
  }

  private createTransitionElement(
    transition: Transition,
    offset: Point
  ): Array<SVGElement> {
    const transEl = this.createSvgElement('rect');
    transEl.setAttribute(idAttribute, transition.id);
    transEl.setAttribute(hashAttribute, transition.id);
    const style = TRANSITION_STYLE;
    transEl.setAttribute(
      'x',
      '' + (getNumber(transition.x) - parseInt(style.width) / 2 + offset.x)
    );
    transEl.setAttribute(
      'y',
      '' + (getNumber(transition.y) - parseInt(style.height) / 2 + offset.y)
    );
    this.applyStyle(transEl, style);

    registerSvgForElement(transition, transEl);

    const textEl = this.createForeignElement(
      transition.id,
      transition.label as string
    );
    textEl.setAttribute(
      'x',
      '' + (getNumber(transition.x) + offset.x - foreignElementXOffset)
    );
    textEl.setAttribute(
      'y',
      '' +
        (getNumber(transition.y) +
          parseInt(style.height) / 2 +
          this.TEXT_OFFSET +
          offset.y -
          foreignElementYOffset)
    );
    return [transEl, textEl];
  }

  private createPlaceElement(place: Place, offset: Point): Array<SVGElement> {
    const placeEl = this.createSvgElement('circle');
    placeEl.classList.add('place');
    placeEl.setAttribute(idAttribute, place.id);
    placeEl.setAttribute(hashAttribute, `${place.id}-${place.marking}`);
    placeEl.setAttribute('cx', '' + (getNumber(place.x) + offset.x));
    placeEl.setAttribute('cy', '' + (getNumber(place.y) + offset.y));
    this.applyStyle(placeEl, PLACE_STYLE);

    registerSvgForElement(place, placeEl);

    const textEl = this.createForeignElement(place.id);
    textEl.setAttribute(
      'x',
      '' + (getNumber(place.x) + offset.x - foreignElementXOffset)
    );
    textEl.setAttribute(
      'y',
      '' +
        (getNumber(place.y) +
          parseInt(PLACE_STYLE.r) +
          this.TEXT_OFFSET +
          offset.y -
          foreignElementYOffset)
    );
    const result = [placeEl, textEl];

    if (place.issueStatus) {
      if (place.issueStatus === 'warning') {
        placeEl.classList.add('place--warning');
        placeEl.setAttribute('stroke', 'var(--warn-color)');

        const titleEl = this.createSvgElement('title');
        titleEl.textContent =
          'Place can be improved. Click to see possibilities to solve the issue!';
        placeEl.appendChild(titleEl);
      } else {
        placeEl.classList.add('place--invalid');
        placeEl.setAttribute('stroke', 'var(--error-color)');

        const titleEl = this.createSvgElement('title');
        titleEl.textContent =
          'Invalid place. Click to see possibilities to solve the issue!';
        placeEl.appendChild(titleEl);
      }

      const markingEl = this.createTextElementForPlaceContent(
        place.id,
        place.issueStatus === 'warning' ? '?' : '!'
      );
      markingEl.setAttribute('x', '' + (getNumber(place.x) + offset.x));
      markingEl.setAttribute('y', '' + (getNumber(place.y) + offset.y));
      markingEl.setAttribute('width', '48');
      markingEl.setAttribute('height', '48');
      markingEl.setAttribute(
        'stroke',
        place.issueStatus === 'warning'
          ? 'var(--warn-color)'
          : 'var(--error-color)'
      );
      markingEl.setAttribute('font-size', '2em');
      result.push(markingEl);

      placeEl.addEventListener('mouseup', () => {
        if (
          place.x === place.preDragPosition?.x &&
          place.y === place.preDragPosition?.y
        ) {
          this.repairService.showRepairPopover(
            placeEl.getBoundingClientRect(),
            place.id
          );
        }
      });
    } else if (place.marking > 0 && place.marking <= 9) {
      const tokens = [];
      const px = getNumber(place.x) + offset.x;
      const py = getNumber(place.y) + offset.y;
      for (const offset of [{x: -1, y: 1}, {x: -1, y: -1}, {x: -1, y: 0}, {x: 0, y: -1}]) {
        for (const flip of [1, -1]) {
          tokens.push(this.createTokenSvg(px, py, 11 * offset.x * flip, 11 * offset.y * flip));
        }
      }
      tokens.push(this.createTokenSvg(px, py, 0,0));
      // decide visibility
      for (let i = 0; i < (place.marking - 1) / 2; i++) {
        result.unshift(tokens[2 * i]);
        result.unshift(tokens[2 * i + 1]);
      }
      if (place.marking % 2 === 1) {
        result.unshift(tokens[8]);
      }
    } else if (place.marking > 9) {
      const markingEl = this.createTextElementForPlaceContent(
        place.id,
        '' + place.marking
      );
      placeEl.setAttribute(hashAttribute, `${place.id}-${place.marking}-text`);
      markingEl.setAttribute('x', '' + (getNumber(place.x) + offset.x));
      markingEl.setAttribute('y', '' + (getNumber(place.y) + offset.y));
      markingEl.setAttribute('font-size', '1.5em');
      result.push(markingEl);
    }

    return result;
  }

  private createArc(
    elements: (Transition | Place)[],
    arc: Arc,
    offset: Point
  ): Array<SVGElement> {
    const source = elements.find((element) => element.id === arc.source);
    const target = elements.find((element) => element.id === arc.target);
    if (!source || !target) {
      return [];
    }

    let sourcePoint;
    let destinationPoint;
    if (source.type === 'place') {
      if (arc.breakpoints.length > 0) {
        sourcePoint = this.computePlacePoint(source, arc.breakpoints[0]);
        destinationPoint = this.computeTransitionPoint(
          target as Transition,
          arc.breakpoints[arc.breakpoints.length - 1]
        );
      } else {
        sourcePoint = this.computePlacePoint(source, getPoint(target));
        destinationPoint = this.computeTransitionPoint(
          target as Transition,
          getPoint(source)
        );
      }
    } else if (source.type === 'transition') {
      if (arc.breakpoints.length > 0) {
        sourcePoint = this.computeTransitionPoint(source, arc.breakpoints[0]);
        destinationPoint = this.computePlacePoint(
          target as Place,
          arc.breakpoints[arc.breakpoints.length - 1]
        );
      } else {
        sourcePoint = this.computeTransitionPoint(source, getPoint(target));
        destinationPoint = this.computePlacePoint(
          target as Place,
          getPoint(source)
        );
      }
    } else {
      throw new Error(
        'Unexpected arc source type! Arc source is neither Place nor Transition.'
      );
    }
    const result = this.createSvgLines(
      arc,
      sourcePoint,
      destinationPoint,
      offset
    );
    if (arc.weight > 1) {
      const location = this.computeWeightPoint(
        sourcePoint,
        destinationPoint,
        arc
      );
      const arcId = `${arc.source}-${arc.target}`;
      const weightEl = this.createTextElement(arcId, '' + arc.weight);
      weightEl.setAttribute('x', '' + (location.x + offset.x));
      weightEl.setAttribute('y', '' + (location.y + offset.y));
      result.push(weightEl);
    }
    return result;
  }

  private createSvgLines(
    arc: Arc,
    src: Point,
    dest: Point,
    offset: Point
  ): Array<SVGElement> {
    const result = [];
    const id = `${arc.source}-${arc.target}-${arc.weight}`;
    const points = [src, ...arc.breakpoints, dest];
    for (let i = 0; i < points.length - 1; i++) {
      result.push(this.createSvgLine(points[i], points[i + 1], offset, id));
    }
    this.applyStyle(result[result.length - 1], ARC_END_STYLE);
    for (let i = 0; i < arc.breakpoints.length; i++) {
      result.push(this.createSvgDragPoint(arc.breakpoints[i], offset));
    }
    return result;
  }

  private createSvgLine(
    src: Point,
    dest: Point,
    offset: Point,
    id: string
  ): SVGElement {
    const result = this.createSvgElement('line');
    this.applyStyle(result, ARC_STYLE);
    result.setAttribute(hashAttribute, id);
    result.setAttribute('x1', '' + (src.x + offset.x));
    result.setAttribute('y1', '' + (src.y + offset.y));
    result.setAttribute('x2', '' + (dest.x + offset.x));
    result.setAttribute('y2', '' + (dest.y + offset.y));
    return result;
  }

  private createSvgDragPoint(dragPoint: Breakpoint, offset: Point): SVGElement {
    const result = this.createSvgElement('circle');
    this.applyStyle(result, DRAG_POINT_STYLE);
    result.classList.add('drag-point');
    result.setAttribute('cx', '' + (dragPoint.x + offset.x));
    result.setAttribute('cy', '' + (dragPoint.y + offset.y));
    registerSvgForElement(dragPoint, result);
    return result;
  }

  private computePlacePoint(place: Place, destinationCenter: Point): Point {
    const placeCenter = { x: getNumber(place.x), y: getNumber(place.y) };
    const delta = this.computeDeltas(placeCenter, destinationCenter);
    let lineAngle = Math.atan(Math.abs(delta.y / delta.x));
    if (delta.x < 0) {
      lineAngle = Math.PI - lineAngle;
    }
    if (-delta.y < 0) {
      lineAngle = -lineAngle;
    }
    return {
      x: placeCenter.x + Math.cos(lineAngle) * parseInt(PLACE_STYLE.r),
      y: placeCenter.y - Math.sin(lineAngle) * parseInt(PLACE_STYLE.r),
    };
  }

  private computeTransitionPoint(
    transition: Transition,
    destinationCenter: Point
  ): Point {
    const transitionCenter = getPoint(transition);
    const delta = this.computeDeltas(transitionCenter, destinationCenter);
    const deltaQ = Math.abs(delta.y / delta.x);
    const xSign = Math.sign(delta.x);
    const ySign = Math.sign(delta.y);
    const style = TRANSITION_STYLE;
    const halfWidth = parseInt(style.width) / 2;
    const halfHeight = parseInt(style.height) / 2;
    const quadrantThreshold = this.computeRectDiagonalThreshold();
    if (deltaQ < quadrantThreshold) {
      return {
        x: transitionCenter.x + xSign * halfWidth,
        y: transitionCenter.y + ySign * deltaQ * halfWidth,
      };
    } else {
      return {
        x: transitionCenter.x + xSign * (1 / deltaQ) * halfHeight,
        y: transitionCenter.y + ySign * halfHeight,
      };
    }
  }

  private computeWeightPoint(
    source: Point,
    destination: Point,
    arc: Arc
  ): Point {
    if (arc.breakpoints.length > 0) {
      if (arc.breakpoints.length % 2 === 1) {
        const center = arc.breakpoints[(arc.breakpoints.length - 1) / 2];
        return {
          x: center.x + this.ARC_WEIGHT_OFFSET_HORIZONTAL,
          y: center.y + this.ARC_WEIGHT_OFFSET_VERTICAL,
        };
      } else {
        const centerIndex = arc.breakpoints.length / 2;
        source = arc.breakpoints[centerIndex - 1];
        destination = arc.breakpoints[centerIndex];
      }
    }

    const delta = this.computeDeltas(source, destination);
    const corner = {
      x: Math.min(source.x, destination.x),
      y: Math.min(source.y, destination.y),
    };
    const center = {
      x: corner.x + Math.abs(delta.x / 2),
      y: corner.y + Math.abs(delta.y / 2),
    };
    const xSign = Math.sign(delta.x);
    const ySign = Math.sign(delta.y);
    if (xSign === ySign || xSign === 0 || ySign === 0) {
      return {
        x: center.x + this.ARC_WEIGHT_OFFSET_HORIZONTAL,
        y: center.y - this.ARC_WEIGHT_OFFSET_VERTICAL,
      };
    } else {
      return {
        x: center.x + this.ARC_WEIGHT_OFFSET_HORIZONTAL,
        y: center.y + this.ARC_WEIGHT_OFFSET_VERTICAL,
      };
    }
  }

  private computeRectDiagonalThreshold(): number {
    const style = TRANSITION_STYLE;
    const height = parseInt(style.height);
    const width = parseInt(style.width);
    return height / width;
  }

  private computeDeltas(start: Point, end: Point): Point {
    return {
      x: end.x - start.x,
      y: end.y - start.y,
    };
  }

  private applyStyle(element: SVGElement, style: object) {
    for (const entry of Object.entries(style)) {
      element.setAttribute(entry[0], entry[1]);
    }
  }

  private createTextElement(id: string, content?: string): SVGElement {
    const result = this.createSvgElement('text');
    result.setAttribute('describes', id);
    result.setAttribute(hashAttribute, `${id}-${content}`);
    this.applyStyle(result, TEXT_STYLE);
    result.textContent = content ?? id;
    return result;
  }

  private createForeignElement(id: string, content?: string): SVGElement {
    const result = this.createSvgElement('foreignObject');
    result.setAttribute('height', `${foreignElementHeight}`);
    result.setAttribute('width', `${foreignElementWidth}`);
    result.setAttribute('describes', id);
    result.setAttribute(hashAttribute, `${id}-${content}`);
    this.applyStyle(result, TEXT_STYLE);

    const span = document.createElement('span');
    span.setAttribute('title', content ?? id);
    span.textContent = content ?? id;
    result.append(span);

    return result;
  }

  private createTextElementForPlaceContent(
    id: string,
    content?: string
  ): SVGElement {
    const result = this.createSvgElement('text');
    result.setAttribute('content-of', id);
    this.applyStyle(result, TEXT_STYLE);
    result.textContent = content ?? id;
    return result;
  }

  private createTokenSvg(px: number, py: number, cxDelta: number, cyDelta: number): SVGElement {
    const token = this.createSvgElement('circle');
    this.applyStyle(token, TOKEN_STYLE);
    token.setAttribute('cx', `${px + cxDelta}`);
    token.setAttribute('cy', `${py + cyDelta}`);
    return token;
  }

  private createSvgElement(name: string): SVGElement {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
  }
}

function getNumber(number: number | undefined): number {
  return number ?? 0;
}

function getPoint(element: ConcreteElement): Point {
  return {
    x: getNumber(element.x),
    y: getNumber(element.y),
  };
}

function registerSvgForElement(
  element: ConcreteElement,
  svg: SVGElement
): void {
  element.element = svg;
  element.element.onmousedown = (event) => {
    if (element.element === undefined) {
      return;
    }
    event.stopPropagation();
    element.dragging = true;
    element.preDragPosition = { x: element.x ?? 0, y: element.y ?? 0 };
    element.svgOffset = getSvgOffset(element);
    element.lastPoint = { x: event.x, y: event.y };
  };
}
