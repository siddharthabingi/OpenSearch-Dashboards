import React from 'react';

import {
  KuiFlexGroup,
  KuiFlexItem,
  KuiFlexGrid,
} from '../../../../components';

export default () => (
  <div>
    <KuiFlexGroup growItems={false}>
      <KuiFlexItem>Group One</KuiFlexItem>
      <KuiFlexItem>
        <div>Group Two</div>
        <br/><br/>
        <KuiFlexGrid columns="3">
          <KuiFlexItem>Nested Grid One</KuiFlexItem>
          <KuiFlexItem>Nested Grid Two</KuiFlexItem>
          <KuiFlexItem>Nested Grid Three</KuiFlexItem>
          <KuiFlexItem>Nested Grid Four</KuiFlexItem>
        </KuiFlexGrid>
      </KuiFlexItem>
    </KuiFlexGroup>
  </div>
);
