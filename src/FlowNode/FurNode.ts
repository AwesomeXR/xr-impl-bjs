import { FurMaterial } from '@babylonjs/materials/fur/furMaterial';
import { furVertexShader } from '@babylonjs/materials/fur/fur.vertex';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { toInnerColor, toInnerVec } from '../lib/toVec';
import { getBlobUrl } from '../lib';
import { quickCreateTexture } from '../lib/quickCreateTexture';
import { ShaderStore } from '@babylonjs/core/Engines/shaderStore';

export const getFurNodeRegisterData = (): IFlowNodeTypeRegisterData<'FurNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('FurNode')!,
  setup(ctx) {
    let furMat: FurMaterial | undefined;
    let needUpdateAttr = false;

    function patchFurifyMeshResult() {
      if (!furMat) return;
      furMat._meshes.forEach(_mesh => {
        const _mat = _mesh.material as FurMaterial;
        _mat.furOcclusion = -0.2 * (_mat.furOffset * _mat.furOffset) - 0.3 * _mat.furOffset + 0.5; // 2次型避免黑底
        _mat.heightTexture = furMat!.heightTexture;

        _mesh.receiveShadows = false;
      });
    }

    function rebuildAll() {
      if (furMat) {
        furMat.dispose();
        furMat = undefined;
      }

      if (!ctx.input.applyMesh) return;

      furMat = new FurMaterial('fur_' + ctx.ID, ctx.host);
      furMat.highLevelFur = true;
      furMat.furAngle = 0;
      furMat.furTexture = FurMaterial.GenerateTexture('fur_tex_' + ctx.ID, ctx.host);
      ctx.input.applyMesh.material = furMat;

      flusher.handler.length();
      flusher.handler.color();
      flusher.handler.textureUrl();
      flusher.handler.heightTextureUrl();
      flusher.handler.spacing();
      flusher.handler.density();
      flusher.handler.speed();
      flusher.handler.gravity();

      // 参数设置完毕再执行 FurifyMesh
      FurMaterial.FurifyMesh(ctx.input.applyMesh, ctx.input.quality || 30);

      patchFurifyMeshResult();
      needUpdateAttr = false; // FurifyMesh 的时候已经 update 过了，去掉标记

      ctx.output.loaded = true;
    }

    function handleTick() {
      if (needUpdateAttr && furMat) {
        furMat.updateFur();
        patchFurifyMeshResult();
        needUpdateAttr = false;
      }
    }

    const removeTickListen = ctx.host.event.listen('beforeRender', handleTick);

    const flusher = Util.createNodeFlusher(ctx, {
      _meta: function () {},
      applyMesh: rebuildAll,
      length: function () {
        if (!furMat || typeof ctx.input.length === 'undefined') return;
        furMat.furLength = ctx.input.length;
        needUpdateAttr = true;
      },
      color: function () {
        if (!furMat || !ctx.input.color) return;
        furMat.furColor = toInnerColor(ctx.input.color);
        needUpdateAttr = true;
      },
      textureUrl: function () {
        if (!furMat || typeof ctx.input.textureUrl === 'undefined') return;

        getBlobUrl(ctx.host.mfs, ctx.input.textureUrl).then(({ url, ext }) => {
          if (!furMat || typeof ctx.input.textureUrl === 'undefined') return;

          if (furMat.diffuseTexture) furMat.diffuseTexture.dispose();

          furMat.diffuseTexture = quickCreateTexture(ctx.host, url, ext);
          needUpdateAttr = true;
        });
      },
      heightTextureUrl: function () {
        if (!furMat || typeof ctx.input.heightTextureUrl === 'undefined') return;

        getBlobUrl(ctx.host.mfs, ctx.input.heightTextureUrl).then(({ url, ext }) => {
          if (!furMat || typeof ctx.input.heightTextureUrl === 'undefined') return;

          if (furMat.heightTexture) furMat.heightTexture.dispose();

          furMat.heightTexture = quickCreateTexture(ctx.host, url, ext);
          needUpdateAttr = true;
        });
      },
      spacing: function () {
        if (!furMat || typeof ctx.input.spacing === 'undefined') return;
        furMat.furSpacing = ctx.input.spacing;
        needUpdateAttr = true;
      },
      density: function () {
        if (!furMat || typeof ctx.input.density === 'undefined') return;
        furMat.furDensity = ctx.input.density;
        needUpdateAttr = true;
      },
      speed: function () {
        if (!furMat || typeof ctx.input.speed === 'undefined') return;
        furMat.furSpeed = ctx.input.speed;
        needUpdateAttr = true;
      },
      gravity: function () {
        if (!furMat || typeof ctx.input.gravity === 'undefined') return;
        furMat.furGravity = toInnerVec(ctx.input.gravity);
        needUpdateAttr = true;
      },
      quality: rebuildAll,
    });

    flusher.bindInputEvent();

    rebuildAll();

    return () => {
      removeTickListen();
      if (furMat) furMat.dispose();
    };
  },
});

// patch shader
// 添加高度图。注意要有足够的顶点数才能看到效果。r=地高，g=草高
ShaderStore.ShadersStore[furVertexShader.name] = furVertexShader.shader.replace(
  `newPosition=vec3(newPosition.x,newPosition.y,newPosition.z)+(normalize(aNormal)*furOffset*furSpacing);`,
  `
float glowRate = 1.0;

#ifdef HEIGHTMAP
glowRate = texture2D(heightTexture, uv).g;
#endif

newPosition=vec3(newPosition.x,newPosition.y,newPosition.z)+(normalize(aNormal)*furOffset*furSpacing*glowRate);
`
);
