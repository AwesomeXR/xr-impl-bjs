import { AssetContainer } from '@babylonjs/core/assetContainer';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { IAssetContainerInitConfig_MaterialModify } from 'xr-core';
import { setData } from './setData';

export function updateMaterial(
  container: AssetContainer,
  mat: PBRMaterial,
  cfg: IAssetContainerInitConfig_MaterialModify
) {
  const _callMap: Record<keyof IAssetContainerInitConfig_MaterialModify, Function> = {
    backFaceCulling: function () {
      if (typeof cfg.backFaceCulling !== 'undefined') mat.backFaceCulling = cfg.backFaceCulling;
    },
    disableDepthWrite: function () {
      if (typeof cfg.disableDepthWrite !== 'undefined') mat.disableDepthWrite = cfg.disableDepthWrite;
    },
    wireframe: function () {
      if (typeof cfg.wireframe !== 'undefined') mat.wireframe = cfg.wireframe;
    },
    transparencyMode: function () {
      if (typeof cfg.transparencyMode !== 'undefined') mat.transparencyMode = cfg.transparencyMode;
    },
    useAlphaFromAlbedoTexture: function () {
      if (typeof cfg.useAlphaFromAlbedoTexture !== 'undefined')
        mat.useAlphaFromAlbedoTexture = cfg.useAlphaFromAlbedoTexture;
    },
    separateCullingPass: function () {
      if (typeof cfg.separateCullingPass !== 'undefined') mat.separateCullingPass = cfg.separateCullingPass;
    },
    reflectivityColor: function () {
      if (typeof cfg.reflectivityColor !== 'undefined') mat.reflectivityColor = Color3.FromArray(cfg.reflectivityColor);
    },
    emissiveColor: function () {
      if (typeof cfg.emissiveColor !== 'undefined') mat.emissiveColor = Color3.FromArray(cfg.emissiveColor);
    },
    ambientColor: function () {
      if (typeof cfg.ambientColor !== 'undefined') mat.ambientColor = Color3.FromArray(cfg.ambientColor);
    },
    usePhysicalLightFalloff: function () {
      if (typeof cfg.usePhysicalLightFalloff !== 'undefined') mat.usePhysicalLightFalloff = cfg.usePhysicalLightFalloff;
    },
    indexOfRefraction: function () {
      if (typeof cfg.indexOfRefraction !== 'undefined') mat.indexOfRefraction = cfg.indexOfRefraction;
    },
    metallicF0Factor: function () {
      if (typeof cfg.metallicF0Factor !== 'undefined') mat.metallicF0Factor = cfg.metallicF0Factor;
    },
    environmentIntensity: function () {
      if (typeof cfg.environmentIntensity !== 'undefined') mat.environmentIntensity = cfg.environmentIntensity;
    },
    directIntensity: function () {
      if (typeof cfg.directIntensity !== 'undefined') mat.directIntensity = cfg.directIntensity;
    },
    useRadianceOverAlpha: function () {
      if (typeof cfg.useRadianceOverAlpha !== 'undefined') mat.useRadianceOverAlpha = cfg.useRadianceOverAlpha;
    },
    useSpecularOverAlpha: function () {
      if (typeof cfg.useSpecularOverAlpha !== 'undefined') mat.useSpecularOverAlpha = cfg.useSpecularOverAlpha;
    },
    enableSpecularAntiAliasing: function () {
      if (typeof cfg.enableSpecularAntiAliasing !== 'undefined')
        mat.enableSpecularAntiAliasing = cfg.enableSpecularAntiAliasing;
    },
    realTimeFiltering: function () {
      if (typeof cfg.realTimeFiltering !== 'undefined') mat.realTimeFiltering = cfg.realTimeFiltering;
    },
    realTimeFilteringQuality: function () {
      if (typeof cfg.realTimeFilteringQuality !== 'undefined')
        mat.realTimeFilteringQuality = cfg.realTimeFilteringQuality;
    },
    debugMode: function () {
      if (typeof cfg.debugMode !== 'undefined') mat.debugMode = cfg.debugMode;
    },
    alpha: function () {
      if (typeof cfg.alpha !== 'undefined') mat.alpha = cfg.alpha;
    },
    alphaMode: function () {
      if (typeof cfg.alphaMode !== 'undefined') mat.alphaMode = alphaModeString2Number(cfg.alphaMode);
    },
    alphaCutOff: function () {
      if (typeof cfg.alphaCutOff !== 'undefined') mat.alphaCutOff = cfg.alphaCutOff;
    },
    baseColor: function () {
      if (typeof cfg.baseColor !== 'undefined') mat.albedoColor = Color3.FromArray(cfg.baseColor);
    },
    baseColorTexture: function () {
      setTexture(container, mat, 'albedoTexture', cfg.baseColorTexture);
    },
    metallic: function () {
      if (typeof cfg.metallic !== 'undefined') mat.metallic = cfg.metallic;
    },
    roughness: function () {
      if (typeof cfg.roughness !== 'undefined') mat.roughness = cfg.roughness;
    },
    metallicRoughnessTexture: function () {
      setTexture(container, mat, 'metallicTexture', cfg.metallicRoughnessTexture);
    },
    normalTexture: function () {
      setTexture(container, mat, 'bumpTexture', cfg.normalTexture);
    },
    emissiveTexture: function () {
      setTexture(container, mat, 'emissiveTexture', cfg.emissiveTexture);
    },
    emissiveIntensity: function () {
      if (typeof cfg.emissiveIntensity !== 'undefined') mat.emissiveIntensity = cfg.emissiveIntensity;
    },
    occlusionTexture: function () {
      setTexture(container, mat, 'ambientTexture', cfg.occlusionTexture);
    },
    occlusionIntensity: function () {
      if (typeof cfg.occlusionIntensity !== 'undefined') mat.ambientTextureStrength = cfg.occlusionIntensity;
    },
    clearcoatIntensity: function () {
      if (typeof cfg.clearcoatIntensity !== 'undefined') mat.clearCoat.intensity = cfg.clearcoatIntensity;
    },
    clearcoatRoughness: function () {
      if (typeof cfg.clearcoatRoughness !== 'undefined') mat.clearCoat.roughness = cfg.clearcoatRoughness;
    },
    unlit: function () {
      if (typeof cfg.unlit !== 'undefined') mat.unlit = cfg.unlit;
    },
    reflectionTexture: function () {
      setTexture(container, mat, 'reflectionTexture', cfg.reflectionTexture);
    },
    refractionTexture: function () {
      setTexture(container, mat, 'refractionTexture', cfg.refractionTexture);
    },
    clearcoatEnabled: function () {
      if (typeof cfg.clearcoatEnabled !== 'undefined') mat.clearCoat.isEnabled = cfg.clearcoatEnabled;
    },
  };

  Object.keys(_callMap).forEach(k => (_callMap as any)[k]());
}

function alphaModeString2Number(alphaMode: string) {
  if (alphaMode === 'OPAQUE') return 0;
  if (alphaMode === 'BLEND') return 1;
  if (alphaMode === 'MASK') return 2;
  return 0;
}

function setTexture(container: AssetContainer, mat: PBRMaterial, property: string, targetTex?: string | null) {
  if (typeof targetTex === 'undefined') return;

  if (targetTex === null) setData(mat, property, null);
  else {
    const _tex = container.textures.find(t => t.name === targetTex);
    if (_tex) setData(mat, property, _tex);
  }
}
