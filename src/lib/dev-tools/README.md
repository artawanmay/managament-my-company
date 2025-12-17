# Development Tools

Tools untuk tracking error, infinite loops, dan performance issues di React.

## Quick Start

### 1. Track Component Renders

```tsx
import { useRenderTracker, useLoopDetector } from '@/lib/dev-tools';

function MyComponent(props) {
  // Track renders dengan props comparison
  useRenderTracker('MyComponent', props, true); // verbose mode
  
  // Detect infinite loops (warns if > 20 renders/second)
  useLoopDetector('MyComponent');
  
  return <div>...</div>;
}
```

### 2. Track Hook State Changes

```tsx
import { trackHook, trackEffect } from '@/lib/dev-tools';

function MyComponent() {
  const [count, setCount] = useState(0);
  
  const handleClick = () => {
    trackHook('useState:count', 'MyComponent', count + 1, count);
    setCount(count + 1);
  };
  
  useEffect(() => {
    trackEffect('MyComponent', 'fetchData', [userId]);
    // ... effect code
  }, [userId]);
}
```

### 3. Measure Performance

```tsx
import { measureRender, startMark, endMark } from '@/lib/dev-tools';

function ExpensiveComponent() {
  return measureRender('ExpensiveComponent', () => {
    // ... expensive render logic
    return <div>...</div>;
  });
}

// Or for async operations:
async function fetchData() {
  startMark('fetchData');
  const data = await api.getData();
  endMark('fetchData'); // Logs: ⏱️ [PERF] fetchData: 123.45ms
  return data;
}
```

### 4. Why Did You Render

Untuk track re-renders yang tidak perlu:

```tsx
// Di component file
function MyComponent(props) {
  // ... component code
}

// Tambahkan di bawah component
MyComponent.whyDidYouRender = true;

export default MyComponent;
```

## Available Tools

### React Query DevTools
- Otomatis muncul di bottom-left saat development
- Klik icon untuk lihat query states, cache, mutations

### Console Outputs

| Emoji | Meaning |
|-------|---------|
| 🔄 | Component render |
| 🔴 | Infinite loop detected |
| 🪝 | Hook state change |
| ⚡ | useEffect execution |
| ⏱️ | Performance measurement |
| 🐢 | Slow render (> 16ms) |
| ⚠️ | Warning |
| 📝 | Props changed |
| 📊 | Performance summary |

### Debug Functions (Console)

```js
// Di browser console:
import('@/lib/dev-tools').then(d => {
  d.getAllRenderStats()      // Get all render counts
  d.getHookHistory()         // Get hook call history
  d.getSlowRenders()         // Get renders > 16ms
  d.logPerformanceSummary()  // Log performance stats
});
```

## VS Code Extensions (Recommended)

1. **Error Lens** - Highlight errors inline
2. **Console Ninja** - See console.log in editor
3. **React Developer Tools** - Browser extension

## Tips

1. **Detecting Loops**: Jika lihat 🔴 di console, cek:
   - useEffect tanpa dependency array
   - setState di dalam render
   - Circular state updates

2. **Slow Renders**: Jika lihat 🐢, cek:
   - Heavy computations (gunakan useMemo)
   - Large lists (gunakan virtualization)
   - Unnecessary re-renders (gunakan React.memo)

3. **Props Changes**: Jika lihat 📝 terlalu sering, cek:
   - Object/array props yang dibuat baru setiap render
   - Callback functions tanpa useCallback
