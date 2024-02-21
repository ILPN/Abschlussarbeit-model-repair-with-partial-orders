export interface TransitionStyle {
  width: string;
  height: string;
}

export const TRANSITION_STYLE = {
  rx: '1',
  ry: '1',
  width: '50',
  height: '50',
  stroke: 'black',
  'stroke-width': '2',
  'fill-opacity': '0',
};

export const PLACE_STYLE = {
  r: '25',
  stroke: 'black',
  'stroke-width': '2',
  'fill-opacity': '0',
};

export const ARC_STYLE = {
  stroke: 'black',
  'stroke-width': '1',
};

export const ARC_END_STYLE = {
  'marker-end': 'url(#arrowhead)',
};

export const DRAG_POINT_STYLE = {
  r: '10',
};

export const TEXT_STYLE = {
  'text-anchor': 'middle', // horizontal alignment
  'dominant-baseline': 'central', // vertical alignment
  'pointer-events': 'none',
  style: 'user-select: none',
};

export const TOKEN_STYLE = {
  r: '4',
  'fill': 'black',
  'fill-opacity': '1'
};
