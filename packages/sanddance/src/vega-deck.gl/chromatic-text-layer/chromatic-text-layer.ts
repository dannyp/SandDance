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

//adapted from https://github.com/uber/deck.gl/blob/6.4-release/modules/layers/src/text-layer/text-layer.js

import { base } from '../base';
import { Color } from '@deck.gl/core/utils/color';
import {
  DEFAULT_CHAR_SET,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SETTINGS,
  DEFAULT_FONT_WEIGHT,
  makeFontAtlas
} from './font-atlas';
import { Layer } from 'deck.gl';
import { LayerProps } from '@deck.gl/core/lib/layer';
import { MultiIconLayer, MultiIconLayer_Class } from './chromatic-multi-icon-layer/chromatic-multi-icon-layer';
import { TextLayerDatum, TextLayerProps } from '@deck.gl/layers/text-layer/text-layer';

export interface ChromaticTextLayerProps extends TextLayerProps {
  getHighlightColor?: (x: TextLayerDatum) => Color;
}

const TEXT_ANCHOR = {
  start: 1,
  middle: 0,
  end: -1
};

const ALIGNMENT_BASELINE = {
  top: 1,
  center: 0,
  bottom: -1
};

const DEFAULT_COLOR = [0, 0, 0, 255];

const MISSING_CHAR_WIDTH = 32;
const FONT_SETTINGS_PROPS = ['fontSize', 'buffer', 'sdf', 'radius', 'cutoff'];

const defaultProps = {
  fp64: false,
  sizeScale: 1,

  characterSet: DEFAULT_CHAR_SET,
  fontFamily: DEFAULT_FONT_FAMILY,
  fontWeight: DEFAULT_FONT_WEIGHT,
  fontSettings: {},

  getText: { type: 'accessor', value: x => x.text },
  getPosition: { type: 'accessor', value: x => x.position },
  getColor: { type: 'accessor', value: DEFAULT_COLOR },
  getSize: { type: 'accessor', value: 32 },
  getAngle: { type: 'accessor', value: 0 },
  getHighlightColor: { type: 'accessor', value: DEFAULT_COLOR },
  getTextAnchor: { type: 'accessor', value: 'middle' },
  getAlignmentBaseline: { type: 'accessor', value: 'center' },
  getPixelOffset: { type: 'accessor', value: [0, 0] }
};

function _ChromaticTextLayer(props?: LayerProps & ChromaticTextLayerProps) {

  class __ChromaticTextLayer extends base.deck.CompositeLayer {

    static layerName = 'TextLayer';
    static defaultProps = defaultProps;

    updateState({ props, oldProps, changeFlags }) {
      const fontChanged = this.fontChanged(oldProps, props);
      if (fontChanged) {
        this.updateFontAtlas();
      }

      if (
        changeFlags.dataChanged ||
        fontChanged ||
        (changeFlags.updateTriggersChanged &&
          (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getText))
      ) {
        this.transformStringToLetters();
      }
    }

    updateFontAtlas() {
      const { gl } = this.context;
      const { fontSettings, fontFamily, fontWeight, characterSet } = this.props;

      const mergedFontSettings = Object.assign({}, DEFAULT_FONT_SETTINGS, fontSettings, {
        fontFamily,
        fontWeight,
        characterSet
      });
      const { scale, mapping, texture } = makeFontAtlas(gl, mergedFontSettings);

      this.setState({
        scale,
        iconAtlas: texture,
        iconMapping: mapping
      });
    }

    fontChanged(oldProps, props) {
      if (
        oldProps.fontFamily !== props.fontFamily ||
        oldProps.characterSet !== props.characterSet ||
        oldProps.fontWeight !== props.fontWeight
      ) {
        return true;
      }

      if (oldProps.fontSettings === props.fontSettings) {
        return false;
      }

      const oldFontSettings = oldProps.fontSettings || {};
      const fontSettings = props.fontSettings || {};

      return FONT_SETTINGS_PROPS.some(prop => oldFontSettings[prop] !== fontSettings[prop]);
    }

    getPickingInfo({ info }) {
      // because `TextLayer` assign the same pickingInfoIndex for one text label,
      // here info.index refers the index of text label in props.data
      return Object.assign(info, {
        // override object with original data
        object: info.index >= 0 ? this.props.data[info.index] : null
      });
    }

    /* eslint-disable no-loop-func */
    transformStringToLetters() {
      const { data, getText } = this.props;
      const { iconMapping } = this.state;

      const transformedData = [];
      let objectIndex = 0;
      for (const val of data) {
        const text = getText(val) as string;
        if (text) {
          const letters = Array.from(text);
          const offsets = [0];
          let offsetLeft = 0;

          letters.forEach((letter, i) => {
            const datum = {
              text: letter,
              index: i,
              offsets,
              len: text.length,
              // reference of original object and object index
              object: val,
              objectIndex
            };

            const frame = iconMapping[letter];
            if (frame) {
              offsetLeft += frame.width;
            } else {
              //log.warn(`Missing character: ${letter}`)();
              offsetLeft += MISSING_CHAR_WIDTH;
            }
            offsets.push(offsetLeft);
            transformedData.push(datum);
          });
        }

        objectIndex++;
      }

      this.setState({ data: transformedData });
    }
    /* eslint-enable no-loop-func */

    getLetterOffset(datum) {
      return datum.offsets[datum.index];
    }

    getTextLength(datum) {
      return datum.offsets[datum.offsets.length - 1];
    }

    _getAccessor(accessor) {
      if (typeof accessor === 'function') {
        return x => accessor(x.object);
      }
      return accessor;
    }

    getAnchorXFromTextAnchor(getTextAnchor) {
      return x => {
        const textAnchor =
          typeof getTextAnchor === 'function' ? getTextAnchor(x.object) : getTextAnchor;
        if (!TEXT_ANCHOR.hasOwnProperty(textAnchor)) {
          throw new Error(`Invalid text anchor parameter: ${textAnchor}`);
        }
        return TEXT_ANCHOR[textAnchor];
      };
    }

    getAnchorYFromAlignmentBaseline(getAlignmentBaseline) {
      return x => {
        const alignmentBaseline =
          typeof getAlignmentBaseline === 'function'
            ? getAlignmentBaseline(x.object)
            : getAlignmentBaseline;
        if (!ALIGNMENT_BASELINE.hasOwnProperty(alignmentBaseline)) {
          throw new Error(`Invalid alignment baseline parameter: ${alignmentBaseline}`);
        }
        return ALIGNMENT_BASELINE[alignmentBaseline];
      };
    }

    renderLayers() {
      const { data, scale, iconAtlas, iconMapping } = this.state;

      const {
        getPosition,
        getColor,
        getSize,
        getAngle,
        getHighlightColor,
        getTextAnchor,
        getAlignmentBaseline,
        getPixelOffset,
        fp64,
        sdf,
        sizeScale,
        transitions,
        updateTriggers
      } = this.props;

      const SubLayerClass = this.getSubLayerClass('characters', MultiIconLayer) as typeof MultiIconLayer_Class;

      return new SubLayerClass(
        {
          sdf,
          iconAtlas,
          iconMapping,

          getPosition: d => getPosition((d as any).object),
          getColor: this._getAccessor(getColor),
          getSize: this._getAccessor(getSize),
          getAngle: this._getAccessor(getAngle),
          getHighlightColor: this._getAccessor(getHighlightColor),
          getAnchorX: this.getAnchorXFromTextAnchor(getTextAnchor),
          getAnchorY: this.getAnchorYFromAlignmentBaseline(getAlignmentBaseline),
          getPixelOffset: this._getAccessor(getPixelOffset),
          fp64,
          sizeScale: sizeScale * scale,

          transitions: transitions && {
            getPosition: transitions.getPosition,
            getAngle: transitions.getAngle,
            getHighlightColor: transitions.getHighlightColor,
            getColor: transitions.getColor,
            getSize: transitions.getSize,
            getPixelOffset: updateTriggers.getPixelOffset
          }
        },
        this.getSubLayerProps({
          id: 'characters',
          updateTriggers: {
            getPosition: updateTriggers.getPosition,
            getAngle: updateTriggers.getAngle,
            getHighlightColor: updateTriggers.getHighlightColor,
            getColor: updateTriggers.getColor,
            getSize: updateTriggers.getSize,
            getPixelOffset: updateTriggers.getPixelOffset,
            getAnchorX: updateTriggers.getTextAnchor,
            getAnchorY: updateTriggers.getAlignmentBaseline
          }
        }),
        {
          data,

          getIcon: d => (d as any).text,
          getShiftInQueue: d => this.getLetterOffset(d),
          getLengthOfQueue: d => this.getTextLength(d)
        }
      );
    }
  }

  const instance = new __ChromaticTextLayer(props) as Layer;

  return instance;
}

//signature to allow this function to be used with the 'new' keyword.
//need to trick the compiler by casting to 'any'.

/**
 * TextLayer - a modification of deck.gl's TextLayer.
 * This is instantiatable by calling `new TextLayer()`.
 */
export const ChromaticTextLayer: typeof ChromaticTextLayer_Class = _ChromaticTextLayer as any;

/**
 * CubeLayer - a Deck.gl layer to render cuboids.
 * This is not instantiatable, it is the TypeScript declaration of the type.
 */
export declare class ChromaticTextLayer_Class extends base.deck.Layer {
  id: string;
  props: ChromaticTextLayerProps;
  constructor(props: LayerProps & ChromaticTextLayerProps);
}
