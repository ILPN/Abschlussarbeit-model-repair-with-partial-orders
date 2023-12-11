export type XesWrapper = {
  log: {
    trace: XesTrace[];
  };
};

export type XesTrace = {
  string: XesString[] | XesString;
  event: XesEvent[];
};

export type XesEvent = {
  string: XesString[] | XesString;
};

export type XesString = {
  key: string;
  value: string;
};
