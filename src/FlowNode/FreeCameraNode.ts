import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { toInnerVec } from '../lib/toVec';

class TargetCameraX extends TargetCamera {
  screenOffset: Vector2 = new Vector2(0, 0);

  protected _computeViewMatrix(position: Vector3, target: Vector3, up: Vector3): void {
    super._computeViewMatrix(position, target, up);

    const radius = target.subtract(position).length();
    const offsetX = radius * Math.tan(this.fov / 2) * this.screenOffset.x;
    const offsetY = radius * Math.tan(this.fov / 2) * this.screenOffset.y;

    this._viewMatrix.addAtIndex(12, offsetX);
    this._viewMatrix.addAtIndex(13, offsetY);
  }
}

export const getFreeCameraNodeRegisterData = (): IFlowNodeTypeRegisterData<'FreeCameraNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('FreeCameraNode')!,
  setup(ctx) {
    const camera = new TargetCameraX(ctx.name + '_camera', Vector3.Zero(), ctx.host, true);
    camera.target = Vector3.Forward();
    camera.detachControl();

    ctx.output.camera = camera;

    const remove_beforeRender = ctx.host.event.listen('beforeRender', () => {
      // always detachControl
      camera.detachControl();
    });

    const flusher = Util.createNodeFlusher(ctx, {
      name: notice,
      position: function () {
        if (!ctx.input.position) return;
        camera.position = toInnerVec(ctx.input.position);
      },
      target: function () {
        if (!ctx.input.target) return;
        camera.lockedTarget = toInnerVec(ctx.input.target);
      },
      _meta: function () {},

      screenOffset: function () {
        if (!ctx.input.screenOffset) return;
        camera.screenOffset = toInnerVec(ctx.input.screenOffset);
        camera.getViewMatrix(true); // 强刷一遍 viewMatrix
      },
    });

    function notice() {
      ctx.host.event.emit('__afterCameraNodeChange', { node: ctx as any, _bubble: true });
    }

    flusher.bindInputEvent();
    flusher.handler.position();
    flusher.handler.target();
    flusher.handler.screenOffset();

    notice();

    return () => {
      remove_beforeRender();
      camera.dispose();
    };
  },
});
