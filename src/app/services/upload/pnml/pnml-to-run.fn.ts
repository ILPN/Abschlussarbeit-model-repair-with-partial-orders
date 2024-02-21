import { parseXml } from '../xml-parser.fn';
import { PnmlPage, PnmlWrapper } from './pnml.type';
import { JsonPetriNet } from '../../parser/json-petri-net';
import { generateTextFromNetJsonObject } from '../../parser/net-to-text.func';

export function getRunTextFromPnml(xmlContent: string): string {
  const pnml: PnmlWrapper = parseXml(xmlContent);
  const page: PnmlPage = pnml.pnml.net.page ?? pnml.pnml.net;

  const netObject: JsonPetriNet = {
    transitions: [],
    places: []
  };

  const idToLabelMap = new Map<string, string>();
  page.transition.forEach((transition) => {
    const name = transition.name?.text;
    if (name) {
      const nm = name.replace(/\s/g, '_');
      idToLabelMap.set(transition.id, nm);
      netObject.transitions.push(nm);
    } else {
      netObject.transitions.push(transition.id);
    }
  });

  page.place.forEach((place) => {
    netObject.places.push(place.id);
    const m = place.initialMarking?.text ?? 0;
    if (m > 0) {
      if (netObject.marking === undefined) {
        netObject.marking = {};
      }
      netObject.marking[place.id] = m;
    }
  });

  page.arc.forEach((arc) => {
    const s = idToLabelMap.get(arc.source) ?? arc.source;
    const t = idToLabelMap.get(arc.target) ?? arc.target;

    if (netObject.arcs === undefined) {
      netObject.arcs = {};
    }

    netObject.arcs[`${s},${t}`] = arc?.inscription?.text ?? 1;
  });

  return generateTextFromNetJsonObject(netObject);
}
