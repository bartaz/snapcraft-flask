import React, { Component, Fragment } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import Notification from "./notification";
import {
  AVAILABLE,
  AVAILABLE_REVISIONS_SELECT_LAUNCHPAD,
  AVAILABLE_REVISIONS_SELECT_UNRELEASED,
  AVAILABLE_REVISIONS_SELECT_RECENT,
  AVAILABLE_REVISIONS_SELECT_ALL
} from "../constants";
import {
  getChannelName,
  isInDevmode,
  getRevisionsArchitectures,
  getBuildId
} from "../helpers";

import RevisionsListRow from "./revisionsListRow";
import { closeHistory } from "../actions/history";
import { toggleRevision } from "../actions/channelMap";
import {
  getFilteredReleaseHistory,
  getPendingChannelMap,
  getSelectedRevision,
  getSelectedRevisions,
  getSelectedArchitectures,
  getFilteredAvailableRevisions,
  getFilteredAvailableRevisionsForArch,
  hasBuildRequestId
} from "../selectors";

import { getPendingRelease } from "../releasesState";

class RevisionsList extends Component {
  constructor() {
    super();

    this.state = {};
  }

  selectVersionClick(revisions) {
    revisions.forEach(revision => this.props.toggleRevision(revision));
  }

  renderRow(revision, isSelectable, showChannels, isPending, isActive) {
    return (
      <RevisionsListRow
        key={`revision-row-${revision.revision}`}
        revision={revision}
        isSelectable={isSelectable}
        showChannels={showChannels}
        isPending={isPending}
        isActive={isActive}
      />
    );
  }

  renderRows(revisions, isSelectable, showChannels, activeRevision) {
    return revisions.map(revision => {
      const isActive =
        activeRevision && revision.revision === activeRevision.revision;

      return this.renderRow(
        revision,
        isSelectable,
        showChannels,
        false,
        isActive
      );
    });
  }

  onCloseClick(event) {
    event.preventDefault();
    this.props.closeHistoryPanel();
  }

  showAllRevisions(key) {
    this.setState({
      [key]: true
    });
  }

  render() {
    let {
      availableRevisionsSelect,
      showChannels,
      filteredAvailableRevisions,
      pendingChannelMap,
      showBuildRequest
    } = this.props;
    let filteredRevisions = filteredAvailableRevisions;
    let title = "Latest revisions";
    let filters = this.props.filters;
    let isReleaseHistory = false;
    let pendingRelease = null;

    // selected revision in current architecture
    let selectedRevision;
    // list of revisions from other architectures that have same version (and are not selected yet)
    let selectedVersionRevisions = [];
    // list of architectures with revisions in selected version
    let selectedVersionRevisionsArchs = [];

    // list of revisions from other architectures that have same build id (and are not selected yet)
    let selectedBuildRevisions = [];
    // list of architectures with revisions in selected version
    let selectedBuildRevisionsArchs = [];

    let key;
    let showAllRevisions = false;
    // TODO: is it still possible that filters will be null?
    if (filters && filters.arch) {
      if (filters.risk === AVAILABLE) {
        filteredRevisions = this.props.getFilteredAvailableRevisionsForArch(
          filters.arch
        );

        if (availableRevisionsSelect === AVAILABLE_REVISIONS_SELECT_ALL) {
          title = (
            <Fragment>
              Latest revisions for <b>{filters.arch}</b>
            </Fragment>
          );
        } else if (
          availableRevisionsSelect === AVAILABLE_REVISIONS_SELECT_UNRELEASED
        ) {
          title = (
            <Fragment>
              Unreleased revisions for <b>{filters.arch}</b>
            </Fragment>
          );
        } else if (
          availableRevisionsSelect === AVAILABLE_REVISIONS_SELECT_RECENT
        ) {
          title = (
            <Fragment>
              Recent unreleased revisions for <b>{filters.arch}</b>
            </Fragment>
          );
        } else if (
          availableRevisionsSelect === AVAILABLE_REVISIONS_SELECT_LAUNCHPAD
        ) {
          title = (
            <Fragment>
              Revisions built on Launchpad for <b>{filters.arch}</b>
            </Fragment>
          );
        }
      } else {
        // when listing any other (real) channel, show filtered release history
        isReleaseHistory = true;
        title = (
          <Fragment>
            Releases history for <b>{filters.arch}</b> in{" "}
            <b>
              {filters.track}/{filters.risk}
              {filters.branch ? `/${filters.branch}` : ""}
            </b>
          </Fragment>
        );

        filteredRevisions = this.props.filteredReleaseHistory;

        pendingRelease = getPendingRelease(
          this.props.pendingReleases,
          filters.arch,
          `${filters.track}/${filters.risk}`
        );

        if (pendingRelease) {
          pendingRelease = this.props.revisions[pendingRelease];
        }
      }

      selectedRevision = this.props.getSelectedRevision(filters.arch);
      if (selectedRevision) {
        // find all revisions with same version as selected revision
        // but only one (latest) per architecture
        filteredAvailableRevisions.forEach(revision => {
          if (
            revision.version === selectedRevision.version &&
            revision.architectures.some(
              arch => selectedVersionRevisionsArchs.indexOf(arch) === -1
            )
          ) {
            selectedVersionRevisions.push(revision);
            selectedVersionRevisionsArchs = selectedVersionRevisionsArchs.concat(
              revision.architectures
            );
          }
        });

        // filter out revisions that are already selected
        selectedVersionRevisions = selectedVersionRevisions.filter(
          revision =>
            this.props.selectedRevisions.indexOf(revision.revision) === -1
        );

        // filter out current architecture
        selectedVersionRevisions = selectedVersionRevisions.filter(
          revision => revision.architectures.indexOf(filters.arch) === -1
        );

        // recalculate list of architectures from current list of revisions
        selectedVersionRevisionsArchs = getRevisionsArchitectures(
          selectedVersionRevisions
        );
      }

      if (selectedRevision && getBuildId(selectedRevision)) {
        // find all revisions with same build id as selected revision
        // but only one (latest) per architecture
        filteredAvailableRevisions.forEach(revision => {
          if (
            getBuildId(revision) === getBuildId(selectedRevision) &&
            revision.architectures.some(
              arch => selectedBuildRevisionsArchs.indexOf(arch) === -1
            )
          ) {
            selectedBuildRevisions.push(revision);
            selectedBuildRevisionsArchs = selectedVersionRevisionsArchs.concat(
              revision.architectures
            );
          }
        });

        // filter out revisions that are already selected
        selectedBuildRevisions = selectedBuildRevisions.filter(
          revision =>
            this.props.selectedRevisions.indexOf(revision.revision) === -1
        );

        // filter out current architecture
        selectedBuildRevisions = selectedBuildRevisions.filter(
          revision => revision.architectures.indexOf(filters.arch) === -1
        );

        // recalculate list of architectures from current list of revisions
        selectedBuildRevisionsArchs = getRevisionsArchitectures(
          selectedBuildRevisions
        );
      }

      key = `${filters.track}/${filters.risk}/${filters.arch}`;
      if (filters.risk === AVAILABLE) {
        key += `/${availableRevisionsSelect}`;
      }

      showAllRevisions = this.state[key];
    }

    const hasDevmodeRevisions = filteredRevisions.some(isInDevmode);

    let activeRevision = null;

    if (this.props.filters) {
      const activeChannel = getChannelName(filters.track, filters.risk);
      activeRevision = pendingChannelMap[activeChannel]
        ? pendingChannelMap[activeChannel][filters.arch]
        : null;
    }

    return (
      <Fragment>
        <div className="u-clearfix">
          <h4 className="u-float-left">{title}</h4>
          <a
            style={{ marginTop: "0.5rem" }}
            href="#"
            onClick={this.onCloseClick.bind(this)}
            className="p-icon--close u-float-right"
          />
        </div>
        {hasDevmodeRevisions && (
          <Notification>
            Revisions in development mode cannot be released to stable or
            candidate channels.
            <br />
            You can read more about{" "}
            <a href="/docs/snap-confinement">
              <code>devmode</code> confinement
            </a>{" "}
            and{" "}
            <a href="/docs/snapcraft-yaml-reference">
              <code>devel</code> grade
            </a>
            .
          </Notification>
        )}
        {!isReleaseHistory &&
          availableRevisionsSelect !== AVAILABLE_REVISIONS_SELECT_LAUNCHPAD &&
          selectedVersionRevisions.length > 0 && (
            <div className="p-releases-confirm">
              <b>{selectedRevision.version}</b> is available in{" "}
              <span className="p-tooltip">
                <span className="p-help">
                  {selectedVersionRevisionsArchs.length} other architecture
                  {selectedVersionRevisionsArchs.length > 1 ? "s" : ""}
                </span>
                <span className="p-tooltip__message" role="tooltip">
                  {selectedVersionRevisionsArchs.join(", ")}
                </span>
              </span>
              <div className="p-releases-confirm__buttons">
                <button
                  className="p-button--positive is-inline u-no-margin--bottom"
                  onClick={this.selectVersionClick.bind(
                    this,
                    selectedVersionRevisions
                  )}
                >
                  {"Select in available architectures"}
                </button>
              </div>
            </div>
          )}
        {!isReleaseHistory &&
          availableRevisionsSelect === AVAILABLE_REVISIONS_SELECT_LAUNCHPAD &&
          selectedBuildRevisions.length > 0 && (
            <div className="p-releases-confirm">
              <b>{selectedRevision.version}</b> build{" "}
              <b>
                <i className="p-icon--lp" /> {getBuildId(selectedRevision)}
              </b>{" "}
              is available in{" "}
              <span className="p-tooltip">
                <span className="p-help">
                  {selectedBuildRevisionsArchs.length} other architecture
                  {selectedBuildRevisionsArchs.length > 1 ? "s" : ""}
                </span>
                <span className="p-tooltip__message" role="tooltip">
                  {selectedBuildRevisionsArchs.join(", ")}
                </span>
              </span>
              <div className="p-releases-confirm__buttons">
                <button
                  className="p-button--positive is-inline u-no-margin--bottom"
                  onClick={this.selectVersionClick.bind(
                    this,
                    selectedBuildRevisions
                  )}
                >
                  {"Select in available architectures"}
                </button>
              </div>
            </div>
          )}
        <table className="p-revisions-list">
          <thead>
            <tr>
              <th width="30px" />
              <th
                className={!isReleaseHistory ? "col-checkbox-spacer" : ""}
                width="150px"
                scope="col"
              >
                Revision
              </th>
              <th scope="col">Version</th>
              {showBuildRequest && <th scope="col">Build Request</th>}
              {showChannels && <th scope="col">Channels</th>}
              <th scope="col" width="130px" className="u-align--right">
                {isReleaseHistory ? "Release date" : "Submission date"}
              </th>
            </tr>
          </thead>
          <tbody>
            {pendingRelease &&
              this.renderRow(
                pendingRelease,
                !isReleaseHistory,
                showChannels,
                true,
                activeRevision.revision === pendingRelease.revision
              )}
            {filteredRevisions.length > 0 ? (
              this.renderRows(
                showAllRevisions
                  ? filteredRevisions
                  : filteredRevisions.slice(0, 10),
                !isReleaseHistory,
                showChannels,
                activeRevision
              )
            ) : (
              <tr>
                <td colSpan="4">
                  <em>No releases</em>
                </td>
              </tr>
            )}
            {!showAllRevisions &&
              filteredRevisions.length > 10 && (
                <tr>
                  <td colSpan={4}>
                    <a onClick={this.showAllRevisions.bind(this, key)}>
                      Show all {filteredRevisions.length} revisions
                    </a>
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </Fragment>
    );
  }
}

RevisionsList.propTypes = {
  // state
  revisions: PropTypes.object.isRequired,
  filters: PropTypes.object,
  pendingReleases: PropTypes.object.isRequired,
  availableRevisionsSelect: PropTypes.string.isRequired,

  // computed state (selectors)
  showChannels: PropTypes.bool,
  showBuildRequest: PropTypes.bool,
  filteredReleaseHistory: PropTypes.array,
  selectedRevisions: PropTypes.array.isRequired,
  selectedArchitectures: PropTypes.array.isRequired,
  filteredAvailableRevisions: PropTypes.array.isRequired,
  getSelectedRevision: PropTypes.func.isRequired,
  getFilteredAvailableRevisionsForArch: PropTypes.func.isRequired,
  pendingChannelMap: PropTypes.object,

  // actions
  closeHistoryPanel: PropTypes.func.isRequired,
  toggleRevision: PropTypes.func.isRequired
};

const mapStateToProps = state => {
  return {
    availableRevisionsSelect: state.availableRevisionsSelect,
    showChannels:
      !state.history.filters ||
      (state.history.filters &&
        state.history.filters.risk === AVAILABLE &&
        state.availableRevisionsSelect === AVAILABLE_REVISIONS_SELECT_ALL),
    showBuildRequest: hasBuildRequestId(state),
    filters: state.history.filters,
    revisions: state.revisions,
    pendingReleases: state.pendingReleases,
    pendingChannelMap: getPendingChannelMap(state),
    selectedRevisions: getSelectedRevisions(state),
    getSelectedRevision: arch => getSelectedRevision(state, arch),
    filteredReleaseHistory: getFilteredReleaseHistory(state),
    selectedArchitectures: getSelectedArchitectures(state),
    filteredAvailableRevisions: getFilteredAvailableRevisions(state),
    getFilteredAvailableRevisionsForArch: arch =>
      getFilteredAvailableRevisionsForArch(state, arch)
  };
};

const mapDispatchToProps = dispatch => {
  return {
    closeHistoryPanel: () => dispatch(closeHistory()),
    toggleRevision: revision => dispatch(toggleRevision(revision))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RevisionsList);
