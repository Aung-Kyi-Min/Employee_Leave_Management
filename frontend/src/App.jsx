// import { useState } from 'react'
import { useEffect, useState } from 'react';
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [message, setMessage] = useState('Connecting...');

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error('API request failed');
        }
        return response.json();
      })
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Backend connection failed'));
  }, []);

  return (
    <main style={{ padding: '30px' }}>
      <h1>Employee Leave Management System</h1>
      <h2>Backend Connection Status</h2>
      <p>{message}</p>
    </main>
  );
}


export default App
