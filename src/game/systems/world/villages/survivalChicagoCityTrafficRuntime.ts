import * as THREE from "three";
import { lerpNumber } from "../survival/survivalMath";
import { type ChicagoCar, type ChicagoPedestrian } from "./survivalChicagoCityLayout";

export type ChicagoVehicleTransform = {
  x: number;
  z: number;
  yaw: number;
};

export type ChicagoCarInstance = {
  car: ChicagoCar;
  index: number;
};

export type ChicagoCarColorGroup = {
  color: string;
  items: ChicagoCarInstance[];
};

export function writeChicagoVehicleTransform(target: ChicagoVehicleTransform, car: ChicagoCar, elapsedSeconds: number) {
  let t = (car.offset + elapsedSeconds * car.speed) % 1;
  if (car.direction < 0) t = 1 - t;
  const spanStart = -218;
  const spanEnd = 190;
  const position = lerpNumber(spanStart, spanEnd, t);

  if (car.route === "vertical" || car.route === "lakeshore") {
    target.x = car.route === "lakeshore" ? 190 : car.lane + car.direction * 4.2;
    target.z = position;
    target.yaw = car.direction > 0 ? 0 : Math.PI;
    return target;
  }

  target.x = position;
  target.z = car.lane - car.direction * 4.2;
  target.yaw = car.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
  return target;
}

export function getChicagoPedestrianTransform(pedestrian: ChicagoPedestrian, elapsedSeconds: number): ChicagoVehicleTransform {
  let t = (pedestrian.offset + elapsedSeconds * pedestrian.speed) % 1;
  if (pedestrian.direction < 0) t = 1 - t;
  const position = lerpNumber(-214, 174, t);

  if (pedestrian.route === "vertical") {
    return {
      x: pedestrian.lane + pedestrian.sideOffset,
      z: position,
      yaw: pedestrian.direction > 0 ? 0 : Math.PI,
    };
  }

  return {
    x: position,
    z: pedestrian.lane + pedestrian.sideOffset,
    yaw: pedestrian.direction > 0 ? Math.PI / 2 : -Math.PI / 2,
  };
}

export function setChicagoInstancedPart(
  dummy: THREE.Object3D,
  mesh: THREE.InstancedMesh,
  index: number,
  baseX: number,
  baseY: number,
  baseZ: number,
  yaw: number,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  rotationX = 0,
  rotationZ = 0,
) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  dummy.position.set(
    baseX + cos * offsetX + sin * offsetZ,
    baseY + offsetY,
    baseZ - sin * offsetX + cos * offsetZ,
  );
  dummy.rotation.set(rotationX, yaw, rotationZ);
  dummy.scale.set(scaleX, scaleY, scaleZ);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

export function getChicagoCarLengthScale(car: ChicagoCar) {
  return car.vehicleType === "bus" ? 1.85 : car.vehicleType === "firetruck" ? 1.22 : car.vehicleType === "ambulance" ? 1.12 : 1;
}

export function getChicagoCarSideMarkColor(car: ChicagoCar) {
  return car.vehicleType === "taxi"
    ? "#111827"
    : car.vehicleType === "bus"
      ? "#2563eb"
      : car.vehicleType === "firetruck"
        ? "#f8fafc"
        : car.vehicleType === "sedan"
          ? "#fef3c7"
          : "#ef4444";
}

export function getChicagoCarLightBarColor(car: ChicagoCar) {
  return car.vehicleType === "police" ? "#2563eb" : car.vehicleType === "ambulance" ? "#ef4444" : "#facc15";
}

export function isChicagoLightBarVehicle(car: ChicagoCar) {
  return car.vehicleType === "police" || car.vehicleType === "ambulance" || car.vehicleType === "firetruck";
}

export function makeChicagoCarInstances(cars: ChicagoCar[]) {
  const items: ChicagoCarInstance[] = [];
  for (let index = 0; index < cars.length; index += 1) {
    items.push({ car: cars[index], index });
  }
  return items;
}

export function getChicagoTaxiCarInstances(carInstances: ChicagoCarInstance[]) {
  const items: ChicagoCarInstance[] = [];
  for (let index = 0; index < carInstances.length; index += 1) {
    const instance = carInstances[index];
    if (instance.car.vehicleType === "taxi") items.push(instance);
  }
  return items;
}

export function groupChicagoCarsByColor(
  cars: ChicagoCar[],
  getColor: (car: ChicagoCar) => string,
  shouldInclude: (car: ChicagoCar) => boolean = () => true,
) {
  const groups: ChicagoCarColorGroup[] = [];

  for (let index = 0; index < cars.length; index += 1) {
    const car = cars[index];
    if (!shouldInclude(car)) continue;
    const color = getColor(car);
    let group: ChicagoCarColorGroup | undefined;
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      if (groups[groupIndex].color === color) {
        group = groups[groupIndex];
        break;
      }
    }
    if (!group) {
      group = { color, items: [] };
      groups.push(group);
    }
    group.items.push({ car, index });
  }

  return groups;
}
