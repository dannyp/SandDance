// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

//adapted from https://github.com/uber/deck.gl/blob/6.4-release/modules/layers/src/text-layer/multi-icon-layer/multi-icon-layer.js

import fs from './chromatic-multi-icon-layer-fragment.glsl';
import vs from './chromatic-multi-icon-layer-vertex.glsl';

import { base } from '../../base';
import { Color } from '@deck.gl/core/utils/color';
import { FontSettings } from '@deck.gl/layers/text-layer/font-atlas';
import { IconDefinition, IconLayerDatum, IconLayerProps } from '@deck.gl/layers/icon-layer/icon-layer';
import { Layer } from 'deck.gl';
import { LayerProps } from '@deck.gl/core/lib/layer';

// TODO expose as layer properties
const DEFAULT_GAMMA = 0.2;
const DEFAULT_BUFFER = 192.0 / 256;

const defaultProps = {
  getShiftInQueue: { type: 'accessor', value: x => x.shift || 0 },
  getLengthOfQueue: { type: 'accessor', value: x => x.len || 1 },
  // 1: left, 0: middle, -1: right
  getAnchorX: { type: 'accessor', value: x => x.anchorX || 0 },
  // 1: top, 0: center, -1: bottom
  getAnchorY: { type: 'accessor', value: x => x.anchorY || 0 },
  getPixelOffset: { type: 'accessor', value: [0, 0] },

  // object with the same pickingIndex will be picked when any one of them is being picked
  getPickingIndex: { type: 'accessor', value: x => x.objectIndex }
};

//https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants
const UNSIGNED_BYTE = 0x1401;

export interface MultiIconLayerProps extends LayerProps, IconLayerProps, FontSettings {
  getPickingIndex?: (x) => number;
  getAnchorX?: (x) => number;
  getAnchorY?: (x) => number;
  getLengthOfQueue?: (x) => number;
  getShiftInQueue?: (x) => number;
  getHighlightColor?: (x) => Color;
  getPixelOffset?: (x) => [number, number];
}

function _MultiIconLayer(...props: Partial<MultiIconLayerProps>[]) {

  class __MultiIconLayer extends base.layers.IconLayer {

    public props: MultiIconLayerProps;

    static layerName = 'MultiIconLayer';
    static defaultProps = defaultProps;

    constructor(...props: MultiIconLayerProps[]) {
      super(...arguments);
    }

    getShaders() {
      return Object.assign({}, super.getShaders(), {
        vs,
        fs
      });
    }

    initializeState() {
      super.initializeState();

      const attributeManager = this.getAttributeManager();
      attributeManager.addInstanced({
        instancePixelOffset: {
          size: 2,
          transition: true,
          accessor: 'getPixelOffset'
        },
        instanceHighlightColors: {
          size: 4,
          type: UNSIGNED_BYTE,
          transition: true,
          accessor: 'getHighlightColor',
          defaultValue: [0, 255, 0, 255]
        }
      });
    }

    updateState(updateParams) {
      super.updateState(updateParams);
      const { changeFlags } = updateParams;

      if (
        changeFlags.updateTriggersChanged &&
        (changeFlags.updateTriggersChanged.getAnchorX || changeFlags.updateTriggersChanged.getAnchorY)
      ) {
        this.getAttributeManager().invalidate('instanceOffsets');
      }
    }

    draw({ uniforms }) {
      const { sdf } = this.props;
      super.draw({
        uniforms: Object.assign({}, uniforms, {
          // Refer the following doc about gamma and buffer
          // https://blog.mapbox.com/drawing-text-with-signed-distance-fields-in-mapbox-gl-b0933af6f817
          buffer: DEFAULT_BUFFER,
          gamma: DEFAULT_GAMMA,
          sdf: Boolean(sdf)
        })
      });
    }

    calculateInstanceOffsets(attribute) {
      const {
        data,
        iconMapping,
        getIcon,
        getAnchorX,
        getAnchorY,
        getLengthOfQueue,
        getShiftInQueue
      } = this.props;
      const { value } = attribute;
      let i = 0;
      for (const object of <IconLayerDatum[]>data) {
        const icon = (<(x: IconLayerDatum) => string>getIcon)(object);
        const rect = iconMapping[icon] || {} as IconDefinition;
        const len = getLengthOfQueue(object);
        const shiftX = getShiftInQueue(object);

        value[i++] = ((getAnchorX(object) - 1) * len) / 2 + rect.width / 2 + shiftX || 0;
        value[i++] = (rect.height / 2) * getAnchorY(object) || 0;
      }
    }

    calculateInstancePickingColors(attribute) {
      const { data, getPickingIndex } = this.props;
      const { value } = attribute;
      let i = 0;
      const pickingColor = [];
      for (const point of <IconLayerDatum[]>data) {
        const index = getPickingIndex(point);
        this.encodePickingColor(index, pickingColor);

        value[i++] = pickingColor[0];
        value[i++] = pickingColor[1];
        value[i++] = pickingColor[2];
      }
    }
  }

  const instance = new __MultiIconLayer(...arguments) as Layer;
  return instance;
}

//signature to allow this function to be used with the 'new' keyword.
//need to trick the compiler by casting to 'any'.

/**
 * CubeLayer - a Deck.gl layer to render cuboids.
 * This is instantiatable by calling `new MultiIconLayer()`.
 */
export const MultiIconLayer: typeof MultiIconLayer_Class = _MultiIconLayer as any;

/**
 * CubeLayer - a Deck.gl layer to render cuboids.
 * This is not instantiatable, it is the TypeScript declaration of the type.
 */
export declare class MultiIconLayer_Class extends base.deck.Layer {
  id: string;
  props: MultiIconLayerProps;
  constructor(props: MultiIconLayerProps)
  constructor(...props: Partial<MultiIconLayerProps>[])
}
