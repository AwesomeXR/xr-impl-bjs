import { FlowNodeTypeRegistry, IDefaultFlowNode, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { toInnerColor } from '../lib/toVec';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';

export const getSceneNodeRegisterData = (): IFlowNodeTypeRegisterData<'SceneNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('SceneNode')!,
  setup(ctx) {
    let glowLayer: GlowLayer | undefined;

    function reloadGlow() {
      const { glow, glowIntensity } = ctx.input;

      if (glowLayer) {
        glowLayer.dispose();
        glowLayer = undefined;
      }

      if (!glow) return;

      glowLayer = new GlowLayer('gl', ctx.host);
      if (typeof glowIntensity !== 'undefined') glowLayer.intensity = glowIntensity;
    }

    function reloadActiveCamera(forceNode?: IDefaultFlowNode) {
      const { activeCamera } = ctx.input;
      if (!activeCamera) return;

      if (forceNode) {
        if (
          forceNode.output.camera &&
          (Util.isFlowNode('ThirdPersonCameraNode', forceNode) ||
            Util.isFlowNode('ArcRotateCameraNode', forceNode) ||
            Util.isFlowNode('FreeCameraNode', forceNode)) &&
          forceNode.input.name === activeCamera
        ) {
          ctx.host.activeCamera = forceNode.output.camera;
        }
      }

      //
      else {
        let hasSet = false;

        ctx.host.event.emit('travelNode', {
          _capture: true,
          tap(node) {
            if (
              !hasSet &&
              node.output.camera &&
              (Util.isFlowNode('ThirdPersonCameraNode', node) ||
                Util.isFlowNode('ArcRotateCameraNode', node) ||
                Util.isFlowNode('FreeCameraNode', node)) &&
              node.input.name === activeCamera
            ) {
              ctx.host.activeCamera = node.output.camera;
              hasSet = true;
            }
          },
        });
      }
    }

    const flusher = Util.createNodeFlusher(ctx, {
      clearColor: function () {
        if (!ctx.input.clearColor) return;
        ctx.host.clearColor = toInnerColor(ctx.input.clearColor);
      },
      _meta: function () {},

      activeCamera: function () {
        reloadActiveCamera();
      },
      fogDensity: function () {
        if (typeof ctx.input.fogDensity !== 'number') return;

        if (ctx.input.fogDensity <= 0) {
          ctx.host.fogEnabled = false;
        } else {
          ctx.host.fogEnabled = true;
          ctx.host.fogMode = 2; // faster
          ctx.host.fogDensity = ctx.input.fogDensity;
        }
      },
      fogColor: function () {
        if (typeof ctx.input.fogColor === 'undefined') return;
        ctx.host.fogColor = toInnerColor(ctx.input.fogColor);
      },
      glow: reloadGlow,
      glowIntensity: function () {
        if (glowLayer && typeof ctx.input.glowIntensity !== 'undefined') {
          glowLayer.intensity = ctx.input.glowIntensity;
        }
      },
    });

    const removeCameraNodeChangeListen = ctx.host.event.listen('__afterCameraNodeChange', ev =>
      reloadActiveCamera(ev.node)
    );

    flusher.bindInputEvent();

    flusher.handler.clearColor();
    flusher.handler.activeCamera();

    flusher.handler.fogDensity();
    flusher.handler.fogColor();

    reloadGlow();

    return () => {
      removeCameraNodeChangeListen();
    };
  },
});
