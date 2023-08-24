import { DepthRenderer } from '@babylonjs/core/Rendering/depthRenderer';
import { IFlowHost } from 'ah-flow-node';

export function getHostDepthRenderer(host: IFlowHost): DepthRenderer {
  if (!host.__XR_DepthRenderer) {
    host.__XR_DepthRenderer = new DepthRenderer(host);
    host.__XR_DepthRenderer.forceDepthWriteTransparentMeshes = true; // for 平行光阴影发生器
  }

  return host.__XR_DepthRenderer;
}
