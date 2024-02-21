export type JsonLog = Array<JsonTrace>;

export interface JsonTrace {
  trace: Array<string>;
  order?: Array<[number, number]>;
}
