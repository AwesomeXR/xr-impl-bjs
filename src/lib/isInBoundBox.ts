import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export function isInBoundBox(center: Vector3, size: Vector3, point: Vector3) {
  const xr = [center.x - size.x / 2, center.x + size.x / 2];
  const yr = [center.y - size.y / 2, center.y + size.y / 2];
  const zr = [center.z - size.z / 2, center.z + size.z / 2];

  const xInRange = xr[0] <= point.x && point.x <= xr[1];
  const yInRange = yr[0] <= point.y && point.y <= yr[1];
  const zInRange = zr[0] <= point.z && point.z <= zr[1];

  return xInRange && yInRange && zInRange;
}
