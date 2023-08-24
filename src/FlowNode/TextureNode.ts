import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { getExt } from '../lib';

export const getTextureNodeRegisterData = (): IFlowNodeTypeRegisterData<'TextureNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('TextureNode')!,
  setup(ctx) {
    const tex: Texture = new Texture(null, ctx.host);

    tex.name = 'tex_' + ctx.ID;
    tex.__flowNodeID = ctx.ID;

    if (ctx.input.uvScale) {
      tex.uScale = ctx.input.uvScale.x || 0;
      tex.vScale = ctx.input.uvScale.y || 0;
    }

    if (ctx.input.uvOffset) {
      tex.uOffset = ctx.input.uvOffset.x || 1;
      tex.vOffset = ctx.input.uvOffset.y || 1;
    }

    if (typeof ctx.input.uvSet !== 'undefined') {
      tex.coordinatesIndex = ctx.input.uvSet;
    }

    ctx.output.texture = tex;

    function reloadSource() {
      if (!ctx.input.source) return;

      const ctxUrlSnap = ctx.input.source;

      const urlPromise = ctxUrlSnap.startsWith('file://')
        ? ctx.host.mfs.readFile(ctxUrlSnap).then(dat => URL.createObjectURL(new Blob([dat])))
        : Promise.resolve(ctxUrlSnap);

      const forcedExtension = getExt(ctxUrlSnap);
      urlPromise.then(_url => {
        if (ctxUrlSnap !== ctx.input.source || ctx.disposed || !ctx.enabled) return;

        tex.updateURL(
          _url,
          null,
          () => {
            ctx.host.event.emit('__afterTextureUpdated', { texture: tex, _bubble: true });
          },
          forcedExtension
        );
      });
    }

    const flusher = Util.createNodeFlusher(ctx, {
      source: reloadSource,
      _meta: function () {},

      uvScale: function () {
        if (ctx.input.uvScale) {
          tex.uScale = ctx.input.uvScale.x || 0;
          tex.vScale = ctx.input.uvScale.y || 0;
        }
      },
      uvOffset: function () {
        if (ctx.input.uvOffset) {
          tex.uOffset = ctx.input.uvOffset.x || 1;
          tex.vOffset = ctx.input.uvOffset.y || 1;
        }
      },
      uvSet: function () {
        if (typeof ctx.input.uvSet !== 'undefined') {
          tex.coordinatesIndex = ctx.input.uvSet;
        }
      },
      level: function () {
        if (typeof ctx.input.level !== 'undefined') {
          tex.level = ctx.input.level;
        }
      },
    });

    flusher.bindInputEvent();
    reloadSource();

    return () => {
      if (tex) tex.dispose();
    };
  },
});
