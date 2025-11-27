import type { ReactElement } from 'react';
import { Badge } from 'antd';
import { TeamOutlined, PlusOutlined, SyncOutlined, DeleteOutlined } from '@ant-design/icons';
import { useController } from '../../utils';
import * as styles from '../../styles';

type Props = {
  controller: ReturnType<typeof useController>;
};

/**
 * Statistics component displaying counts for total, creating, updating, and deleting.
 */
export function Statistics({ controller }: Props): ReactElement {
  const { statistics } = controller;

  return (
    <div css={styles.stats}>
      <span css={styles.badge}>
        <TeamOutlined /> <Badge count={statistics.total} showZero color="#8c8c8c" />
      </span>
      <span css={styles.badge}>
        <PlusOutlined /> <Badge count={statistics.creating} showZero color="#52c41a" />
      </span>
      <span css={styles.badge}>
        <SyncOutlined /> <Badge count={statistics.updating} showZero color="#1890ff" />
      </span>
      <span css={styles.badge}>
        <DeleteOutlined /> <Badge count={statistics.deleting} showZero color="#ff4d4f" />
      </span>
    </div>
  );
}
