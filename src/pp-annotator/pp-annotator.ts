import annotator, { IAppInstance, IAnnotation } from 'annotator';

import PrzypisEditor from './form/PrzypisEditor';
import PrzypisAdder from './PrzypisAdder';
import PrzypisViewer from './viewer/PrzypisViewer';
import {AnnotationViewModel, IAnnotationAPIModel} from "./annotation";
const { util, ui: PPUI } = annotator;
const { highlighter, textselector } = PPUI;

/**
 * trim strips whitespace from either end of a string.
 *
 * This usually exists in native code, but not in IE8.
 */
function trim(s: string) {
  if (typeof String.prototype.trim === 'function') {
    return String.prototype.trim.call(s);
  } else {
    return s.replace(/^[\s\xA0]+|[\s\xA0]+$/g, '');
  }
}

/**
 * rangesParser returns a function that can be used to construct an
 * annotation from a list of selected ranges.
 */
function rangesParser(contextEl: Element, ignoreSelector: string) {
  return (ranges: JQuery.PlainObject) => {
    const text = [];
    const serializedRanges = [];

    for (let i = 0, len = ranges.length; i < len; i++) {
      const r = ranges[i];
      text.push(trim(r.text()));
      serializedRanges.push(r.serialize(contextEl, ignoreSelector));
    }

    return {
      quote: text.join(' / '),
      ranges: serializedRanges,
    };
  };
}

/**
 * maxZIndex returns the maximum z-index of all elements in the provided set.
 */
function maxZIndex(elements: Element[]) {
  let max = -1;
  for (let i = 0, len = elements.length; i < len; i++) {
    const $el = util.$(elements[i]);
    if ($el.css('position') !== 'static') {
      // Use parseFloat since we may get scientific notation for large
      // values.
      const zIndex = parseFloat($el.css('z-index'));
      if (zIndex > max) {
        max = zIndex;
      }
    }
  }
  return max;
}

/**
 * Helper function to inject CSS into the page that ensures Annotator elements
 * are displayed with the highest z-index.
 */
function injectDynamicStyle() {
  util.$('#annotator-dynamic-style').remove();

  const sel =
    '*' +
    ':not(annotator-adder)' +
    ':not(annotator-outer)' +
    ':not(annotator-notice)' +
    ':not(annotator-filter)';

  // use the maximum z-index in the page
  let max = maxZIndex(
    util
      .$(document.body)
      .find(sel)
      .get()
  );

  // but don't go smaller than 1010, because this isn't bulletproof --
  // dynamic elements in the page (notifications, dialogs, etc.) may well
  // have high z-indices that we can't catch using the above method.
  max = Math.max(max, 1000);

  const rules = [
    '.annotator-adder, .annotator-outer, .annotator-notice {',
    '  z-index: ' + (max + 20) + ';',
    '}',
    '.annotator-filter {',
    '  z-index: ' + (max + 10) + ';',
    '}'
  ].join('\n');

  util
    .$('<style>' + rules + '</style>')
    .attr('id', 'annotator-dynamic-style')
    .attr('type', 'text/css')
    .appendTo('head');
}

/**
 * Helper function to remove dynamic stylesheets
 */
function removeDynamicStyle() {
  util.$('#annotator-dynamic-style').remove();
}

interface IState {
  interactionPoint: annotator.util.IPosition | null;
  adder: PrzypisAdder;
  editor: PrzypisEditor;
  highlighter: annotator.ui.highlighter.Highlighter;
  textselector: annotator.ui.textselector.TextSelector;
  viewer: PrzypisViewer;
  embeddedHighlights: {[id: number]: AnnotationViewModel};
}

/**
 * pp annotator ui module (almost unchanged annotator.ui.main)
 */
export function ui(options?: {
  element?: Element;
  editorExtensions?: Array<{}>;
  viewerExtensions?: Array<{}>;
}) {
  if (typeof options === 'undefined' || options === null) {
    options = {};
  }

  const element = options.element || document.body;
  const editorExtensions = options.editorExtensions || [];
  const viewerExtensions = options.viewerExtensions || [];

  // Local helpers
  const parseRanges = rangesParser(element, '.annotator-hl');

  let s: IState | undefined;

  function start(app: IAppInstance) {
    const ident = app.registry.getUtility('identityPolicy');
    const authz = app.registry.getUtility('authorizationPolicy');

    s = {
      embeddedHighlights: {},
      interactionPoint: null,
      adder: new PrzypisAdder({
        beginAnnotationCreate(annotation) {
          if (!s) {
            throw new Error('App not initialized!');
          }
          if (s.interactionPoint === null) {
            throw new Error('Interaction point is null!');
          }
          s.editor.load(annotation, s.interactionPoint,
              (resultAnnotation: AnnotationViewModel) =>
                  app.annotations.create(
                      AnnotationViewModel.toModel(resultAnnotation) as IAnnotation
                  )
            );
        },
        beforeRequestCreate() {
          // TODO what happens when the adder's request button is clicked
        }
      }),
      editor: new PrzypisEditor({
        extensions: editorExtensions
      }),
      highlighter: new highlighter.Highlighter(element),
      textselector: new textselector.TextSelector(element, {
        onSelection(ranges, event) {
          if (!s) {
            throw new Error('App not initialized!');
          }

          if (ranges.length > 0) {
            const url = window.location.href;
            const annotation = AnnotationViewModel.fromSelection(parseRanges(ranges), url);
            s.interactionPoint = util.mousePosition(event);
            s.adder.load(annotation, s.interactionPoint);
          } else {
            s.adder.hide();
          }
        }
      }),
      viewer: new PrzypisViewer({
        onEdit(annotation) {
          if (!s) {
            throw new Error('App is not initialized!');
          }
          // Copy the interaction point from the shown viewer:
          const interactionPoint = util.$(s.viewer.element).css(['top', 'left']);
          s.interactionPoint = (interactionPoint as any) as { top: number; left: number };

          s.editor.load(annotation, s.interactionPoint,
              (resultAnnotation: AnnotationViewModel) =>
                  app.annotations.update(AnnotationViewModel.toModel(resultAnnotation) as IAnnotation)
            );
        },
        onDelete(annotation) {
          app.annotations.delete(annotation);
        },
        permitEdit(annotation) {
          return authz.permits('update', annotation, ident.who());
        },
        permitDelete(annotation) {
          return authz.permits('delete', annotation, ident.who());
        },
        autoViewHighlights: element,
        extensions: viewerExtensions
      })
    };
    s.adder.attach();
    s.editor.attach();
    s.viewer.attach();
    injectDynamicStyle();
  }
  return {
    start,

    destroy() {
      if (!s) {
        throw new Error('App not initialized!');
      }
      s.adder.destroy();
      s.editor.destroy();
      s.highlighter.destroy();
      s.textselector.destroy();
      s.viewer.destroy();
      removeDynamicStyle();
    },
    annotationsLoaded(anns: IAnnotationAPIModel[]) {
      if (!s) {
        throw new Error('App not initialized!');
      }

      const annVieModels = anns.map((ann) => new AnnotationViewModel(ann));
      s.embeddedHighlights = {};
      for (let viewModel of annVieModels) {
        s.embeddedHighlights[viewModel.id] = viewModel;
      }
      s.highlighter.drawAll(anns as IAnnotation[]);
    },
    annotationCreated(ann: IAnnotationAPIModel) {
      if (!s) {
        throw new Error('App not initialized!');
      }
      const viewModel = new AnnotationViewModel(ann);
      s.embeddedHighlights[viewModel.id] = viewModel;
      s.highlighter.draw(viewModel);
    },
    annotationDeleted(ann: IAnnotationAPIModel) {
      if (!s) {
        throw new Error('App not initialized!');
      }
      console.log(s.embeddedHighlights[ann.id as number])
      s.highlighter.undraw(s.embeddedHighlights[ann.id as number]);
    },
    annotationUpdated(ann: IAnnotationAPIModel) {
      if (!s) {
        throw new Error('App not initialized!');
      }
      s.highlighter.redraw(s.embeddedHighlights[ann.id as number]);
    }
  };
}
