import { PetriNet } from '../../../classes/diagram/petri-net';
import { Place } from '../../../classes/diagram/place';
import { Transition } from '../../../classes/diagram/transition';

const encoding = '<?xml version="1.0" encoding="UTF-8"?>\n';

const transitionDimension = 40;

export function convertPetriNetToPnml(
  name: string,
  petriNet: PetriNet
): string {
  const transitionText = petriNet.transitions
    .map((element) => parseTransition(element))
    .join(`\n`);

  const placesText = parsePlaces(petriNet.places);
  const arcsText = parseArcs(petriNet);

  return `${encoding}
<pnml>
     <net id="" type="http://www.pnml.org/version-2009/grammar/ptnet">
          <name>
               <text>${name}</text>
          </name>
          <page id="p1">\n${transitionText}\n${placesText}\n${arcsText}
          </page>
     </net>
</pnml>`;
}

function parseTransition(transition: Transition): string {
  return `               <transition id="${transition.id}">
                    <name>
                        <text>${transition.label}</text>
                        <graphics>
                             <offset x="${transition.x ?? 0}" y="${
    (transition.y ?? 0) + transitionDimension
  }"/>
                        </graphics>
                    </name>
                    <graphics>
                         <position x="${transition.x ?? 0}" y="${
    transition.y ?? 0
  }"/>
                         <dimension x="${transitionDimension}" y="${transitionDimension}"></dimension>
                    </graphics>
               </transition>`;
}

function parsePlaces(places: Place[]): string {
  return places
    .map((place) => {
      return `               <place id="${place.id}">
                    <name>
                         <text>${place.id}</text>
                         <graphics>
                              <offset x="${place.x ?? 0}" y="${
        (place.y ?? 0) + transitionDimension ?? 0
      }"/>
                         </graphics>
                    </name>
                    <graphics>
                         <position x="${place.x ?? 0}" y="${place.y ?? 0}"/>
                    </graphics>
                    <initialMarking>
                         <text>${place.marking}</text>
                    </initialMarking>
               </place>`;
    })
    .join(`\n`);
}

function parseArcs(petriNet: PetriNet): string {
  return petriNet.arcs
    .map(
      (arc) => `               <arc id="A"
                    source="${arc.source}" target="${arc.target}">
                    <inscription>
                        <text>${arc.weight}</text>
                    </inscription>
                    <graphics/>
               </arc>`
    )
    .join(`\n `);
}
