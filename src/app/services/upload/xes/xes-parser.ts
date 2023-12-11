import { parseXml } from '../xml-parser.fn';
import { XesEvent, XesString, XesTrace, XesWrapper } from './xes.model';

const logStart = `.type log
.attributes
case-id
concept:name
event-id
follows[]
.events`;

export function parseXesFileToCustomLogFormat(xmlContent: string): string {
  const xes: XesWrapper = parseXml(xmlContent);
  const traces = xes.log.trace;

  let text = logStart;

  for (let i = 0; i < traces.length; i++) {
    const trace = traces[i];
    const traceId = xesFind(trace, 'concept:name') ?? i;

    const filteredEvents = trace.event.filter((event) => {
      const lifecycle = xesFind(event, 'lifecycle:transition');
      return lifecycle === undefined || lifecycle === 'complete';
    });

    for (let j = 0; j < filteredEvents.length; j++) {
      const event = trace.event[j];
      const eventName = xesFind(event, 'concept:name');
      if (!eventName) {
        throw Error(`Event name is not defined in trace ${i} and event ${j}!`);
      }

      const replacedEventName = eventName.replace(/\s/g, '_');
      text += `\n${traceId} ${replacedEventName} ${j}`;
    }
  }

  return text;
}

function xesFind(stringsContainer: XesEvent, key: string): string | undefined {
  if (Array.isArray(stringsContainer.string)) {
    return stringsContainer.string.find((s) => s.key === key)?.value;
  } else {
    if (stringsContainer.string['key'] === key) {
      return  stringsContainer.string['value'];
    }
  }
  return undefined;
}
