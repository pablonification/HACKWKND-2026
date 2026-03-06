import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView — stub it so components that call it don't throw
window.HTMLElement.prototype.scrollIntoView = () => {};
