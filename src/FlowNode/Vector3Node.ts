import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';
import * as core from 'xr-core';

export const getVector3NodeRegisterData = (): IFlowNodeTypeRegisterData<'Vector3Node'> => ({
  ...FlowNodeTypeRegistry.Default.get('Vector3Node')!,
  setup(ctx) {
    const flush = () => {
      ctx.output.vector = new core.Vector3(ctx.input.x, ctx.input.y, ctx.input.z);
    };

    flush();

    ctx.event.listen('input:change:x', flush);
    ctx.event.listen('input:change:y', flush);
    ctx.event.listen('input:change:z', flush);

    return () => {};
  },
});
