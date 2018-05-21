import React from 'react';
import ReactDOM from 'react-dom';

import AnnotationForm from './EditorContent';

import annotator, { ui, util } from 'annotator';
import { mover, resizer } from './editor-utils';
import AnnotationViewModel from '../annotation/AnnotationViewModel';

const { $ } = util;
const { widget: { Widget } } = ui;

/**
 * annotator.ui.editor.Editor extension
 * - without Editor field add and load mechanism (and React-rendered form)
 *
 * Css and show/hide functionality of the outer editor container is nevertheless inherited.
 */
export default class EditorWidget extends Widget {
  static classes = {
    ...Widget.classes,
    hide: 'pp-hide',
  };
  static template = `
  <div class="pp-ui pp-outer pp-editor-widget pp-hide">
  </div>`;

  private annotation: AnnotationViewModel | null;

  private resizer: {
    destroy: () => void;
  };
  private mover: {
    destroy: () => void;
  };

  private saveAction: (annotation: AnnotationViewModel) => any;

  constructor(options?: annotator.ui.widget.IWidgetOptions) {
    super(options || {});
    this.annotation = null;

    // jquery mouse action listeners from annotator module have been left out;
    // see annotator.ui.editor's constructor
  }

  /**
   * Public: Show the editor.
   *
   * position - An Object specifying the position in which to show the editor
   * (optional).
   *
   * Examples
   *
   * editor.show()
   * editor.hide()
   * editor.show({top: '100px', left: '80px'})
   *
   * Returns nothing.
   */
  show(position?: util.IPosition | null) {
    if (position) {
      this.element.css({
        top: position.top,
        left: position.left,
      });
    }
    super.show();
    this.setupDraggables();
  }

  /**
   * Loads the annotation and displays the edit window
   * Returns an unresolved Promise that will be resolved/rejected when the save/cancel button is clicked.
   */
  load(annotation: AnnotationViewModel,
       position: util.IPosition | null,
       saveAction: (annotation: AnnotationViewModel) => any) {
    this.annotation = annotation;
    this.saveAction = saveAction;
    this.updateForm(annotation);
    this.show(position);
  }

  /**
   * Renders (or updates, if already rendered) React component within the Editor html container
   */
  private updateForm(annotation: AnnotationViewModel) {
    ReactDOM.render(
      <AnnotationForm
        id={this.annotation ? this.annotation.id || 0 : 0}
        annotation={annotation}
        saveAction={this.saveAction}
        onSave={this.onSave}
        onCancel={this.onCancel}
      />,
      this.element.get(0), // underlying DOM element
    );
  }

  /**
   * When save button is clicked, React form field value dictionary will be passed to this function
   */
  private onSave = () => {
    // Resolve deferred promise; will result in asynchronous user input
    this.hide();
  }

  /**
   * Public: Cancels the editing process, discarding any edits made to the
   * annotation.
   */
  private onCancel = () => {
    this.hide();
  }

  /**
   * Sets up mouse events for resizing and dragging the editor window.
   *
   * Returns nothing.
   */
  private setupDraggables() {
    if (this.resizer) {
      this.resizer.destroy();
    }
    if (this.mover) {
      this.mover.destroy();
    }

    // KG todo
    // right now `annotator-resize` as well `annotator-item` doesn't exist, so resizing is not set up;
    // we might want to add it or remove the resizing part altogether
    this.element.find('.annotator-resize').remove();

    // Find the first/last item element depending on orientation
    let cornerItem;
    if (this.element.hasClass(Widget.classes.invert.y)) {
      cornerItem = this.element.find('.annotator-item:last');
    } else {
      cornerItem = this.element.find('.annotator-item:first');
    }

    if (cornerItem) {
      $('<span class="annotator-resize"></span>').appendTo(cornerItem);
    }

    const [moverArea, textarea, resizeHandle] = [
      '.pp-mover-area',
      'textarea:first',
      '.annotator-resize',
    ].map(x => this.element.find(x)[0]);

    this.resizer = resizer(textarea, resizeHandle, {
      invertedX: () => this.element.hasClass(Widget.classes.invert.x),
      invertedY: () => this.element.hasClass(Widget.classes.invert.y),
    });

    this.mover = mover(this.element[0], moverArea);
  }
}