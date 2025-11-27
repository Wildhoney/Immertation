import type { ReactElement } from 'react';
import { Button, Space, Table as AntTable, Typography, Tag } from 'antd';
import { Person, type Data } from '../../types';
import { useController } from '../../utils';
import * as styles from '../../styles';

type Props = {
  controller: ReturnType<typeof useController>;
};

/**
 * Table component displaying the list of people with actions.
 */
export function Table({ controller }: Props): ReactElement {
  return (
    <div css={styles.list}>
      <AntTable
        dataSource={controller.state.model.people}
        rowKey="id"
        pagination={false}
        size="small"
        tableLayout="fixed"
        columns={[
          {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            width: 240,
            render: (name: string, _: Data, index: number) => {
              const { isCreating, isDeleting, isUpdating } = Person.status(index, controller.state.inspect);
              return (
                <Space>
                  <Typography.Text css={isDeleting ? styles.muted : undefined}>{name}</Typography.Text>
                  {isUpdating && <Tag color="blue">→ {controller.state.inspect.people[index].name.draft()}</Tag>}
                  {isCreating && <Tag color="green">Creating</Tag>}
                  {isDeleting && <Tag color="red">Deleting</Tag>}
                </Space>
              );
            },
          },
          {
            title: 'Age',
            dataIndex: 'age',
            key: 'age',
            width: 80,
          },
          {
            title: '',
            key: 'actions',
            width: 180,
            align: 'right',
            render: (_: unknown, person: Data, index: number) => {
              const { isDeleting, isUpdating, isPending } = Person.status(index, controller.state.inspect);
              return (
                <Space>
                  <Button
                    size="small"
                    disabled={isPending}
                    loading={isUpdating}
                    onClick={() => controller.handleUpdate(person.id)}
                  >
                    {isUpdating ? 'Updating…' : 'Update'}
                  </Button>
                  <Button
                    color="danger"
                    variant="filled"
                    size="small"
                    disabled={isPending}
                    loading={isDeleting}
                    onClick={() => controller.handleDelete(person.id)}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </Button>
                </Space>
              );
            },
          },
        ]}
      />
    </div>
  );
}
