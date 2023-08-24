import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { toInnerColor, toOuterColor } from '../lib/toVec';

export const getPBRMaterialNodeRegisterData = (): IFlowNodeTypeRegisterData<'PBRMaterialNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('PBRMaterialNode')!,
  setup(ctx) {
    let mat: PBRMaterial | undefined;
    let _isInternalSetInput = false;

    function applySideEffect() {
      if (!ctx.input.material) return;
      mat = ctx.input.material as PBRMaterial;

      // emissive
      if (mat.emissiveTexture) mat.emissiveColor = Color3.White();
      else mat.emissiveColor = Color3.Black();

      // clear coat
      mat.clearCoat.isEnabled = mat.clearCoat.intensity > 0;

      // alpha mode
      if (mat.transparencyMode === 1 && mat.albedoTexture) {
        mat.albedoTexture.hasAlpha = true;
      }

      if (mat.transparencyMode === 2 && mat.albedoTexture) {
        mat.albedoTexture.hasAlpha = true;
        mat.useAlphaFromAlbedoTexture = true;
      }
    }

    function reloadAll() {
      if (!ctx.input.material) return;
      mat = ctx.input.material as PBRMaterial;

      _isInternalSetInput = true;

      // alpha
      if (typeof ctx.input.alpha === 'undefined') ctx.input.alpha = mat.alpha;
      else mat.alpha = ctx.input.alpha;

      // base color
      if (typeof ctx.input.baseColor === 'undefined') ctx.input.baseColor = toOuterColor(mat.albedoColor);
      else mat.albedoColor = toInnerColor(ctx.input.baseColor);

      // base color texture
      if (typeof ctx.input.baseColorTexture === 'undefined') ctx.input.baseColorTexture = mat.albedoTexture;
      else mat.albedoTexture = ctx.input.baseColorTexture;

      // metallic
      if (typeof ctx.input.metallic === 'undefined') ctx.input.metallic = mat.metallic || 0;
      else mat.metallic = ctx.input.metallic;

      // roughness
      if (typeof ctx.input.roughness === 'undefined') ctx.input.roughness = mat.roughness || 0;
      else mat.roughness = ctx.input.roughness;

      // metallicTexture
      if (typeof ctx.input.metallicRoughnessTexture === 'undefined') {
        ctx.input.metallicRoughnessTexture = mat.metallicTexture;
      } else mat.metallicTexture = ctx.input.metallicRoughnessTexture;

      // emissiveTexture
      if (typeof ctx.input.normalTexture === 'undefined') ctx.input.normalTexture = mat.bumpTexture;
      else mat.bumpTexture = ctx.input.normalTexture;

      // emissiveTexture
      if (typeof ctx.input.emissiveTexture === 'undefined') ctx.input.emissiveTexture = mat.emissiveTexture;
      else mat.emissiveTexture = ctx.input.emissiveTexture;

      // emissiveIntensity
      if (typeof ctx.input.emissiveIntensity === 'undefined') ctx.input.emissiveIntensity = mat.emissiveIntensity;
      else mat.emissiveIntensity = ctx.input.emissiveIntensity;

      // occlusionTexture
      if (typeof ctx.input.occlusionTexture === 'undefined') ctx.input.occlusionTexture = mat.ambientTexture;
      else mat.ambientTexture = ctx.input.occlusionTexture;

      // occlusionIntensity
      if (typeof ctx.input.occlusionIntensity === 'undefined')
        ctx.input.occlusionIntensity = mat.ambientTextureStrength;
      else mat.ambientTextureStrength = ctx.input.occlusionIntensity;

      // clearcoatIntensity
      if (typeof ctx.input.clearcoatIntensity === 'undefined') {
        ctx.input.clearcoatIntensity = mat.clearCoat.isEnabled ? mat.clearCoat.intensity : 0;
      } else mat.clearCoat.intensity = ctx.input.clearcoatIntensity;

      // clearcoatRoughness
      if (typeof ctx.input.clearcoatRoughness === 'undefined') ctx.input.clearcoatRoughness = mat.clearCoat.roughness;
      else mat.clearCoat.roughness = ctx.input.clearcoatRoughness;

      // unlit
      if (typeof ctx.input.unlit === 'undefined') ctx.input.unlit = mat.unlit;
      else mat.unlit = ctx.input.unlit;

      // highlightShadow
      if (typeof ctx.input.highlightShadowEnabled === 'undefined') {
        ctx.input.highlightShadowEnabled = mat.highlightShadow.isEnabled;
      } else mat.highlightShadow.isEnabled = ctx.input.highlightShadowEnabled;

      if (typeof ctx.input.highlightShadowTexture === 'undefined') {
        ctx.input.highlightShadowTexture = mat.highlightShadow.texture;
      } else mat.highlightShadow.texture = ctx.input.highlightShadowTexture;

      if (typeof ctx.input.highlightShadow_highlightLevel === 'undefined') {
        ctx.input.highlightShadow_highlightLevel = mat.highlightShadow.highlightLevel;
      } else mat.highlightShadow.highlightLevel = ctx.input.highlightShadow_highlightLevel;

      if (typeof ctx.input.highlightShadow_shadowLevel === 'undefined') {
        ctx.input.highlightShadow_shadowLevel = mat.highlightShadow.shadowLevel;
      } else mat.highlightShadow.shadowLevel = ctx.input.highlightShadow_shadowLevel;

      // alphaMode
      if (typeof ctx.input.alphaMode === 'undefined') {
        if (mat.transparencyMode === 0) ctx.input.alphaMode = 'OPAQUE';
        else if (mat.transparencyMode === 1) ctx.input.alphaMode = 'MASK';
        else if (mat.transparencyMode === 2) ctx.input.alphaMode = 'BLEND';
      } else {
        if (ctx.input.alphaMode === 'MASK') mat.transparencyMode = 1;
        else if (ctx.input.alphaMode === 'BLEND') mat.transparencyMode = 2;
        else mat.transparencyMode = 0;
      }

      // alphaCutOff
      if (typeof ctx.input.alphaCutOff === 'undefined') ctx.input.alphaCutOff = mat.alphaCutOff;
      mat.alphaCutOff = ctx.input.alphaCutOff;

      applySideEffect();

      _isInternalSetInput = false;
      ctx.output.loaded = true;
    }

    const flusher = Util.createNodeFlusher(ctx, {
      material: reloadAll,
      alpha: function () {
        if (!mat || _isInternalSetInput || typeof ctx.input.alpha === 'undefined') return;
        mat.alpha = ctx.input.alpha;
        applySideEffect();
      },
      baseColor: function () {
        if (!mat || _isInternalSetInput || typeof ctx.input.baseColor === 'undefined') return;
        mat.albedoColor = toInnerColor(ctx.input.baseColor);
        applySideEffect();
      },
      baseColorTexture() {
        if (!mat || _isInternalSetInput || typeof ctx.input.baseColorTexture === 'undefined') return;
        mat.albedoTexture = ctx.input.baseColorTexture;
        applySideEffect();
      },
      metallic() {
        if (!mat || _isInternalSetInput || typeof ctx.input.metallic === 'undefined') return;
        mat.metallic = ctx.input.metallic;
        applySideEffect();
      },
      roughness() {
        if (!mat || _isInternalSetInput || typeof ctx.input.roughness === 'undefined') return;
        mat.roughness = ctx.input.roughness;
        applySideEffect();
      },
      metallicRoughnessTexture() {
        if (!mat || _isInternalSetInput || typeof ctx.input.metallicRoughnessTexture === 'undefined') return;
        mat.metallicTexture = ctx.input.metallicRoughnessTexture;
        applySideEffect();
      },
      normalTexture() {
        if (!mat || _isInternalSetInput || typeof ctx.input.normalTexture === 'undefined') return;
        mat.bumpTexture = ctx.input.normalTexture;
        applySideEffect();
      },
      emissiveTexture() {
        if (!mat || _isInternalSetInput || typeof ctx.input.emissiveTexture === 'undefined') return;
        mat.emissiveTexture = ctx.input.emissiveTexture;
        applySideEffect();
      },
      emissiveIntensity() {
        if (!mat || _isInternalSetInput || typeof ctx.input.emissiveIntensity === 'undefined') return;
        mat.emissiveIntensity = ctx.input.emissiveIntensity;
        applySideEffect();
      },
      occlusionTexture() {
        if (!mat || _isInternalSetInput || typeof ctx.input.occlusionTexture === 'undefined') return;
        mat.ambientTexture = ctx.input.occlusionTexture;
        applySideEffect();
      },
      occlusionIntensity() {
        if (!mat || _isInternalSetInput || typeof ctx.input.occlusionIntensity === 'undefined') return;
        mat.ambientTextureStrength = ctx.input.occlusionIntensity;
        applySideEffect();
      },
      highlightShadowEnabled() {
        if (!mat || _isInternalSetInput || typeof ctx.input.highlightShadowEnabled === 'undefined') return;
        mat.highlightShadow.isEnabled = ctx.input.highlightShadowEnabled;
        applySideEffect();
      },
      highlightShadowTexture() {
        if (!mat || _isInternalSetInput || typeof ctx.input.highlightShadowTexture === 'undefined') return;
        mat.highlightShadow.texture = ctx.input.highlightShadowTexture;
        applySideEffect();
      },
      clearcoatIntensity() {
        if (!mat || _isInternalSetInput || typeof ctx.input.clearcoatIntensity === 'undefined') return;
        mat.clearCoat.intensity = ctx.input.clearcoatIntensity;
        applySideEffect();
      },
      clearcoatRoughness() {
        if (!mat || _isInternalSetInput || typeof ctx.input.clearcoatRoughness === 'undefined') return;
        mat.clearCoat.roughness = ctx.input.clearcoatRoughness;
        applySideEffect();
      },
      unlit: function () {
        if (!mat || _isInternalSetInput || typeof ctx.input.unlit === 'undefined') return;
        mat.unlit = ctx.input.unlit;
        applySideEffect();
      },
      _meta: function () {},

      alphaMode: function () {
        if (!mat || _isInternalSetInput || typeof ctx.input.alphaMode === 'undefined') return;

        if (ctx.input.alphaMode === 'MASK') mat.transparencyMode = 1;
        else if (ctx.input.alphaMode === 'BLEND') mat.transparencyMode = 2;
        else mat.transparencyMode = 0;

        applySideEffect();
      },
      alphaCutOff: function () {
        if (!mat || _isInternalSetInput || typeof ctx.input.alphaCutOff === 'undefined') return;
        mat.alphaCutOff = ctx.input.alphaCutOff;
        applySideEffect();
      },
      highlightShadow_highlightLevel: function () {
        if (!mat || _isInternalSetInput || typeof ctx.input.highlightShadow_highlightLevel === 'undefined') return;
        mat.highlightShadow.highlightLevel = ctx.input.highlightShadow_highlightLevel;
        applySideEffect();
      },
      highlightShadow_shadowLevel: function () {
        if (!mat || _isInternalSetInput || typeof ctx.input.highlightShadow_shadowLevel === 'undefined') return;
        mat.highlightShadow.shadowLevel = ctx.input.highlightShadow_shadowLevel;
        applySideEffect();
      },
    });

    flusher.bindInputEvent();

    reloadAll();

    return () => {};
  },
});
