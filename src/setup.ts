import { ExternalImpl } from 'xr-core';
import { FlowEdgeManager, FlowNodeManager, ILogger, FlowNodeTypeRegistry } from 'ah-flow-node';
import { Scene } from '@babylonjs/core/scene';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Engine } from '@babylonjs/core/Engines/engine';
import { BRCUtil } from './BRCUtil';
import {
  getArcRotateCameraNodeRegisterData,
  getAssetContainerNodeRegisterData,
  getSkyBoxNodeRegisterData,
  getVector3NodeRegisterData,
  getHDRNodeRegisterData,
  getPBRMaterialNodeRegisterData,
  getTextureNodeRegisterData,
  getAnimatorNodeRegisterData,
  getProceduralPBRMaterialNodeRegisterData,
  getSceneNodeRegisterData,
  getDirectionalLightNodeRegisterData,
  getJoystickNodeRegisterData,
  getNpcNavigateNodeRegisterData,
  getThirdPersonCameraNodeRegisterData,
  getBackgroundMusicNodeRegisterData,
  getPictureNodeRegisterData,
  getPickableShapeNodeRegisterData,
  getLODNodeRegisterData,
  getWaterNodeRegisterData,
  getMiniMapNodeRegisterData,
  getShadowOnlyNodeRegisterData,
  getMeshInstanceNodeRegisterData,
} from './FlowNode';
import { createViewerCanvas } from './lib';
import { DynamicOfflineProvider } from './lib/DynamicOfflineProvider';
import { Tools } from '@babylonjs/core/Misc/tools';
import { EventBus } from 'ah-event-bus';
import { getFreeCameraNodeRegisterData } from './FlowNode/FreeCameraNode';
import { getMeshNodeRegisterData } from './FlowNode/MeshNode';
import { patch } from './patch';
import { getShadowOnlyMaterialNodeRegisterData } from './FlowNode/ShadowOnlyMaterialNode';
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2';
import { DecoderURL } from './DecoderURL';
import { getFurNodeRegisterData } from './FlowNode/FurNode';
import { getParticleSystemNodeRegisterData } from './FlowNode/ParticleSystemNode';
import { getAnimatedTextureNodeRegisterData } from './FlowNode/AnimatedTextureNode';
import { RegisterMaterialPlugin } from '@babylonjs/core/Materials/materialPluginManager';
import { HighlightShadowPluginMaterial } from './MaterialPlugin';
import { PBRBaseMaterial } from '@babylonjs/core/Materials/PBR';

// 载入一些 side effect 依赖
import '@babylonjs/core/Materials/Textures/Loaders';
import '@babylonjs/core/Misc/screenshotTools';
import '@babylonjs/core/Rendering';
import '@babylonjs/core/Lights/Shadows';
import '@babylonjs/core/Engines';
import '@babylonjs/core/Collisions';
import '@babylonjs/core/Animations';
import { getMovieClipNodeRegisterData } from './FlowNode/MovieClipNode';

KhronosTextureContainer2.URLConfig = {
  jsDecoderModule: DecoderURL.jsDecoderModule,
  wasmUASTCToASTC: DecoderURL.UniversalTranscoder_UASTC_ASTC,
  wasmUASTCToBC7: DecoderURL.UniversalTranscoder_UASTC_BC7,
  wasmUASTCToRGBA_UNORM: DecoderURL.UniversalTranscoder_UASTC_RGBA_SRGB,
  jsMSCTranscoder: DecoderURL.MSCTranscoder.js,
  wasmMSCTranscoder: DecoderURL.MSCTranscoder.wasm,
  wasmZSTDDecoder: DecoderURL.ZSTDDecoder,

  // 下面三个在 jsDecoderModule 里没有对应的实现，会报错
  wasmUASTCToRGBA_SRGB: null,
  wasmUASTCToR8_UNORM: null,
  wasmUASTCToRG8_UNORM: null,
};

let _isSetup = false;

export function setup(defaultLogger: ILogger) {
  if (_isSetup) return;
  _isSetup = true;

  ExternalImpl.createEngine = (mfs, opt) => BRCUtil.createEngine(opt?.canvas || createViewerCanvas(), mfs, opt);
  ExternalImpl.createScene = engine => BRCUtil.createDefaultScene(engine, { initCamera: false }) as any;

  patch();

  // engine
  Engine.OfflineProviderFactory = (url, manifestChecked) => {
    setTimeout(() => manifestChecked(true), 0);
    return DynamicOfflineProvider.getInstance(url);
  };

  Object.defineProperties(Engine.prototype, {
    activeSceneID: {
      get() {
        return this._activeSceneID;
      },

      set(ID) {
        this._activeSceneID = ID;

        if (!this._isRenderLoopSetup) {
          const _this = this;

          this.runRenderLoop(function () {
            if (_this.pause) return;

            const toRenderScene = _this.scenes.find((s: any) => s.ID === _this.activeSceneID);
            if (toRenderScene) toRenderScene.render();
          });
          this._isRenderLoopSetup = true;
        }
      },
    },
  });

  // patch scene
  Object.defineProperties(Scene.prototype, {
    flowNodeManager: {
      get() {
        if (!this._flowNodeManager) {
          this._flowNodeManager = new FlowNodeManager(this);
          this.onDisposeObservable.addOnce(() => {
            (this._flowNodeManager as FlowNodeManager).all.forEach(item => item.dispose());
          });
        }
        return this._flowNodeManager;
      },
    },
    flowEdgeManager: {
      get() {
        if (!this._flowEdgeManager) {
          this._flowEdgeManager = new FlowEdgeManager(this);
          this.onDisposeObservable.addOnce(() => {
            (this._flowEdgeManager as FlowEdgeManager).all.forEach(item => item.dispose());
          });
        }
        return this._flowEdgeManager;
      },
    },
    logger: {
      get() {
        if (!this._logger) this._logger = defaultLogger.extend('scene_' + this.uid);
        return this._logger;
      },
      set(v) {
        this._logger = v;
      },
    },
    mfs: {
      get() {
        return this.getEngine().mfs;
      },
    },
    capture: {
      value(opt?: { type?: string }) {
        return Tools.CreateScreenshotAsync(this.getEngine(), this.activeCamera!, {}, opt?.type);
      },
    },
    event: {
      get() {
        if (!this._event) {
          this._event = new EventBus();
          this.onDisposeObservable.addOnce(() => this._event.clear());
        }
        return this._event;
      },
    },
    engine: {
      get() {
        return this.getEngine();
      },
    },
  });

  patchAbstractMesh();

  // 注册材质插件
  RegisterMaterialPlugin('HighlightShadow', material => {
    if (material instanceof PBRBaseMaterial) {
      material.highlightShadow = new HighlightShadowPluginMaterial(material);
      return material.highlightShadow;
    }

    return null;
  });

  // register flow node
  FlowNodeTypeRegistry.Default.register('ArcRotateCameraNode', getArcRotateCameraNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('AssetContainerNode', getAssetContainerNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('HDRNode', getHDRNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('SkyBoxNode', getSkyBoxNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('Vector3Node', getVector3NodeRegisterData());
  FlowNodeTypeRegistry.Default.register('PBRMaterialNode', getPBRMaterialNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('TextureNode', getTextureNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('AnimatorNode', getAnimatorNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('ProceduralPBRMaterialNode', getProceduralPBRMaterialNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('FreeCameraNode', getFreeCameraNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('MeshNode', getMeshNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('SceneNode', getSceneNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('DirectionalLightNode', getDirectionalLightNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('ShadowOnlyMaterialNode', getShadowOnlyMaterialNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('JoystickNode', getJoystickNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('NpcNavigateNode', getNpcNavigateNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('ThirdPersonCameraNode', getThirdPersonCameraNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('BackgroundMusicNode', getBackgroundMusicNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('PictureNode', getPictureNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('PickableShapeNode', getPickableShapeNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('LODNode', getLODNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('FurNode', getFurNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('ParticleSystemNode', getParticleSystemNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('WaterNode', getWaterNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('MiniMapNode', getMiniMapNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('AnimatedTextureNode', getAnimatedTextureNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('ShadowOnlyNode', getShadowOnlyNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('MeshInstanceNode', getMeshInstanceNodeRegisterData());
  FlowNodeTypeRegistry.Default.register('MovieClipNode', getMovieClipNodeRegisterData());
}

function patchAbstractMesh() {
  const oldAbsMeshIsInFrustum = AbstractMesh.prototype.isInFrustum;
  AbstractMesh.prototype.isInFrustum = function () {
    if ((this as any).disableFrustumCheck) return true;
    return oldAbsMeshIsInFrustum.apply(this, arguments as any);
  };
}
