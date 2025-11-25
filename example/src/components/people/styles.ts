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
  }

  body {
    background: white;
  }

  @media (max-width: 768px) {
    .ant-notification-bottom {
      left: 50% !important;
      right: auto !important;
      transform: translateX(-50%);
    }
  }
`;

export const wrapper = css`
  width: 700px;
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
  min-height: 0;
`;

export const buttonGroup = css`
  margin-bottom: 16px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
`;

export const statsGroup = css`
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-shrink: 0;
`;

export const statBadge = css`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f0f0f0;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 13px;
  color: #595959;
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

export const cornerLinks = css`
  position: fixed;
  left: 24px;
  top: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const cornerLink = css`
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #595959;
  font-size: 13px;

  .ant-float-btn {
    position: relative !important;
    inset: auto !important;
  }

  &:hover {
    color: #1890ff;
  }
`;
