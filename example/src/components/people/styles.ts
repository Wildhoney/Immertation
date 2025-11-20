import { css, keyframes } from '@emotion/react';

export const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

export const globalStyles = css`
  @import url('https://fonts.googleapis.com/css2?family=Foldit:wght@100..900&display=swap');

  * {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  html,
  body,
  #root {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  body {
    background: white;
  }
`;

export const wrapper = css`
  width: 500px;
  margin: 40px auto;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
`;

export const title = css`
  font-family: 'Foldit', sans-serif;
  font-size: 56px;
  color: #000000;
  margin-bottom: 0;
  text-align: center;
  font-variation-settings: 'wght' 600;
`;

export const container = css`
  flex: 1;
  padding: 32px;
  background: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export const buttonGroup = css`
  margin-bottom: 24px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
`;

export const listContainer = css`
  flex: 1;
  overflow-y: auto;
`;

export const spinningLoader = css`
  animation: ${spin} 1s linear infinite;
  color: #1890ff;
`;

export const userIcon = css`
  color: #000000;
`;

export const creatingText = css`
  font-style: italic;
  color: #8c8c8c;
`;

export const secondaryText = css`
  font-size: 14px;
`;

export const creatingSecondaryText = css`
  font-size: 14px;
  font-style: italic;
`;
