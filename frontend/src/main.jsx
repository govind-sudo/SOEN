import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'remixicon/fonts/remixicon.css'
import App from './App.jsx'
import 'highlight.js/styles/nord.css';
import hljs from 'highlight.js';

createRoot(document.getElementById('root')).render(

  <App />

)
