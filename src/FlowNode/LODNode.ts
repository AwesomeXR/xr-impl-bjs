import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';
import { toInnerVec, toOuterVec } from '../lib/toVec';
import { getBoundBoxPoints } from 'xr-core';

export const getLODNodeRegisterData = (): IFlowNodeTypeRegisterData<'LODNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('LODNode')!,
  setup(ctx) {
    function process() {
      const fallbackValue = ctx.input.low || ctx.input.middle || ctx.input.high;
      if (!fallbackValue) return;

      const cam = ctx.host.activeCamera;
      if (!cam) {
        ctx.output.value = fallbackValue;
        return;
      }

      if (!ctx.input.boundBox || !ctx.input.middleBreakpoint || !ctx.input.lowBreakpoint) {
        ctx.output.value = fallbackValue;
        return;
      }

      const { boundBox, high, middle, low, middleBreakpoint, lowBreakpoint } = ctx.input;

      const camPos = toOuterVec(cam.globalPosition);
      const points = [...getBoundBoxPoints(toInnerVec(boundBox.center), toInnerVec(boundBox.size)), boundBox.center];
      const distances = points.map(p => p.subtract(camPos).length());
      const minDistance = Math.min(...distances);

      let finalValue: string;

      if (minDistance < middleBreakpoint) finalValue = high || fallbackValue;
      else if (minDistance < lowBreakpoint) finalValue = middle || fallbackValue;
      else finalValue = low || fallbackValue;

      ctx.output.value = finalValue;
    }

    const removeTickListen = ctx.host.event.listen('beforeRender', process);

    process();

    return () => {
      removeTickListen();
    };
  },
});
