import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';
import { Howl, getHowler } from '../lib/External';

export const getBackgroundMusicNodeRegisterData = (): IFlowNodeTypeRegisterData<'BackgroundMusicNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('BackgroundMusicNode')!,
  setup(ctx) {
    let audio: Howl | undefined;
    let isAudioLoaded = false;

    const load = () => {
      if (audio) {
        audio.unload();
        audio = undefined;
      }
      if (!ctx.input.url) return;

      const lastUrl = ctx.input.url;
      const lastUrlFormat = lastUrl.split('.').pop(); // blob url 会丢失后缀
      if (!lastUrlFormat) return;

      const httpURLPromise = ctx.input.url.startsWith('file://')
        ? ctx.host.mfs.readFile(ctx.input.url).then(buf => URL.createObjectURL(new Blob([buf])))
        : Promise.resolve(ctx.input.url);

      const HowlerPromise = getHowler();

      Promise.all([HowlerPromise, httpURLPromise]).then(([Howl, url]) => {
        if (ctx.disposed || lastUrl !== ctx.input.url) return;

        ctx.logger.info('create audio: %s', lastUrl);
        audio = new Howl({ src: [url], loop: true, preload: true, format: [lastUrlFormat] });

        audio.on('load', () => {
          ctx.logger.info('audio loaded');
          isAudioLoaded = true;
          flush_play();
        });
      });
    };

    function flush_play() {
      if (!audio || !isAudioLoaded) return;

      const playing = audio.playing();

      if (ctx.input.play && !playing) audio.play();
      else if (!ctx.input.play && playing) audio.pause();
    }

    ctx.event.listen('input:change:url', load);
    ctx.event.listen('input:change:play', flush_play);

    // 自动播放监听
    document.addEventListener('click', flush_play);
    document.addEventListener('mousewheel', flush_play);
    document.addEventListener('pointerdown', flush_play);
    document.addEventListener('WeixinJSBridgeReady', flush_play); // wx 兼容

    load();

    return () => {
      document.removeEventListener('click', flush_play);
      document.removeEventListener('mousewheel', flush_play);
      document.removeEventListener('pointerdown', flush_play);
      document.removeEventListener('WeixinJSBridgeReady', flush_play);

      if (audio) audio.unload();
    };
  },
});
