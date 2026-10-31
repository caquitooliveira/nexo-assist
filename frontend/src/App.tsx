import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Atendimento from './pages/Atendimento'
import ConsoleAnalista from './pages/ConsoleAnalista'
import Login from './pages/Login'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/atendimento" element={<Atendimento />} />
        <Route path="/analista" element={<ConsoleAnalista />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App