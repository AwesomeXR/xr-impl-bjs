import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { toInnerVec } from '../lib/toVec';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PointerEventTypes, PointerInfo } from '@babylonjs/core/Events/pointerEvents';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';

export const getPickableShapeNodeRegisterData = (): IFlowNodeTypeRegisterData<'PickableShapeNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('PickableShapeNode')!,
  setup(ctx) {
    let shapeBox: Mesh | undefined;

    const mat = new PBRMaterial('shape_box_' + ctx.ID, ctx.host);
    mat.alpha = 0;
    mat.unlit = true;

    function reloadAll() {
      if (shapeBox) {
        shapeBox.dispose();
        shapeBox = undefined;
      }
      if (!ctx.input.size || !ctx.input.active) return;

      shapeBox = CreateBox(
        'shape_' + ctx.ID,
        { width: ctx.input.size.x || 0.01, height: ctx.input.size.y || 0.01, depth: ctx.input.size.z || 0.01 },
        ctx.host
      );
      shapeBox.material = mat;

      shapeBox.visibility = 0;
      (shapeBox as any).__forcePickable = true;

      // rebind
      if (ctx.input.position) shapeBox.position = toInnerVec(ctx.input.position);
      if (ctx.input.rotation) shapeBox.rotation = toInnerVec(ctx.input.rotation).scale(Math.PI / 180);

      ctx.output.mesh = shapeBox;
    }

    function handlePick(ev: PointerInfo) {
      if (ev.type === PointerEventTypes.POINTERPICK && ev.pickInfo?.pickedMesh === shapeBox) {
        ctx.host.event.emit('afterShapePick', { nodeID: ctx.ID, node: ctx, _bubble: true });
      }
    }

    const onPointerObserve = ctx.host.onPointerObservable.add(handlePick);

    const flusher = Util.createNodeFlusher(ctx, {
      name: function () {},
      size: reloadAll,
      active: reloadAll,

      _meta: function () {},
      position: function () {
        if (!ctx.input.position || !shapeBox) return;
        shapeBox.position = toInnerVec(ctx.input.position);
      },
      rotation: function () {
        if (!ctx.input.rotation || !shapeBox) return;
        shapeBox.rotation = toInnerVec(ctx.input.rotation).scale(Math.PI / 180);
      },
    });

    flusher.bindInputEvent();
    reloadAll();

    return () => {
      mat.dispose();
      if (shapeBox) shapeBox.dispose();
      if (onPointerObserve) onPointerObserve.unregisterOnNextCall = true;
    };
  },
});
