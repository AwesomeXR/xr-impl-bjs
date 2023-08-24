import { Image } from '@babylonjs/gui/2D/controls/image';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { getBlobUrl } from '../lib';
import { Container } from '@babylonjs/gui/2D/controls/container';
import { getHostUiTex } from '../lib/getHostUiTex';

export const getMiniMapNodeRegisterData = (): IFlowNodeTypeRegisterData<'MiniMapNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('MiniMapNode')!,
  setup(ctx) {
    const hardwareScale = ctx.host.getEngine().getHardwareScalingLevel() || 1;
    const uiTex = getHostUiTex(ctx.host);

    // gui 容器
    const container = new Container('minimap_' + ctx.ID);
    container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    container.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    uiTex.addControl(container);

    // 背景图
    const img = new Image('minimap_img_' + ctx.ID);
    img.stretch = Image.STRETCH_FILL;
    img.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    img.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    container.addControl(img);

    // cursor 后添加，以便浮在上面
    const cursor = new Image('minimap_cursor_' + ctx.ID, BUILTIN_CIRCLE_IMG);
    cursor.stretch = Image.STRETCH_FILL;
    cursor.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    cursor.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    cursor.widthInPixels = 12 / hardwareScale;
    cursor.heightInPixels = 12 / hardwareScale;
    cursor.isVisible = false; // 先关游标，等位置信息明确后再打开

    container.addControl(cursor);

    function refreshCursorPosition() {
      if (!ctx.input.position || !ctx.input.BoundBox) return;

      const { position, BoundBox } = ctx.input;

      const xRange = [BoundBox.center.x - BoundBox.size.x / 2, BoundBox.center.x + BoundBox.size.x / 2];
      const zRange = [BoundBox.center.z - BoundBox.size.z / 2, BoundBox.center.z + BoundBox.size.z / 2];

      const width = container.widthInPixels;
      const height = container.heightInPixels;

      const xInPlane = (width * (position.x - xRange[0])) / (xRange[1] - xRange[0]);
      const yInPlane = height - (height * (position.z - zRange[0])) / (zRange[1] - zRange[0]);

      cursor.leftInPixels = xInPlane;
      cursor.topInPixels = yInPlane;

      cursor.isVisible = true;
    }

    const flusher = Util.createNodeFlusher(ctx, {
      position: refreshCursorPosition,

      _meta: function () {},
      BoundBox: refreshCursorPosition,
      imgUrl: function () {
        if (!ctx.input.imgUrl) return;

        getBlobUrl(ctx.host.mfs, ctx.input.imgUrl).then(({ url }) => {
          img.source = url;
          ctx.output.loaded = true;
        });
      },
      size: function () {
        if (!ctx.input.size) return;

        container.widthInPixels = ctx.input.size / hardwareScale;
        container.heightInPixels = ctx.input.size / hardwareScale;

        refreshCursorPosition();
      },
    });

    flusher.bindInputEvent();

    flusher.handler.size();
    flusher.handler.imgUrl();
    flusher.handler.position();

    return () => {
      container.dispose();
    };
  },
});

const BUILTIN_CIRCLE_IMG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAMAAABhq6zVAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAADNQTFRFAAAA////////////////////////////////////////////////////////////////t5XiggAAABF0Uk5TAHDP/18Q0N9QIGBPQA/g8B+++k6xAAAAXklEQVR4nCWNWxLAIAwCqdTER7Xe/7QlKV9h2NkAwFXIciNSdUZKVTF66705ixh6TcA5NEw87g+mJnJhk45OZnnJjaOS2N6BWQhWCFYIQj3Pma5BTvufWn7AUDUx+AC9eAKjXNq77QAAAABJRU5ErkJggg==';
