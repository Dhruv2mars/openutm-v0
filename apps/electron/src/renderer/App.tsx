import { useState } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="container">
      <h1>OpenUTM (Electron)</h1>
      <p>Cross-platform hypervisor</p>

      <div className="row">
        <button onClick={() => setCount((c) => c + 1)}>
          count is {count}
        </button>
      </div>

      <p>VM Management UI coming soon...</p>
    </main>
  );
}

export default App;
