import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { quickXhrDownload } from '../lib';
import { getApngJs, Player } from '../lib/External/apng';

export const getAnimatedTextureNodeRegisterData = (): IFlowNodeTypeRegisterData<'AnimatedTextureNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('AnimatedTextureNode')!,
  setup(ctx) {
    let tex: DynamicTexture | undefined;
    let player: Player | undefined;

    function reloadAll() {
      if (!ctx.input.url) return;

      const snapUrl = ctx.input.url;
      const bufPromise = snapUrl.startsWith('file://')
        ? ctx.host.mfs.readFile(snapUrl)
        : quickXhrDownload<ArrayBuffer>(snapUrl, 'arraybuffer');

      Promise.all([getApngJs(), bufPromise]).then(([apngJS, buf]) => {
        if (ctx.disposed || snapUrl !== ctx.input.url) return;

        // 开始解析 apng
        const apng = apngJS.default(buf);
        if (apng instanceof Error) return;

        ctx.logger.info('load apng %s: %s frames, %sx%s', snapUrl, apng.frames.length, apng.width, apng.height);

        tex = new DynamicTexture('animated_tex_' + ctx.ID, { width: apng.width, height: apng.height }, ctx.host);
        ctx.output.texture = tex;

        // 循环播放
        apng.numPlays = 0;

        const canvasCtx = tex.getContext();
        apng.getPlayer(canvasCtx as any).then(_player => {
          if (ctx.disposed) return;

          player = _player;
          _player.playbackRate = typeof ctx.input.rate === 'number' && ctx.input.rate > 0 ? ctx.input.rate : 1; // 设置速率

          _player.on('frame', () => {
            if (tex) tex.update(undefined, undefined, true);
          });

          // play if needed
          if (ctx.input.play) _player.play();

          ctx.output.loaded = true;
        });
      });
    }

    const flusher = Util.createNodeFlusher(ctx, {
      url: reloadAll,
      play: function () {
        if (!player || typeof ctx.input.play === 'undefined') return;
        if (ctx.input.play && player.paused) player.play();
        else if (!ctx.input.play && !player.paused) player.pause();
      },
      rate: function () {
        if (!player || typeof ctx.input.rate === 'undefined') return;
        if (ctx.input.rate <= 0) return;
        player.playbackRate = ctx.input.rate;
      },

      _meta: function () {},
    });

    flusher.bindInputEvent();
    reloadAll();

    return () => {
      if (player) player.stop();
      if (tex) tex.dispose();
    };
  },
});
