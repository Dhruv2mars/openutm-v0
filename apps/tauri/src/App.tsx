import { useState } from "react";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="container">
      <h1>Hello OpenUTM (Tauri)</h1>
      <p>Cross-platform hypervisor</p>

      <div className="row">
        <button onClick={() => setCount((c) => c + 1)}>
          count is {count}
        </button>
      </div>

      <p>
        Click on the Tauri logo to learn more
      </p>
    </main>
  );
}

export default App;
