import { WaterMaterial } from '@babylonjs/materials/water';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { toInnerColor, toInnerVec } from '../lib/toVec';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { getBlobUrl } from '../lib';
import { quickCreateTexture } from '../lib/quickCreateTexture';

export const getWaterNodeRegisterData = (): IFlowNodeTypeRegisterData<'WaterNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('WaterNode')!,
  setup(ctx) {
    let waterMesh: Mesh | undefined;
    let waterMat: WaterMaterial | undefined;

    let groundMat: PBRMaterial | undefined;

    function rebuildAll() {
      if (waterMesh) {
        waterMesh.dispose();
        waterMesh = undefined;
      }

      if (waterMat) {
        waterMat.dispose();
        waterMat = undefined;
      }

      if (groundMat) {
        groundMat.dispose();
        groundMat = undefined;
      }

      if (!ctx.input.applyMesh) return;

      const groundMesh = ctx.input.applyMesh as Mesh;

      // 准备地面
      groundMat = new PBRMaterial('water_underground_' + ctx.ID, ctx.host);
      groundMat.unlit = true;
      groundMesh.material = groundMat;

      // 构建水体
      waterMat = new WaterMaterial('water_' + ctx.ID, ctx.host);
      waterMat.bumpTexture = new Texture('https://rshop.tech/gw/_shared/model/waterbump.png.ktx2', ctx.host);
      waterMat.waveHeight = 0;
      waterMat.addToRenderList(groundMesh);

      waterMesh = groundMesh.clone(groundMesh.name + '_water', groundMesh); // 原地复制一个面片出来当水体
      waterMesh.material = waterMat;

      flusher.handler.deep();
      flusher.handler.windForce();
      flusher.handler.windDirection();
      flusher.handler.waterColor();
      flusher.handler.colorBlendFactor();
      flusher.handler.waveLength();

      flusher.handler.groundTextureUrl();
      flusher.handler.groundTextureScale();
      flusher.handler.reflectionMeshes();

      ctx.output.loaded = true;
    }

    const flusher = Util.createNodeFlusher(ctx, {
      _meta: function () {},
      applyMesh: rebuildAll,
      windForce: function () {
        if (!waterMat || typeof ctx.input.windForce === 'undefined') return;
        waterMat.windForce = ctx.input.windForce;
      },
      windDirection: function () {
        if (!waterMat || !ctx.input.windDirection) return;
        waterMat.windDirection = toInnerVec(ctx.input.windDirection);
      },
      waterColor: function () {
        if (!waterMat || typeof ctx.input.waterColor === 'undefined') return;
        waterMat.waterColor = toInnerColor(ctx.input.waterColor);
      },
      colorBlendFactor: function () {
        if (!waterMat || typeof ctx.input.colorBlendFactor === 'undefined') return;
        waterMat.colorBlendFactor = ctx.input.colorBlendFactor;
      },
      waveLength: function () {
        if (!waterMat || typeof ctx.input.waveLength === 'undefined') return;
        waterMat.waveLength = ctx.input.waveLength;
      },
      deep: function () {
        if (!waterMesh || typeof ctx.input.deep === 'undefined') return;
        waterMesh.position.y = ctx.input.deep;
      },
      groundTextureUrl: function () {
        if (!groundMat || typeof ctx.input.groundTextureUrl === 'undefined') return;

        getBlobUrl(ctx.host.mfs, ctx.input.groundTextureUrl).then(({ url, ext }) => {
          if (!groundMat) return;
          if (groundMat.albedoTexture) groundMat.albedoTexture.dispose();
          groundMat.albedoTexture = quickCreateTexture(ctx.host, url, ext);
        });
      },
      groundTextureScale: function () {
        if (!groundMat || !groundMat.albedoTexture || typeof ctx.input.groundTextureScale === 'undefined') return;

        (groundMat.albedoTexture as Texture).uScale = ctx.input.groundTextureScale;
        (groundMat.albedoTexture as Texture).vScale = ctx.input.groundTextureScale;
      },
      reflectionMeshes: function () {
        if (!waterMat || typeof ctx.input.reflectionMeshes === 'undefined') return;

        for (const mesh of Object.values(ctx.input.reflectionMeshes)) {
          waterMat.addToRenderList(mesh);
        }
      },
    });

    flusher.bindInputEvent();

    rebuildAll();

    return () => {
      if (groundMat) groundMat.dispose();
      if (waterMesh) waterMesh.dispose();
      if (waterMat) waterMat.dispose();
    };
  },
});
