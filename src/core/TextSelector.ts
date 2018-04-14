import { Range } from 'xpath-range';
// More on xpath-range here: https://github.com/opengovfoundation/xpath-range
// Wondering what's inside? See https://github.com/opengovfoundation/xpath-range/blob/master/src/range.coffee#L227

import $ from 'jquery';
import {PPHighlightClass} from "../consts";

const TEXTSELECTOR_NS = 'annotator-textselector';

/*
 * IMPORTANT NOTE on SELECTION RANGES
 * We leave annotator's TextSelector more or less as it is;
 * It can handle all kinds of selection (also multi-range selection). Although our application further assumes that
 * no more than one range can be selected for an annotation, there is no reason to stop supporting it at such an early
 * stage. If we ever stumble across multi-range selections it will be clear based on  TextSelectors output
 * (rather than exceptions).
 */

/**
 * isAnnotator determines if the provided element is part of Annotator. Useful
 * for ignoring mouse actions on the annotator elements.
 *
 * element - An Element or TextNode to check.
 *
 * Returns true if the element is a child of an annotator element.
 */
function isAnnotator(element) {
  const elAndParents = $(element).parents().addBack();
  return (elAndParents.filter('.pp-ui').length !== 0);
}

/**
 * TextSelector monitors a document (or a specific element) for text selections
 * and can notify another object of a selection event
 */
export default class TextSelector {

  document;
  element;
  onSelection;

  constructor(element, onSelection) {
    this.element = element;
    this.onSelection = onSelection;

    if (this.element.ownerDocument) {
      this.document = this.element.ownerDocument;

      $(this.document.body).on(`mouseup.${TEXTSELECTOR_NS}`, this.checkForEndSelection);
    } else {
      console.warn(`You created an instance of the TextSelector on an element
       that doesn't have an ownerDocument. This won't work! Please ensure the element is added
       to the DOM before the plugin is configured:`, this.element);
    }
  }

  destroy = () => {
    if (this.document) {
      $(this.document.body).off(`.${TEXTSELECTOR_NS}`);
    }
  }

  /**
   * Public: capture the current selection from the document, excluding any nodes
   * that fall outside of the adder's `element`.
   *
   * Returns an Array of NormalizedRange instances.
   */
  captureDocumentSelection = () => {
    const ranges = [];
    const rangesToIgnore = [];
    const selection = window.getSelection();

    if (selection.isCollapsed) {
      return [];
    }

    for (let i = 0; i < selection.rangeCount; i++) {
      const r = selection.getRangeAt(i);
      /*
        TODO we could try to remove the dependency on `Range` (xpath-range) library, but that
        would require writing our own tool for this kind of logic
       */
      const browserRange = new Range.BrowserRange(r);
      const normedRange = browserRange.normalize().limit(this.element);
      /*
       If the new range falls fully outside our this.element, we should
       add it back to the document but not return it from this method.
       */
      if (normedRange === null) {
        rangesToIgnore.push(r);
      } else {
        ranges.push(normedRange);
      }
    }

    /*
     BrowserRange#normalize() modifies the DOM structure and deselects the
     underlying text as a result. So here we remove the selected ranges and
     reapply the new ones.
     */
    selection.removeAllRanges();

    rangesToIgnore.forEach(selection.addRange);

    // Add normed ranges back to the selection
    for (const range of ranges) {
      const nativeRange = this.document.createRange();

      nativeRange.setStartBefore(range.start);
      nativeRange.setEndAfter(range.end);
      selection.addRange(nativeRange);
    }

    return ranges;
  }

  /**
   * Event callback: called when the mouse button is released. Checks to see if a
   * selection has been made
   *
   * event - A mouseup Event object.
   *
   * Returns nothing.
   */
  checkForEndSelection = (event) => {

    // Get the currently selected ranges.
    const selectedRanges = this.captureDocumentSelection();

    console.log(selectedRanges);
    if (selectedRanges.length === 0) {
      this.nullSelection();
      return;
    }

    // Don't show the adder if the selection was of a part of Annotator itself.
    for (const selectedRange of selectedRanges) {
      let container = selectedRange.commonAncestor;
      if ($(container).hasClass(PPHighlightClass)) {
        container = $(container).parents(`[class!=${PPHighlightClass}]`)[0];
      }
      if (isAnnotator(container)) {
        this.nullSelection();
        return;
      }
    }

    const serializedRanges = [];
    for (let i = 0, len = selectedRanges.length; i < len; i++) {
      const serializedRange = selectedRanges[i].serialize(this.element, PPHighlightClass);
      serializedRanges.push(serializedRange);
    }

    this.onSelection(serializedRanges, event);
  }

  nullSelection = () => {
    this.onSelection(null, event);
  }

  // static serializeRanges = (contextEl: Element, ignoreSelector: string, ranges: Range.NormalizedRange[]) => {
  //   const text = [];
  //   const serializedRanges = [];
  //
  //   for (let i = 0, len = ranges.length; i < len; i++) {
  //     const r = ranges[i];
  //     text.push(r.text().trim());
  //     serializedRanges.push(r.serialize(contextEl, ignoreSelector));
  //   }
  //
  //   return {
  //     quote: text.join(' / '),
  //     ranges: serializedRanges,
  //   };
  // }

}
