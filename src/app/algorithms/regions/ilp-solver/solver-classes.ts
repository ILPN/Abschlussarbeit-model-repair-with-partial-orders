import { LP, Result } from 'glpk.js';

import { Constraint } from './solver-constants';

export type SubjectTo = {
  name: string;
  vars: Array<Variable>;
  bnds: Bound;
};

export type Variable = {
  name: string;
  coef: number;
};

export type Bound = {
  type: Constraint;
  ub: number;
  lb: number;
};

export enum VariableType {
  INITIAL_MARKING,
  OUTGOING_TRANSITION_WEIGHT,
  INCOMING_TRANSITION_WEIGHT,
}

export interface SolutionVariable {
  label: string;
  type: VariableType;
}

export type SolutionType =
  | 'unbounded'
  | 'sameIncming'
  | 'sameOutgoing'
  | 'arcsSame';

export interface ProblemSolutionWithoutType {
  ilp: LP;
  solution: Result;
}

export interface ProblemSolution extends ProblemSolutionWithoutType {
  type: SolutionType;
}

export enum VariableName {
  INITIAL_MARKING = 'm0',
  OUTGOING_ARC_WEIGHT_PREFIX = 'out',
  INGOING_ARC_WEIGHT_PREFIX = 'in',
}
