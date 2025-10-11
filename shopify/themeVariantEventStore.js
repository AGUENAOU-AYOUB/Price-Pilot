const MAX_STORED_EVENTS = 500;

const inMemoryEvents = [];

const cloneEvent = (event) => JSON.parse(JSON.stringify(event));

export const recordVariantSelection = (event) => {
  if (!event || typeof event !== 'object') {
    return;
  }

  inMemoryEvents.push(cloneEvent(event));

  if (inMemoryEvents.length > MAX_STORED_EVENTS) {
    inMemoryEvents.splice(0, inMemoryEvents.length - MAX_STORED_EVENTS);
  }
};

export const listVariantSelections = () => inMemoryEvents.map((event) => cloneEvent(event));

export const clearVariantSelections = () => {
  inMemoryEvents.length = 0;
};
