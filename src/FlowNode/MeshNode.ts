import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import * as core from 'xr-core';

export const getMeshNodeRegisterData = (): IFlowNodeTypeRegisterData<'MeshNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('MeshNode')!,
  setup(ctx) {
    const flush_output = () => {
      if (!ctx.input.node) return;

      const node = ctx.input.node as TransformNode | Mesh;

      const glPos = node.getAbsolutePosition();
      const glRot = node.absoluteRotationQuaternion.toEulerAngles();

      // 好像没有好的时机捕获 position 变化，只能每帧脏检查
      if (
        !ctx.output.position ||
        !Scalar.WithinEpsilon(glPos.x, ctx.output.position.x) ||
        !Scalar.WithinEpsilon(glPos.y, ctx.output.position.y) ||
        !Scalar.WithinEpsilon(glPos.z, ctx.output.position.z)
      ) {
        ctx.output.position = core.Vector3.FromArray(glPos.asArray());
      }

      if (
        !ctx.output.rotation ||
        !Scalar.WithinEpsilon(glPos.x, ctx.output.rotation.x) ||
        !Scalar.WithinEpsilon(glPos.y, ctx.output.rotation.y) ||
        !Scalar.WithinEpsilon(glPos.z, ctx.output.rotation.z)
      ) {
        ctx.output.rotation = core.Vector3.FromArray(glRot.asArray());
      }
    };

    function flush_node() {
      if (!ctx.input.node) return;

      const node = ctx.input.node as TransformNode | Mesh;

      // reload inputs

      if (node instanceof Mesh) {
        if (typeof ctx.input.material !== 'undefined') node.material = ctx.input.material;
      }

      if (node instanceof Mesh) {
        ctx.output.material = node.material;
      }
    }

    function flush_material() {
      if (!ctx.input.material || !ctx.input.node) return;

      const node = ctx.input.node;

      if (node instanceof Mesh) {
        node.material = ctx.input.material;
        ctx.output.material = node.material;
      }
    }

    ctx.event.listen('input:change:node', flush_node);
    ctx.event.listen('input:change:material', flush_material);

    const removeBeforeRenderListen = ctx.host.event.listen('beforeRender', flush_output);

    flush_output();
    flush_node();
    flush_material();

    return () => {
      removeBeforeRenderListen();
    };
  },
});
