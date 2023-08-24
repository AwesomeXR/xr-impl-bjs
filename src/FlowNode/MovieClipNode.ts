import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';
import { BRCUtil } from '../BRCUtil';
import { batchCall } from 'ah-event-bus';
import { IMovieClipConfig } from 'xr-core';

export const getMovieClipNodeRegisterData = (): IFlowNodeTypeRegisterData<'MovieClipNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('MovieClipNode')!,
  setup(ctx) {
    const evaluators: { trackKey: string; fn: (frame: number) => any }[] = [];

    const activeEvaluatorFns: ((frame: number) => any)[] = [];

    function reloadEvaluators() {
      evaluators.length = 0;

      if (!ctx.input.config || !ctx.input.animators) return;

      const config = ctx.input.config as IMovieClipConfig;
      const animators = ctx.input.animators as AnimationGroup[];

      for (const gItem of config.groups) {
        for (let channelIndex = 0; channelIndex < gItem.tracks.length; channelIndex++) {
          const track = gItem.tracks[channelIndex];

          // 找到通道对应的 bjs 动画对象
          const animator = animators.find(v => v.name === track.animator.name && v.__flowNodeID === track.animator.ID);
          if (!animator) continue;

          const startTime = track.startTime;
          const duration = track.duration;
          const endTime = startTime + duration;
          const speedRatio = track.speedRatio ?? 1;
          const extrapolationLoop = track.extrapolationLoop;

          const _evaluatorFn = (frame: number) => {
            // 先转换动画帧

            let _aniFrame: number;

            // 外插修正
            if (extrapolationLoop) frame = (frame - endTime) % endTime;

            if (frame < startTime) _aniFrame = 0;
            else if (frame > endTime) _aniFrame = duration;
            else _aniFrame = frame - startTime;

            // 再转换动画速率
            _aniFrame *= speedRatio;

            // 最后解算动画
            BRCUtil.evaluateAnimation(animator, _aniFrame);
          };

          evaluators.push({ trackKey: track.key, fn: _evaluatorFn });
        }
      }

      reloadActiveEvaluatorFns();
    }

    function reloadActiveEvaluatorFns() {
      activeEvaluatorFns.length = 0;

      const activeKeys = ctx.input.activeKeys;
      if (!activeKeys) return;

      for (let i = 0; i < evaluators.length; i++) {
        const { trackKey, fn } = evaluators[i];
        if (activeKeys.includes(trackKey)) activeEvaluatorFns.push(fn);
      }
    }

    function reloadAll() {
      reloadEvaluators();
      flushFrame();

      ctx.output.loaded = true;
    }

    function flushFrame() {
      const frame = ctx.input.frame;
      if (typeof frame === 'undefined') return;

      batchCall(activeEvaluatorFns, frame);
    }

    ctx.event.listen('input:change:config', reloadAll);
    ctx.event.listen('input:change:animators', reloadAll);
    ctx.event.listen('input:change:activeKeys', reloadActiveEvaluatorFns);
    ctx.event.listen('input:change:frame', flushFrame);

    reloadAll();

    return () => {
      evaluators.length = 0;
    };
  },
});
