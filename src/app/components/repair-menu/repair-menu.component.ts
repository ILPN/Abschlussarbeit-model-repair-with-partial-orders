import { OverlayRef } from '@angular/cdk/overlay';
import { Component, EventEmitter, OnInit } from '@angular/core';

import { SolutionType } from '../../algorithms/regions/ilp-solver/solver-classes';
import {
  AutoRepair,
  AutoRepairWithSolutionType,
} from '../../algorithms/regions/parse-solutions.fn';
import { NetCommandService } from '../../services/repair/net-command.service';
import { PlaceSolution } from '../../services/repair/repair.model';

type LabelWithTooltip = {
  label: string;
};

@Component({
  selector: 'app-repair-menu',
  templateUrl: './repair-menu.component.html',
  styleUrls: ['./repair-menu.component.scss'],
})
export class RepairMenuComponent implements OnInit {
  placeSolution!: PlaceSolution;
  partialOrderCount!: number;
  shownTextsForSolutions: { text: LabelWithTooltip; solution: AutoRepair }[] =
    [];
  overlayRef?: OverlayRef;

  infoHeader = '';

  applySolution = new EventEmitter<void>();

  constructor(private netCommandService: NetCommandService) {}

  ngOnInit(): void {
    if (this.placeSolution.type === 'warning') {
      this.infoHeader = `The place has ${this.placeSolution.tooManyTokens} too many tokens`;
      this.shownTextsForSolutions = [
        {
          text: {
            label: `<b>Change marking to ${
              this.placeSolution.reduceTokensTo
            }</b><br/>${getSubLabel(this.placeSolution)}`,
          },
          solution: {
            type: 'marking',
            newMarking: this.placeSolution.reduceTokensTo,
          },
        },
      ];
      return;
    }

    const percentage = Intl.NumberFormat('default', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
      .format(this.placeSolution.invalidTraceCount / this.partialOrderCount)
      .replace(' ', '');
    if (this.placeSolution.type === 'newTransition') {
      this.infoHeader = `The transition ${this.placeSolution.missingTransition} is missing for ${this.placeSolution.invalidTraceCount} traces (${percentage}).`;
      this.shownTextsForSolutions = this.generateSolutionToDisplay(
        this.placeSolution.solutions,
        true
      );
      return;
    }

    // this.infoHeader = `The place cannot fire for ${this.placeSolution.invalidTraceCount} (${percentage}) traces.<br/>`;

    if (this.placeSolution.missingTokens) {
      this.infoHeader += `${
        this.placeSolution.missingTokens
      } missing ${
        this.placeSolution.missingTokens === 1 ? 'token' : 'tokens'
      } | disables ${this.placeSolution.invalidTraceCount} trace${this.placeSolution.invalidTraceCount === 1 ? '' : 's'} (${percentage})<br/>`;
    }

    const solutions = this.placeSolution.solutions;
    if (!solutions) {
      console.error('No solution found!');
    } else {
      this.shownTextsForSolutions = this.generateSolutionToDisplay(solutions);
    }

    // this.infoHeader += 'Choose a solution to repair the place:';
  }

  useSolution(solution: AutoRepair): void {
    this.applySolution.next();

    if (this.placeSolution.type === 'newTransition') {
      this.netCommandService
        .repairNetForNewTransition(
          this.placeSolution.missingTransition,
          solution
        )
        .subscribe(() => this.overlayRef?.dispose());
    } else {
      this.netCommandService
        .repairNet(this.placeSolution.place, solution)
        .subscribe(() => this.overlayRef?.dispose());
    }
  }

  private generateSolutionToDisplay(
    solutions: AutoRepairWithSolutionType[],
    newTransition = false
  ): { text: LabelWithTooltip; solution: AutoRepair }[] {
    return solutions.map((solution) => ({
      text: generateTextForAutoRepair(solution, newTransition),
      solution,
    }));
  }
}

function generateTextForAutoRepair(
  solution: AutoRepairWithSolutionType,
  newTransition: boolean
): LabelWithTooltip {
  const baseText = generateBaseText(solution, newTransition);

  if (solution.type === 'replace-place') {
    return {
      label: `${baseText}${getSubLabel(solution)}`,
    };
  }
  if (solution.type === 'marking') {
    return {
      label: `${baseText}${getSubLabel(solution)}`,
    };
  }

  return {
    label: `${baseText}${getSubLabel(solution)}`,
  };
}

const solutionTypeToText: { [key in SolutionType]: string } = {
  changeMarking: 'Add tokens',
  changeIncoming: 'Add arcs',
  multiplePlaces: 'Split place',
};

function getSubLabel(solution: { regionSize: number }): string {
  return `<span>Solution size: ${solution.regionSize}</span>`;
}

function generateBaseText(
  solution: AutoRepairWithSolutionType,
  newTransition: boolean
): string {
  let text = solutionTypeToText[solution.repairType];

  if (solution.type === 'marking') {
    text = 'Add tokens';
  }
  if (newTransition) {
    if (solution.type === 'modify-place') {
      text = `Add minimal region`;
    }
    if (solution.type === 'replace-place') {
      text = `Add minimal region`;
    }
  }
  return `<b>${text}</b></br>`;
}
