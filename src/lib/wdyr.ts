/**
 * Why Did You Render - React re-render tracker
 * Only runs in development mode
 * 
 * Usage: Add `ComponentName.whyDidYouRender = true` to any component you want to track
 */
import React from 'react';

if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: false, // Set true to track all pure components
    trackHooks: true,
    logOnDifferentValues: true,
    collapseGroups: true,
    // Exclude common components that re-render often
    exclude: [/^Tooltip/, /^Popover/, /^Dialog/],
  });
}

export {};
