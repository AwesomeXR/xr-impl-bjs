import { type SmartArray, type SubMesh, type Nullable, type InternalTexture } from '@babylonjs/core';
import { RenderingGroup } from '@babylonjs/core/Rendering/renderingGroup';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { Constants } from '@babylonjs/core/Engines/constants';
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2';

export function patch() {
  (RenderingGroup as any)._RenderSorted = function (
    subMeshes: SmartArray<SubMesh>,
    sortCompareFn: Nullable<(a: SubMesh, b: SubMesh) => number>,
    camera: Nullable<Camera>,
    transparent: boolean
  ): void {
    let subIndex = 0;
    let subMesh: SubMesh;

    const camForward = camera?.getScene().useRightHandedSystem
      ? Vector3.RightHandedForwardReadOnly
      : Vector3.LeftHandedForwardReadOnly;

    const _fixedPosition = camera?.metadata?.__fixProjection?.position;
    const _fixedDirection = camera?.metadata?.__fixProjection?.direction;

    const cameraPosition = _fixedPosition
      ? Vector3.FromArray(_fixedPosition)
      : camera
      ? camera.globalPosition
      : (RenderingGroup as any)._ZeroVector;

    const camDirection = _fixedDirection ? Vector3.FromArray(_fixedDirection) : camera?.getDirection(camForward);

    if (transparent) {
      for (; subIndex < subMeshes.length; subIndex++) {
        subMesh = subMeshes.data[subIndex];
        subMesh._alphaIndex = subMesh.getMesh().alphaIndex;

        // 当为正交相机的时候，算相机距离(平面垂直投影)
        if (camera && camera instanceof TargetCamera && camera.mode === Camera.ORTHOGRAPHIC_CAMERA && camDirection) {
          const vecLook = subMesh.getBoundingInfo().boundingSphere.centerWorld.subtract(cameraPosition);
          const cosValue = Vector3.Dot(vecLook, camDirection) / (vecLook.length() * camDirection.length());

          const _distanceToCamera = vecLook.length() * cosValue - camera.minZ;
          subMesh._distanceToCamera = _distanceToCamera;
        } else {
          // 这个是原方法
          subMesh._distanceToCamera = Vector3.Distance(
            subMesh.getBoundingInfo().boundingSphere.centerWorld,
            cameraPosition
          );
        }
      }
    }

    const sortedArray =
      subMeshes.length === subMeshes.data.length ? subMeshes.data : subMeshes.data.slice(0, subMeshes.length);

    if (sortCompareFn) {
      sortedArray.sort(sortCompareFn);
    }

    const scene = sortedArray[0].getMesh().getScene();
    for (subIndex = 0; subIndex < sortedArray.length; subIndex++) {
      subMesh = sortedArray[subIndex];

      if (scene._activeMeshesFrozenButKeepClipping && !subMesh.isInFrustum(scene._frustumPlanes)) {
        continue;
      }

      if (transparent) {
        const material = subMesh.getMaterial();

        if (material && material.needDepthPrePass) {
          const engine = material.getScene().getEngine();
          engine.setColorWrite(false);
          engine.setAlphaMode(Constants.ALPHA_DISABLE);
          subMesh.render(false);
          engine.setColorWrite(true);
        }
      }

      subMesh.render(transparent);
    }
  };

  const old_k_createTexture = (KhronosTextureContainer2.prototype as any)._createTexture;

  // 压缩纹理必须 invertY 始终为 false
  // https://github.com/BabylonJS/Babylon.js/issues/12545
  // https://github.com/BabylonJS/Babylon.js/issues/12349
  (KhronosTextureContainer2.prototype as any)._createTexture = function (
    data: any,
    internalTexture: InternalTexture,
    options?: any
  ) {
    internalTexture.invertY = false;
    return old_k_createTexture.call(this, data, internalTexture, options);
  };
}
