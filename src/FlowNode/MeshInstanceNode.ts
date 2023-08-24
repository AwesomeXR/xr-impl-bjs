import { AssetContainer } from '@babylonjs/core/assetContainer';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { BRCUtil } from '../BRCUtil';
import { toInnerVec, toOuterVec } from '../lib/toVec';

export const getMeshInstanceNodeRegisterData = (): IFlowNodeTypeRegisterData<'MeshInstanceNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('MeshInstanceNode')!,
  setup(ctx) {
    if (!ctx.host.__assetInstancePool) ctx.host.__assetInstancePool = {};
    const assetInstancePool = ctx.host.__assetInstancePool;

    let instancedMesh: InstancedMesh | undefined;

    const flushRootOutputTransform = () => {
      if (!instancedMesh) return;

      instancedMesh.computeWorldMatrix(true);

      ctx.output.position = toOuterVec(instancedMesh.position, true);
      ctx.output.scaling = toOuterVec(instancedMesh.scaling, true);
      ctx.output.rotation = toOuterVec(instancedMesh.rotation.scale(360 / Math.PI / 2), true);
      ctx.output.upVec = toOuterVec(instancedMesh.up, true);
      ctx.output.forwardVec = toOuterVec(instancedMesh.forward, true);
      ctx.output.rightVec = toOuterVec(instancedMesh.right, true);
    };

    function reloadAll() {
      if (instancedMesh) {
        instancedMesh.dispose();
        instancedMesh = undefined;
      }

      const { url, meshName } = ctx.input;
      if (!url || !meshName) return;

      function __apply(_container: AssetContainer) {
        instancedMesh = createInstanceFromAssetContainer(_container, meshName!, `instance_${meshName}_${ctx.ID}`);

        if (instancedMesh) {
          ctx.host.addMesh(instancedMesh); // __assetInstancePool 里的东西没有添加到 scene，所以这里需要手动添加
          instancedMesh.__flowNodeID = ctx.ID;

          if (ctx.input.position) instancedMesh.position = toInnerVec(ctx.input.position);
          if (ctx.input.rotation) instancedMesh.rotation = toInnerVec(ctx.input.rotation).scale(Math.PI / 180);
          if (ctx.input.scaling) instancedMesh.scaling = toInnerVec(ctx.input.scaling);

          flushRootOutputTransform();
        }
      }

      if (!assetInstancePool[url]) {
        // 需要加载源容器

        ctx.logger.info('add instance source container: %s', url);
        assetInstancePool[url] = BRCUtil.loadModel(ctx.host, url);
      }

      assetInstancePool[url].then(__apply);
    }

    const flusher = Util.createNodeFlusher(ctx, {
      position: function () {
        if (ctx.input.position && instancedMesh) {
          instancedMesh.position = toInnerVec(ctx.input.position);
          flushRootOutputTransform();
        }
      },
      scaling: function () {
        if (ctx.input.scaling && instancedMesh) {
          instancedMesh.scaling = toInnerVec(ctx.input.scaling);
          flushRootOutputTransform();
        }
      },
      rotation: function () {
        if (ctx.input.rotation && instancedMesh) {
          instancedMesh.rotation = toInnerVec(ctx.input.rotation).scale(Math.PI / 180);
          flushRootOutputTransform();
        }
      },
      _meta: function () {},
      url: reloadAll,
      meshName: reloadAll,
      visible: function () {
        if (instancedMesh) instancedMesh.setEnabled(!!ctx.input.visible);
      },
    });

    flusher.bindInputEvent();
    reloadAll();

    return () => {
      if (instancedMesh) instancedMesh.dispose();
    };
  },
});

function createInstanceFromAssetContainer(
  source: AssetContainer,
  meshName: string,
  instanceName: string
): InstancedMesh | undefined {
  for (let i = 0; i < source.meshes.length; i++) {
    const mesh = source.meshes[i];

    if (mesh.name === meshName) {
      if (mesh instanceof InstancedMesh) return mesh.clone(instanceName);
      if (mesh instanceof Mesh) return mesh.createInstance(instanceName);
    }
  }
}
