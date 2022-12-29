import { Injectable } from '@angular/core';
import { GLPK } from 'glpk.js';
import { combineLatest, from, map, Observable, of, switchMap, tap } from 'rxjs';

import { PartialOrder } from '../../classes/diagram/partial-order';
import { PetriNet } from '../../classes/diagram/petri-net';
import {
  ParsableSolution,
  PlaceSolution,
} from '../../services/repair/repair.model';
import { RepairService } from '../../services/repair/repair.service';
import {
  IlpSolver,
  ProblemSolution,
  VariableType,
} from './ilp-solver/ilp-solver';
import { parseSolution } from './parse-solutions.fn';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const createGlpk: () => Promise<GLPK> = require('glpk.js').default;

@Injectable({
  providedIn: 'root',
})
export class PetriNetRegionsService {
  constructor(private repairService: RepairService) {}

  computeRegions(
    partialOrders: PartialOrder[],
    petriNet: PetriNet,
    invalidPlaces: { [key: string]: number }
  ): Observable<PlaceSolution[]> {
    return from(createGlpk()).pipe(
      switchMap((glpk) => {
        const invalidPlaceList = Object.keys(invalidPlaces).flat();
        if (invalidPlaceList.length === 0) {
          return of([]);
        }

        const solver = new IlpSolver(glpk, partialOrders, petriNet);

        return combineLatest(
          invalidPlaceList.map((place) =>
            solver.computeSolutions(place).pipe(
              map((solutions) => {
                const placeSolution: PlaceSolution = {
                  place,
                  // TODO: Generate multiple solutions
                  solutions: parseSolution(
                    this.handleSolutions(solutions, solver)
                  ),
                  invalidTraceCount: invalidPlaces[place],
                };
                return placeSolution;
              })
            )
          )
        ).pipe(
          tap((solutions) => {
            console.log('Generated solutions', solutions);
            this.repairService.saveNewSolutions(
              solutions,
              partialOrders.length
            );
          })
        );
      })
    );
  }

  private handleSolutions(
    solutions: ProblemSolution[],
    solver: IlpSolver
  ): ParsableSolution[] {
    return solutions.flatMap((solution) =>
      Object.entries(solution.solution.result.vars)
        .filter(
          ([variable, value]) =>
            value !== 0 && solver.getInverseVariableMapping(variable) !== null
        )
        .map(([variable, value]) => {
          const decoded = solver.getInverseVariableMapping(variable)!;

          switch (decoded.type) {
            case VariableType.INITIAL_MARKING:
              return {
                type: 'increase-marking',
                newMarking: value,
              };
            case VariableType.INCOMING_TRANSITION_WEIGHT:
              return {
                type: 'incoming-arc',
                incoming: decoded.label,
                marking: value,
              };
            case VariableType.OUTGOING_TRANSITION_WEIGHT:
              return {
                type: 'outgoing-arc',
                outgoing: decoded.label,
                marking: value,
              };
          }
        })
    );
  }
}
