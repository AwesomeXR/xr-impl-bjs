import { MemoryFS } from 'ah-memory-fs';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Engine } from '@babylonjs/core/Engines/engine';
import { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Scene } from '@babylonjs/core/scene';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Texture } from '@babylonjs/core/Materials/Textures';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GLTFFileLoader, GLTFLoaderAnimationStartMode } from '@babylonjs/loaders/glTF';
import { DefaultBrowserInfo } from './Browser';
import { DynamicOfflineProvider } from './lib/DynamicOfflineProvider';
import { getInternalRandomString } from './lib/getInternalRandomString';
import { IFlowHost } from 'ah-flow-node';
import { IViewportLike } from '@babylonjs/core/Maths/math.like';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { makeUniqueKey } from './lib/makeUniqueKey';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { setData } from './lib';

async function loadModel(scene: Scene, url: string, onProgress?: (pg: number) => any): Promise<AssetContainer> {
  return new Promise((resolve, reject) => {
    let isLoaded = false;

    const lastSlashIdx = url.lastIndexOf('/');
    const rootUrl = url.slice(0, lastSlashIdx + 1);
    const sceneFilename = url.slice(lastSlashIdx + 1);

    const loader = SceneLoader.LoadAssetContainer(
      rootUrl,
      sceneFilename,
      scene,
      // success
      container => {
        const { meshes, materials } = container;

        // 名称唯一化
        makeUniqueKey('name', container.getNodes());

        // 修正网格
        meshes.forEach(m => {
          if (m instanceof InstancedMesh) {
            // skip
          } else {
            m.receiveShadows = true;
          }
        });

        // 修正材质
        materials.forEach(m => {
          if (m instanceof PBRMaterial) {
            m.metallicF0Factor = 0;

            if (m.emissiveTexture && !m.albedoTexture) {
              m.emissiveColor = Color3.White();
              m.albedoColor = Color3.Black();
            }

            // cycle 下，blender 材质节点无透明通道贴图 & alpha < 1 的时候，不会设置 gltf 的 alphaMode。这里手动纠正。
            if (m.alpha < 1) {
              m.transparencyMode = 2; // ALPHABLEND
            }
          }

          if (m.needAlphaBlending()) {
            m.separateCullingPass = true;
          }
        });

        isLoaded = true;
        onProgress?.(1);

        resolve(container);
      },
      // progress
      evt => {
        // gltf 文件会先一步 loaded
        if (isLoaded) return;
        const progress = evt.lengthComputable ? evt.loaded / evt.total : 0.2;
        onProgress?.(progress);
      },
      // error
      (_s, _message, error) => reject(error)
    );

    if (loader instanceof GLTFFileLoader) {
      // 默认要先编译 Materials
      loader.compileMaterials = true;
    }

    if (loader instanceof GLTFFileLoader) {
      // 关掉动画自动播放
      loader.animationStartMode = GLTFLoaderAnimationStartMode.NONE;
    }
  });
}

export class BRCUtil {
  static loadModel = loadModel;

  static switchActiveCamera(camera: Camera) {
    const scene = camera.getScene();

    if (scene.activeCamera) {
      scene.activeCamera.detachControl();
    }

    scene.activeCamera = camera;
    camera.attachControl();
  }

  static calcDistanceToCamera(mesh: Mesh, camera?: Camera) {
    const scene = mesh.getScene();

    if (!camera) camera = scene.activeCamera || undefined;
    if (!camera) throw new Error('no camera');

    const boundingInfo = mesh.getBoundingInfo();
    const bSphere = boundingInfo.boundingSphere;

    return bSphere.centerWorld.subtract(camera.globalPosition).length();
  }

  static calcScreenCoverageRate(mesh: Mesh, camera?: Camera): number {
    const scene = mesh.getScene();

    if (!camera) camera = scene.activeCamera || undefined;
    if (!camera) throw new Error('no camera');

    const boundingInfo = mesh.getBoundingInfo();
    const bSphere = boundingInfo.boundingSphere;

    const distanceToCamera = bSphere.centerWorld.subtract(camera.globalPosition).length();
    const screenArea = camera.screenArea;

    let meshProjectR = (bSphere.radiusWorld * camera.minZ) / distanceToCamera;
    const meshArea = meshProjectR * meshProjectR * Math.PI;

    const rate = meshArea / screenArea;
    return rate;
  }

  /** 创建默认 Engine */
  static createEngine(canvas: HTMLCanvasElement, mfs: MemoryFS, opt: { hardwareScalingLevel?: number } = {}) {
    // iOS 15.4 bug，要关掉抗锯齿
    // @see https://forum.babylonjs.com/t/ios-15-4-1-display-bug-on-bjs-5-2-0-lots-of-overlap/29501
    const engine =
      DefaultBrowserInfo.device === 'Mobile' &&
      DefaultBrowserInfo.os === 'iOS' &&
      DefaultBrowserInfo.osVersion.startsWith('15.4')
        ? new Engine(canvas, false, { stencil: true, antialias: false, preserveDrawingBuffer: false })
        : new Engine(canvas, true, { stencil: true });

    engine.mfs = mfs;
    engine.setHardwareScalingLevel(opt.hardwareScalingLevel || 1 / window.devicePixelRatio);

    engine.doNotHandleContextLost = true; // 不需要支持WebGL上下文丢失事件

    // 禁用内置 loading
    engine.loadingScreen = {
      displayLoadingUI: () => {},
      hideLoadingUI: () => {},
      loadingUIBackgroundColor: '',
      loadingUIText: '',
    };

    // bjs v5.2.0 会给 data-engine 属性打标
    canvas.setAttribute('data-engine', 'XR');

    return engine;
  }

  /** 创建默认场景 */
  static createDefaultScene(engine: Engine, opt: { initCamera?: boolean } = {}) {
    const scene = new Scene(engine);
    (scene as any)._uid = getInternalRandomString(true);

    scene.offlineProvider = new DynamicOfflineProvider(engine.mfs);

    // 阻止 SceneLoader._LoadData 创建新的 offlineProvider
    scene.disableOfflineSupportExceptionRules = [/.*/];
    scene.clearColor = new Color4(0, 0, 0, 0);

    scene.skipPointerMovePicking = true; // 性能考虑，默认关掉指针移动 picking

    const ob1 = scene.onBeforeRenderObservable.add(() => {
      (scene as IFlowHost).event.emit('beforeRender', { _capture: true });
    });
    scene.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(ob1));

    // 点选过滤器
    scene.pointerDownPredicate = (mesh: AbstractMesh): boolean => {
      if ((mesh as any).__forcePickable) return true;

      return (
        mesh.isPickable &&
        mesh.isVisible &&
        mesh.isReady() &&
        mesh.isEnabled() &&
        (!scene.cameraToUseForPointers || (scene.cameraToUseForPointers.layerMask & mesh.layerMask) !== 0)
      );
    };

    // 默认相机
    if (opt.initCamera) {
      const camera = new ArcRotateCamera('default_camera', 0, Math.PI / 2, 10, Vector3.Zero(), scene, true);
      camera.useNaturalPinchZoom = true;
      camera.minZ = 0.1;
    }

    return scene;
  }

  static getCanvasProjectPosition(scene: Scene, position: Vector3, camera = scene.activeCamera): Vector2 | undefined {
    if (!camera) return;

    const engine = scene.getEngine();
    const width = engine.getRenderWidth() * engine.getHardwareScalingLevel();
    const height = engine.getRenderHeight() * engine.getHardwareScalingLevel();
    const viewport = camera.viewport.toGlobal(width, height);

    const pPos = Vector3.Project(position, Matrix.Identity(), scene.getTransformMatrix(), viewport);
    if (pPos.z < 0 || pPos.z > 1) return;

    return new Vector2(pPos.x, pPos.y);
  }

  /** 计算一个向量绕另一个向量旋转角后的向量(罗德里格旋转公式)
   * @see https://zhuanlan.zhihu.com/p/85862903
   */
  static rotateAroundAxis(vec: Vector3, axis: Vector3, theta: number) {
    if (Math.abs(axis.lengthSquared() - 1) > 0.001) throw new Error('axis must be normalized: ' + axis.length());

    const a = vec.scale(Math.cos(theta));
    const b = vec.scale(Vector3.Dot(axis, vec) * (1 - Math.cos(theta)));
    const c = Vector3.Cross(axis, vec).scale(Math.sin(theta));
    return a.add(b).add(c);
  }

  static calcLookAtRotation(sourcePos: Vector3, target: Vector3): Vector3 {
    sourcePos = sourcePos.clone();
    const rotation = Vector3.Zero();

    if (sourcePos.z === target.z) sourcePos.z += 0.001;

    const _matrix = Matrix.Zero();
    Matrix.LookAtLHToRef(sourcePos, target, Vector3.UpReadOnly, _matrix);
    _matrix.invert();

    rotation.x = Math.atan(_matrix.m[6] / _matrix.m[10]);

    const vDir = target.subtract(sourcePos);

    if (vDir.x >= 0.0) rotation.y = -Math.atan(vDir.z / vDir.x) + Math.PI / 2.0;
    else rotation.y = -Math.atan(vDir.z / vDir.x) - Math.PI / 2.0;

    rotation.z = 0;

    if (isNaN(rotation.x)) rotation.x = 0;
    if (isNaN(rotation.y)) rotation.y = 0;
    if (isNaN(rotation.z)) rotation.z = 0;

    return rotation;
  }

  static calcArcRotateAnglesAndRadius(camPos: Vector3, target: Vector3) {
    const camPosVec = camPos.subtract(target);

    let radius = camPosVec.length();
    if (radius === 0) radius = 0.0001; // Just to avoid division by zero

    // Alpha
    let alpha = 0;

    if (camPosVec.x === 0 && camPosVec.z === 0) {
      alpha = Math.PI / 2; // avoid division by zero when looking along up axis, and set to acos(0)
    } else {
      alpha = Math.acos(camPosVec.x / Math.sqrt(Math.pow(camPosVec.x, 2) + Math.pow(camPosVec.z, 2)));
    }

    if (camPosVec.z < 0) alpha = 2 * Math.PI - alpha;

    // Beta
    let beta = Math.acos(camPosVec.y / radius);

    return { alpha, beta, radius };
  }

  static calcRadiusAnimationRange(a: number, b: number): [number, number] {
    const tp = Math.PI * 2;

    const d1 = Math.abs(b - a);
    const d2 = Math.abs(b + tp - a);
    const d3 = Math.abs(b - (a + tp));

    if (d1 < d2 && d1 < d3) return [a, b];
    if (d2 < d3) return [a, b + tp];
    return [a + tp, b];
  }

  /** 计算轨道相机的正交参数 */
  static calcArcRotateCameraOrthoArg(
    scene: Scene,
    viewport: IViewportLike,
    camera: { minZ: number; fov: number; radius: number }
  ) {
    const minZ = camera.minZ;
    const nearHalfH = minZ * Math.tan(camera.fov / 2);

    const aspect = scene.getEngine().getAspectRatio({ viewport });
    const nearHalfW = nearHalfH * aspect;

    // 求 radius 距离处的视平面尺寸
    const halfH = (nearHalfH / minZ) * camera.radius;
    const halfW = (nearHalfW / minZ) * camera.radius;

    const orthoLeft = -halfW;
    const orthoRight = halfW;
    const orthoTop = halfH;
    const orthoBottom = -halfH;

    return { orthoLeft, orthoRight, orthoTop, orthoBottom };
  }

  static quickUpdateTextureData(
    key: string,
    tex: Texture,
    buffer: ArrayBuffer,
    forcedExtension?: string,
    onSuccess?: () => any,
    onError?: (err: string) => any
  ) {
    const scene = tex.getScene();
    const engine = scene!.getEngine();

    // url 一定要以 data: 开头, tex.updateURL 内部才会使用 data 数据
    const url = `data:${key}`;

    if (forcedExtension) (tex as any)._forcedExtension = forcedExtension;

    // 创建 internal texture, 然后更新到 tex 上
    engine.createTexture(
      url,
      (tex as any)._noMipmap,
      tex._invertY,
      scene,
      tex.samplingMode,
      nextTexture => {
        tex.releaseInternalTexture(); // 释放上一个纹理

        tex.url = url;
        tex._buffer = buffer;
        tex._texture = nextTexture;

        tex.onLoadObservable.notifyObservers(tex);

        onSuccess?.();
      },
      onError,
      buffer,
      null,
      (tex as any)._format,
      (tex as any)._forcedExtension,
      (tex as any)._mimeType,
      (tex as any)._loaderOptions,
      (tex as any)._creationFlags,
      (tex as any)._useSRGBBuffer
    );
  }

  static evaluateAnimation(ag: AnimationGroup, frame: number) {
    ag.targetedAnimations.forEach(ani => {
      const v = ani.animation.evaluate(frame);
      setData(ani.target, ani.animation.targetPropertyPath, v);
    });
  }
}
