import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { IFlowHost } from 'ah-flow-node';

export function getHostUiTex(host: IFlowHost) {
  if (!host.__uiTex) host.__uiTex = AdvancedDynamicTexture.CreateFullscreenUI('ui_' + host.ID, true, host);
  return host.__uiTex;
}
