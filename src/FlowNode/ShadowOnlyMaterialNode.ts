import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';
import { ShadowOnlyMaterial } from '@babylonjs/materials/shadowOnly';

export const getShadowOnlyMaterialNodeRegisterData = (): IFlowNodeTypeRegisterData<'ShadowOnlyMaterialNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('ShadowOnlyMaterialNode')!,
  setup(ctx) {
    const mat = new ShadowOnlyMaterial('ShadowOnlyMaterial_' + ctx.ID, ctx.host);
    ctx.output.material = mat;

    return () => {
      mat.dispose();
    };
  },
});
