import {
  MAX_ENGINE_PLACED_OBJECTS,
  type EnginePlacedObjectRecord,
} from "./enginePlacedObjectStorage";

export function cloneEnginePlacedObjects(objects: EnginePlacedObjectRecord[]) {
  const cloned = new Array<EnginePlacedObjectRecord>(objects.length);
  for (let index = 0; index < objects.length; index += 1) {
    cloned[index] = { ...objects[index] };
  }
  return cloned;
}

export function hasEnginePlacedObjectId(objects: EnginePlacedObjectRecord[], instanceId: string) {
  for (let index = 0; index < objects.length; index += 1) {
    if (objects[index].instanceId === instanceId) return true;
  }
  return false;
}

export function findEnginePlacedObjectById(objects: EnginePlacedObjectRecord[], instanceId: string) {
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (object.instanceId === instanceId) return object;
  }
  return undefined;
}

export function removeEnginePlacedObjectById(objects: EnginePlacedObjectRecord[], instanceId: string) {
  let removeIndex = -1;
  for (let index = 0; index < objects.length; index += 1) {
    if (objects[index].instanceId === instanceId) {
      removeIndex = index;
      break;
    }
  }
  if (removeIndex < 0) return objects;

  const next = new Array<EnginePlacedObjectRecord>(objects.length - 1);
  for (let index = 0; index < removeIndex; index += 1) {
    next[index] = objects[index];
  }
  for (let index = removeIndex + 1; index < objects.length; index += 1) {
    next[index - 1] = objects[index];
  }
  return next;
}

export function replaceEnginePlacedObjectById(
  objects: EnginePlacedObjectRecord[],
  instanceId: string,
  replacement: EnginePlacedObjectRecord,
) {
  let replaced = false;
  const next = new Array<EnginePlacedObjectRecord>(objects.length);
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (object.instanceId === instanceId) {
      next[index] = replacement;
      replaced = true;
    } else {
      next[index] = object;
    }
  }
  return replaced ? next : objects;
}

export function appendEnginePlacedObjectBounded(
  objects: EnginePlacedObjectRecord[],
  object: EnginePlacedObjectRecord,
) {
  const existingCount = Math.min(objects.length, MAX_ENGINE_PLACED_OBJECTS - 1);
  const next = new Array<EnginePlacedObjectRecord>(existingCount + 1);
  const startIndex = Math.max(0, objects.length - existingCount);
  for (let index = 0; index < existingCount; index += 1) {
    next[index] = objects[startIndex + index];
  }
  next[existingCount] = object;
  return next;
}
