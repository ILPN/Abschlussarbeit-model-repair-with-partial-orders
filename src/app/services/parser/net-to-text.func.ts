import { PetriNet } from '../../classes/diagram/petri-net';
import { JsonPetriNet } from './json-petri-net';

export function generateJsonObjectFromNet(petriNet: PetriNet): JsonPetriNet {
  const netObject: JsonPetriNet = {
    transitions: [],
    places: [],
  };

  petriNet.transitions.forEach(t => {
    netObject.transitions.push(t.id);
  });

  petriNet.places.forEach(p => {
    netObject.places.push(p.id);
    if (p.marking > 0) {
      if (netObject.marking === undefined) {
        netObject.marking = {};
      }
      netObject.marking[p.id] = p.marking;
    }
  });

  petriNet.arcs.forEach(a => {
    if (netObject.arcs === undefined) {
      netObject.arcs = {};
    }
    netObject.arcs[`${a.source},${a.target}`] = a.weight;
  });

  return netObject;
}

export function generateTextFromNetJsonObject(petriNet: JsonPetriNet): string {
  return JSON.stringify(petriNet,null,4);
}

export function generateTextFromNet(petriNet: PetriNet): string {
  return generateTextFromNetJsonObject(generateJsonObjectFromNet(petriNet));
}
