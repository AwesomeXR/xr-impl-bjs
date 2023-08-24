import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { BRCUtil } from '../BRCUtil';

export const getAnimatorNodeRegisterData = (): IFlowNodeTypeRegisterData<'AnimatorNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('AnimatorNode')!,
  setup(ctx) {
    function flush() {
      if (typeof ctx.input.frame === 'undefined' || !ctx.input.active) return;

      const agList: AnimationGroup[] = [];

      if (ctx.input.animator) agList.push(ctx.input.animator);
      if (ctx.input.animators) agList.push(...Object.values(ctx.input.animators).filter(v => !!v));

      if (agList.length === 0) return;

      let frame = ctx.input.frame;
      if (ctx.input.offset) frame += ctx.input.offset;

      // 钳制
      if (ctx.input.clampRange) {
        frame = Math.max(ctx.input.clampRange.x, Math.min(ctx.input.clampRange.y, frame));
      }

      // 这里重新实现帧解算(AnimationGroup 原生的 gotoFrame 依赖 _started 状态)
      for (const ag of agList) {
        BRCUtil.evaluateAnimation(ag, frame);
      }

      // 输出解算帧
      ctx.output.frame = frame;
    }

    const flusher = Util.createNodeFlusher(ctx, {
      animator: flush,
      animators: flush,
      frame: flush,
      _meta: function () {},
      offset: flush,
      active: flush,
      clampRange: flush,
    });

    flusher.bindInputEvent();

    flush();

    return () => {};
  },
});
