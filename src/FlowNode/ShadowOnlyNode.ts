import { type Mesh } from '@babylonjs/core';
import { ShadowOnlyMaterial } from '@babylonjs/materials/shadowOnly/shadowOnlyMaterial';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';

export const getShadowOnlyNodeRegisterData = (): IFlowNodeTypeRegisterData<'ShadowOnlyNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('ShadowOnlyNode')!,
  setup(ctx) {
    const mat = new ShadowOnlyMaterial('ShadowOnlyMaterial_' + ctx.ID, ctx.host);

    function rebind() {
      if (!ctx.input.applyMesh) return;

      const applyMesh = ctx.input.applyMesh as Mesh;
      applyMesh.material = mat;
      applyMesh.visibility = 0.9; // for CascadedShadowGenerator

      ctx.output.loaded = true;
    }

    const flusher = Util.createNodeFlusher(ctx, {
      _meta: function () {},
      applyMesh: rebind,
    });

    flusher.bindInputEvent();
    rebind();

    return () => {
      mat.dispose();
    };
  },
});
