import { useMemo, useReducer, useEffect, useState } from 'react';
import { G } from '@mobily/ts-belt';
import { User, Loader2, Github } from 'lucide-react';
import { Button, Space, List, Typography, FloatButton, App } from 'antd';
import { SortAscendingOutlined, SortDescendingOutlined, PlusOutlined } from '@ant-design/icons';
import { Global } from '@emotion/react';
import 'antd/dist/reset.css';
import { State, Op } from '../../../../src';
import { model, useController, type Person, type Model } from './utils';
import * as styles from './styles';

const { Text } = Typography;

export default function People() {
  const state = useMemo(
    () =>
      new State<Model>(model, (value: Person | Person[] | Model) => {
        if (G.isArray(value)) {
          return `people/${value.map((person) => person.id.toString()).join(',')}`;
        }
        if ('id' in value) {
          return `person/${value.id.toString()}`;
        }
        return String(value);
      }),
    []
  );
  const forceUpdate = useReducer((x) => x + 1, 0)[1];
  const { handleUpdate, handleDelete, handleCreate, handleSort } = useController(state);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    return state.observe(() => forceUpdate());
  }, [state]);

  const toggleSort = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    handleSort(newOrder);
  };



  return (
    <App>
      <Global styles={styles.globalStyles} />
      <div css={styles.wrapper}>
        <h1 css={styles.title}>Immertation</h1>
        <div css={styles.container}>
          <div css={styles.buttonGroup}>
            <Space size="middle">
              <Button
                variant="filled"
                icon={sortOrder === 'asc' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
                onClick={toggleSort}
              >
                Sort {sortOrder === 'asc' ? 'Descending' : 'Ascending'}
              </Button>
              <Button
                variant="filled"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                Create Person
              </Button>
            </Space>
          </div>
          <div css={styles.listContainer}>
            <List
          dataSource={state.inspect.people.draft()}
          renderItem={(person, index) => {
            const annotations = state.inspect.people[index];
            const isDeleting = annotations.age.is(Op.Remove);
            const isCreating = annotations.pending();
            console.log(annotations.pending());
            const isPending = isCreating || isDeleting || annotations.name.pending();

            return (
              <List.Item
                key={String(person.id)}
                actions={[
                  <Button
                    key="update"
                    size="small"
                    disabled={isCreating || annotations.name.is(Op.Update)}
                    loading={annotations.name.is(Op.Update)}
                    onClick={() => handleUpdate(person.id)}
                  >
                    {annotations.name.is(Op.Update) ? 'Updating…' : 'Update'}
                  </Button>,
                  <Button
                    key="delete"
                    color="danger"
                    variant="filled"
                    size="small"
                    disabled={isCreating || isDeleting}
                    loading={isDeleting}
                    onClick={() => handleDelete(person.id)}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    isPending ? (
                      <Loader2 size={20} css={styles.spinningLoader} />
                    ) : (
                      <User size={20} css={styles.userIcon} />
                    )
                  }
                  title={
                    <Space>
                      <Text css={isCreating ? styles.creatingText : undefined}>
                        {person.name}
                      </Text>
                      {annotations.name.pending() && !isCreating && (
                        <Text type="secondary" css={styles.secondaryText}>
                          ({annotations.name.draft()})
                        </Text>
                      )}
                      {isCreating && (
                        <Text type="secondary" css={styles.creatingSecondaryText}>
                          (Creating...)
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
          </div>
        </div>
      </div>
      <FloatButton
        icon={<Github size={20} />}
        href="https://github.com/Wildhoney/Immertation"
        target="_blank"
        tooltip="View on GitHub"
        style={{ right: 24, bottom: 24 }}
      />
    </App>
  );
}
