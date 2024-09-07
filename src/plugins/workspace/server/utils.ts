/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import {
  OpenSearchDashboardsRequest,
  SharedGlobalConfig,
  Permissions,
  SavedObjectsClientContract,
  IUiSettingsClient,
} from '../../../core/server';
import { updateWorkspaceState } from '../../../core/server/utils';
import { DEFAULT_DATA_SOURCE_UI_SETTINGS_ID } from '../../data_source_management/common';
import { CURRENT_USER_PLACEHOLDER } from '../common/constants';

/**
 * Generate URL friendly random ID
 */
export const generateRandomId = (size: number) => {
  return crypto.randomBytes(size).toString('base64url').slice(0, size);
};

export const updateDashboardAdminStateForRequest = (
  request: OpenSearchDashboardsRequest,
  groups: string[],
  users: string[],
  configGroups: string[],
  configUsers: string[]
) => {
  // If the security plugin is not installed, login defaults to OSD Admin
  if (!groups.length && !users.length) {
    updateWorkspaceState(request, { isDashboardAdmin: true });
    return;
  }
  // If groups/users are not configured or [], login defaults to OSD Admin
  if (!configGroups.length && !configUsers.length) {
    updateWorkspaceState(request, { isDashboardAdmin: true });
    return;
  }
  const groupMatchAny = groups.some((group) => configGroups.includes(group));
  const userMatchAny = users.some((user) => configUsers.includes(user));
  updateWorkspaceState(request, {
    isDashboardAdmin: groupMatchAny || userMatchAny,
  });
};

export const getOSDAdminConfigFromYMLConfig = async (
  globalConfig$: Observable<SharedGlobalConfig>
) => {
  const globalConfig = await globalConfig$.pipe(first()).toPromise();
  const groupsResult = (globalConfig.opensearchDashboards?.dashboardAdmin?.groups ||
    []) as string[];
  const usersResult = (globalConfig.opensearchDashboards?.dashboardAdmin?.users || []) as string[];

  return [groupsResult, usersResult];
};

export const transferCurrentUserInPermissions = (
  realUserId: string,
  permissions: Permissions | undefined
) => {
  if (!permissions) {
    return permissions;
  }
  return Object.keys(permissions).reduce<Permissions>(
    (previousPermissions, currentKey) => ({
      ...previousPermissions,
      [currentKey]: {
        ...permissions[currentKey],
        users: permissions[currentKey].users?.map((user) =>
          user === CURRENT_USER_PLACEHOLDER ? realUserId : user
        ),
      },
    }),
    {}
  );
};

export const getDataSourcesList = (client: SavedObjectsClientContract, workspaces: string[]) => {
  return client
    .find({
      type: 'data-source',
      fields: ['id', 'title'],
      perPage: 10000,
      workspaces,
    })
    .then((response) => {
      const objects = response?.saved_objects;
      if (objects) {
        return objects.map((source) => {
          const id = source.id;
          return {
            id,
          };
        });
      } else {
        return [];
      }
    });
};

export const checkAndSetDefaultDataSource = async (
  uiSettingsClient: IUiSettingsClient,
  dataSources: string[],
  needCheck: boolean
) => {
  if (dataSources?.length > 0) {
    if (!needCheck) {
      // Create# Will set first data source as default data source.
      await uiSettingsClient.set(DEFAULT_DATA_SOURCE_UI_SETTINGS_ID, dataSources[0]);
    } else {
      // Update will check if default DS still exists.
      const defaultDSId = (await uiSettingsClient.get(DEFAULT_DATA_SOURCE_UI_SETTINGS_ID)) ?? '';
      if (!dataSources.includes(defaultDSId)) {
        await uiSettingsClient.set(DEFAULT_DATA_SOURCE_UI_SETTINGS_ID, dataSources[0]);
      }
    }
  } else {
    // If there is no data source left, clear workspace level default data source.
    await uiSettingsClient.set(DEFAULT_DATA_SOURCE_UI_SETTINGS_ID, undefined);
  }
};
