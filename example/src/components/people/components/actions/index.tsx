import type { ReactElement } from 'react';
import { Button, Space } from 'antd';
import { SortAscendingOutlined, SortDescendingOutlined, PlusOutlined } from '@ant-design/icons';
import { Direction } from '../../types';
import { useController } from '../../utils';
import * as styles from '../../styles';

type Props = {
  controller: ReturnType<typeof useController>;
};

/**
 * Actions component with sort and create buttons.
 */
export function Actions({ controller }: Props): ReactElement {
  const { sorting } = controller.statistics;

  return (
    <div css={styles.buttons}>
      <Space size="middle">
        <Button
          variant="filled"
          icon={controller.direction === Direction.Asc ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
          onClick={controller.handleSort}
          loading={sorting}
          disabled={sorting}
        >
          {sorting ? 'Sorting...' : `Sort ${controller.direction === Direction.Asc ? 'Descending' : 'Ascending'}`}
        </Button>

        <Button variant="filled" icon={<PlusOutlined />} onClick={controller.handleCreate}>
          Create Person
        </Button>
      </Space>
    </div>
  );
}
