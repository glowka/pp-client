import React from 'react';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { createResource, deleteResource } from 'redux-json-api';
import Widget from 'components/widget';
import { Button, Modal } from 'semantic-ui-react';

import ViewerItem from './ViewerItem';
import styles from './Viewer.scss';
import { selectViewerState } from 'store/widgets/selectors';
import { hideViewer, showEditorAnnotation } from 'store/widgets/actions';
import { AnnotationAPIModel } from 'api/annotations';

interface IViewerProps {
  locationX: number;
  locationY: number;
  annotations: AnnotationAPIModel[];

  deleteAnnotation: (instance: AnnotationAPIModel) => Promise<object>;
  showEditorAnnotation: (x: number, y: number, id?: string) => void;
  hideViewer: () => void;
}

interface IViewerState {
  confirmDeleteModalOpen: boolean;
  deleteAnnotationId: string;
}

/*
 * TODO list
 * - [roadmap 6.1.4] the appear/disappear logic of Viewer is just a simulation and should be refined or
  * (preferably) straightforwardly adapted from old_src/ViewerWidget
 */
@connect(
  (state) => {
    const {
      locationX,
      locationY,
      annotations,
    } = selectViewerState(state);

    return {
      locationX,
      locationY,
      annotations,
    };
  },
  {
    showEditorAnnotation,
    hideViewer,
    deleteAnnotation: deleteResource,
  },
)
export default class Viewer extends React.Component<Partial<IViewerProps>, Partial<IViewerState>> {
  static defaultProps = {
    visible: true,
    locationX: 0,
    locationY: 0,
      annotations: [],
  };

  constructor(props: IViewerProps) {
    super(props);
    this.state = {
      confirmDeleteModalOpen: false,
      deleteAnnotationId: null,
    };
  }

  onItemEdit = (id: string) => {
    const {
      locationX,
      locationY,
    } = this.props;
    this.props.showEditorAnnotation(locationX, locationY, id);
    this.props.hideViewer();
  }

  onItemDelete = (id: string) => {
    this.setState({
      confirmDeleteModalOpen: true,
      deleteAnnotationId: id,
    });
}
  onItemConfirmedDelete = (e) => {
    const annotation = this.props.annotations.find(a => a.id === this.state.deleteAnnotationId);
    this.props.deleteAnnotation(annotation)
      .catch((errors) => {
        console.log(errors);
      });
    this.setState({
      confirmDeleteModalOpen: false,
      deleteAnnotationId: null,
    });
  }

  onMouseLeave = (e) => {
    // Close the window only when the modal is not open
    if (!this.state.confirmDeleteModalOpen) {
      this.props.hideViewer();
    }
  }

  setDeleteModalClosed = (e) => {
    // todo: in the future we should handle the case when the modal has just been closed and
    // the cursor is outside the viewer (so it never actually leaves the viewer area)
    this.setState({
      confirmDeleteModalOpen: false,
      deleteAnnotationId: null,
    });
  }

  renderItems() {
    return this.props.annotations.map((annotation) => {
      const attrs = annotation.attributes;
      return (
        <ViewerItem
          key={annotation.id}
          annotation={annotation}
          onDelete={this.onItemDelete}
          onEdit={this.onItemEdit}
        />
      );
    });
  }

  renderDeleteModal() {
    return (
      <Modal
        size="mini"
        className="pp-ui"
        open={this.state.confirmDeleteModalOpen}
      >
        <Modal.Content>
          <p>Czy na pewno chcesz usunąć przypis?</p>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={this.setDeleteModalClosed} size="tiny" negative={true}>
            Nie
          </Button>
          <Button onClick={this.onItemConfirmedDelete} size="tiny" positive={true}>
            Tak
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }

  render() {
    return (
      <Widget
        className={classNames('pp-ui', styles.self)}
        locationX={this.props.locationX}
        locationY={this.props.locationY}
        updateInverted={true}
        widgetTriangle={true}
        onMouseLeave={this.onMouseLeave}
      >
        <ul className={styles.annotationItems}>
          {this.renderItems()}
        </ul>
        {this.renderDeleteModal()}
      </Widget>
    );
  }
}