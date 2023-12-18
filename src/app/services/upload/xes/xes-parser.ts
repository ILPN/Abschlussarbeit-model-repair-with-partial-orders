import { JsonLog, JsonTrace } from '../../../classes/json-log';
import { parseXml } from '../xml-parser.fn';
import { XesEvent, XesWrapper } from './xes.model';


export function parseXesFileToCustomLogFormat(xmlContent: string): string {
  const xes: XesWrapper = parseXml(xmlContent);
  const traces = xes.log.trace;

  const logObject: JsonLog = [];

  for (let i = 0; i < traces.length; i++) {
    const trace = traces[i];

    const filteredEvents = trace.event.filter((event) => {
      const lifecycle = xesFind(event, 'lifecycle:transition');
      return lifecycle === undefined || lifecycle === 'complete';
    });

    const traceObject: JsonTrace = {trace: []};

    for (let j = 0; j < filteredEvents.length; j++) {
      const event = filteredEvents[j];
      const eventName = xesFind(event, 'concept:name');
      if (!eventName) {
        throw Error(`Event name is not defined in trace ${i} and event ${j}!`);
      }

      const replacedEventName = eventName.replace(/\s/g, '_');
      traceObject.trace.push(replacedEventName);
    }

    logObject.push(traceObject);
  }

  return JSON.stringify(logObject, null, 4);
}

function xesFind(stringsContainer: XesEvent, key: string): string | undefined {
  if (Array.isArray(stringsContainer.string)) {
    return stringsContainer.string.find((s) => s.key === key)?.value;
  } else {
    if (stringsContainer.string['key'] === key) {
      return stringsContainer.string['value'];
    }
  }
  return undefined;
}
