import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { getExt, quickXhrDownload } from '../lib';
import { toInnerVec, toOuterVec } from '../lib/toVec';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { LODManager } from 'xr-core';
import { BRCUtil } from '../BRCUtil';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR';

export const getPictureNodeRegisterData = (): IFlowNodeTypeRegisterData<'PictureNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('PictureNode')!,
  setup(ctx) {
    const lodMng = new LODManager<string | null>(
      ctx.host,
      () => toOuterVec(ctx.host.activeCamera!.globalPosition),
      (url, _distance, level) => {
        ctx.logger.info('[LOD_%s] => %s', level, url);

        if (url) {
          reloadTextureIfNeeded(url);
        } else {
          picMesh.setEnabled(false);
        }
      }
    );

    const tex = new Texture(null, ctx.host);
    tex.name = 'picture_tex_' + ctx.ID;
    tex.metadata = { inputUrl: null };

    tex.wrapU = 0;
    tex.wrapV = 0;

    const mat = new PBRMaterial('picture_mat_' + ctx.ID, ctx.host);
    mat.backFaceCulling = false;
    mat.albedoTexture = tex;
    mat.unlit = true;

    const picMesh = CreatePlane('picture_' + ctx.ID, { size: 1 }, ctx.host);
    picMesh.setEnabled(false); // 先隐藏
    picMesh.material = mat;

    function updateMeshSize() {
      if (!ctx.input.size || !ctx.input.sizeMode) return;

      const texSize = tex.getBaseSize();
      if (!texSize.height || !texSize.width) return;

      let width: number;
      let height: number;

      if (ctx.input.sizeMode === 'width') {
        width = ctx.input.size;
        height = (width / texSize.width) * texSize.height;
      } else {
        height = ctx.input.size;
        width = (height / texSize.height) * texSize.width;
      }

      // 按 tex 尺度缩放
      picMesh.scaling.x = width;
      picMesh.scaling.y = height;

      picMesh.setEnabled(true); // 显示出来

      ctx.output.boundBox = calcBondBox(picMesh);
      lodMng.targetSize = ctx.output.boundBox.size;

      ctx.output.loaded = true;
    }

    function reloadMeshTransform() {
      const { position, rotation } = ctx.input;
      if (!position || !rotation) return;

      lodMng.targetCenter = position;

      picMesh.position = toInnerVec(position);
      picMesh.rotation = toInnerVec(rotation).scale(Math.PI / 180);

      ctx.output.boundBox = calcBondBox(picMesh);
      ctx.output.position = toOuterVec(picMesh.position, true);
      ctx.output.rotation = toOuterVec(picMesh.rotation).scale(180 / Math.PI);

      picMesh.computeWorldMatrix(true);

      ctx.output.upVec = toOuterVec(picMesh.up, true);
      ctx.output.forwardVec = toOuterVec(picMesh.forward, true);
      ctx.output.rightVec = toOuterVec(picMesh.right, true);
    }

    function reloadTextureIfNeeded(inputUrl: string) {
      if (tex.metadata.inputUrl === inputUrl) return;

      const dataPromise = inputUrl.startsWith('file://')
        ? ctx.host.mfs.readFile(inputUrl)
        : quickXhrDownload<ArrayBuffer>(inputUrl, 'arraybuffer');

      lodMng.pause = true;
      const forcedExtension = getExt(inputUrl);

      dataPromise.then(data => {
        lodMng.pause = false;
        if (ctx.disposed || !ctx.enabled) return;

        BRCUtil.quickUpdateTextureData(inputUrl, tex, data, forcedExtension, updateMeshSize); // tex 更新后要重算 mesh 尺寸
      });
    }

    function setLodList() {
      lodMng.lodList = [];

      if (ctx.input.lodDistance) {
        const { url, url_low, url_middle, url_minimal } = ctx.input;
        const urls = [url, url_middle, url_low, url_minimal].filter(v => !!v) as string[];

        if (urls.length === 4) {
          lodMng.lodList.push({ value: urls[0], distance: ctx.input.lodDistance.x });
          lodMng.lodList.push({ value: urls[1], distance: ctx.input.lodDistance.y });
          lodMng.lodList.push({ value: urls[2], distance: ctx.input.lodDistance.z });
          lodMng.lodList.push({ value: urls[3], distance: Number.MAX_SAFE_INTEGER });
        }

        if (urls.length === 3) {
          lodMng.lodList.push({ value: urls[0], distance: ctx.input.lodDistance.y });
          lodMng.lodList.push({ value: urls[1], distance: ctx.input.lodDistance.z });
          lodMng.lodList.push({ value: urls[2], distance: Number.MAX_SAFE_INTEGER });
        }

        if (urls.length === 2) {
          lodMng.lodList.push({ value: urls[0], distance: ctx.input.lodDistance.z });
          lodMng.lodList.push({ value: urls[1], distance: Number.MAX_SAFE_INTEGER });
        }

        if (urls.length === 1) {
          lodMng.lodList.push({ value: urls[0], distance: Number.MAX_SAFE_INTEGER });
        }
      } else {
        const url = ctx.input.url || ctx.input.url_middle || ctx.input.url_low || ctx.input.url_minimal;
        if (url) {
          lodMng.lodList.push({ value: url, distance: Number.MAX_SAFE_INTEGER });
        }
      }
    }

    function reloadVisible() {
      if (ctx.input.visible) {
        picMesh.setEnabled(true);
        lodMng.pause = false;
      } else {
        picMesh.setEnabled(false);
        lodMng.pause = true;
      }
    }

    const flusher = Util.createNodeFlusher(ctx, {
      size: updateMeshSize,

      _meta: function () {},
      position: reloadMeshTransform,
      rotation: reloadMeshTransform,
      url: setLodList,
      sizeMode: updateMeshSize,
      url_middle: setLodList,
      url_low: setLodList,
      url_minimal: setLodList,
      lodDistance: setLodList,
      visible: reloadVisible,
    });

    flusher.bindInputEvent();

    setLodList();
    reloadVisible();

    return () => {
      lodMng.dispose();
      tex.dispose();
      mat.dispose();
      picMesh.dispose();
    };
  },
});

function calcBondBox(mesh: Mesh) {
  const bInfo = mesh.getHierarchyBoundingVectors(true);

  return {
    center: toOuterVec(bInfo.min.add(bInfo.max.subtract(bInfo.min).scale(0.5))),
    size: toOuterVec(bInfo.max.subtract(bInfo.min)),
  };
}
