import 'ah-flow-node';
import 'xr-core';
import { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { MemoryFS } from 'ah-memory-fs';
import { type AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { type DepthRenderer } from '@babylonjs/core/Rendering/depthRenderer';
import { IDefaultFlowNode, IFlowHostEventData } from 'ah-flow-node';
import { type HighlightShadowPluginMaterial } from './MaterialPlugin';
import { type AssetContainer } from '@babylonjs/core';

declare module 'ah-flow-node' {
  interface IFlowHost extends Scene {
    mfs: MemoryFS;
    __uiTex?: AdvancedDynamicTexture;
    __XR_DepthRenderer?: DepthRenderer;
    __assetInstancePool?: Record<string, Promise<AssetContainer>>;
  }

  interface IFlowHostEvent {
    __afterCameraNodeChange: IFlowHostEventData<{ node: IDefaultFlowNode }>;
  }
}

declare module 'xr-core' {
  interface IEngine extends Engine {}
}

declare module '@babylonjs/core/Engines/engine' {
  interface Engine {
    mfs: MemoryFS;
  }
}

declare module '@babylonjs/core/Materials/PBR' {
  interface PBRBaseMaterial {
    highlightShadow: HighlightShadowPluginMaterial;
  }
}

declare module '@babylonjs/core/Materials/Textures/BaseTexture' {
  interface BaseTexture {
    __flowNodeID?: string;
  }
}

declare module '@babylonjs/core/Node' {
  interface Node {
    __flowNodeID?: string;
  }
}

declare module '@babylonjs/core/Animations/animationGroup' {
  interface AnimationGroup {
    __flowNodeID?: string;
  }
}
