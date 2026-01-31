import React from 'react'
import ReactDOM from 'react-dom/client'
import NurseryBudgetApp from './NurseryBudgetApp.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <NurseryBudgetApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
