import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import * as core from 'xr-core';

export function toInnerVec<T extends core.Vector3 | core.Vector2>(
  vec: T,
  clone?: boolean
): T extends core.Vector3 ? Vector3 : Vector2 {
  if (!clone) return vec as any; // 鸭子类型等价转换

  const cls = vec.getClassName();
  if (cls === 'Vector3') return Vector3.FromArray(vec.asArray()) as any;
  if (cls === 'Vector2') return Vector2.FromArray(vec.asArray()) as any;

  throw new Error('vec is not vector2/vector3');
}

export function toOuterVec<T extends Vector3 | Vector2>(
  vec: T,
  clone?: boolean
): T extends Vector3 ? core.Vector3 : core.Vector2 {
  if (!clone) return vec as any; // 鸭子类型等价转换

  const cls = vec.getClassName();
  if (cls === 'Vector3') return core.Vector3.FromArray(vec.asArray()) as any;
  if (cls === 'Vector2') return core.Vector2.FromArray(vec.asArray()) as any;

  throw new Error('vec is not vector2/vector3');
}

export function toInnerColor<T extends core.Color3 | core.Color4>(
  vec: T,
  clone?: boolean
): T extends core.Color3 ? Color3 : Color4 {
  if (!clone) return vec as any; // 鸭子类型等价转换

  const cls = vec.getClassName();

  if (cls === 'Color3') return Color3.FromArray(vec.asArray()) as any;
  if (cls === 'Color4') return Color4.FromArray(vec.asArray()) as any;

  throw new Error('vec is not Color4/Color3');
}

export function toOuterColor<T extends Color3 | Color4>(
  vec: T,
  clone?: boolean
): T extends Color3 ? core.Color3 : core.Color4 {
  if (!clone) return vec as any; // 鸭子类型等价转换

  const cls = vec.getClassName();

  if (cls === 'Color3') return core.Color3.FromArray(vec.asArray()) as any;
  if (cls === 'Color4') return core.Color4.FromArray(vec.asArray()) as any;

  throw new Error('vec is not Color4/Color3');
}
