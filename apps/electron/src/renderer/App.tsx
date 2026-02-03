export default function App() {
  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Hello OpenUTM (Electron)</h1>
      <p style={styles.text}>Cross-platform hypervisor</p>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f5f5f5'
  },
  heading: {
    fontSize: '2rem',
    fontWeight: 'bold' as const,
    color: '#333',
    margin: '0 0 1rem 0'
  },
  text: {
    fontSize: '1rem',
    color: '#666',
    margin: 0
  }
};
