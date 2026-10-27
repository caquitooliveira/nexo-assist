import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Atendimento from './pages/Atendimento'
import Login from './pages/Login'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/atendimento" element={<Atendimento />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App