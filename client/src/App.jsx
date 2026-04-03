import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import ParticleBackground from './components/ParticleBackground'
import Home from './pages/Home'
import LearnASL from './pages/LearnASL'
import Practice from './pages/Practice'
import VideoCall from './pages/VideoCall'

function App() {
  return (
    <>
      <ParticleBackground />
      <Navbar />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/learn" element={<LearnASL />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/call" element={<VideoCall />} />
        </Routes>
      </main>
    </>
  )
}

export default App
