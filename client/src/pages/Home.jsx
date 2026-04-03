import { Link } from 'react-router-dom'
import { FaGraduationCap, FaGamepad, FaVideo, FaHandSparkles, FaBolt, FaShieldHalved } from 'react-icons/fa6'
import { useEffect, useRef } from 'react'
import './Home.css'

export default function Home() {
  const observerRef = useRef(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1 }
    )

    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      observerRef.current.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <div className="home-page page-enter">
      {/* ── Hero Section ── */}
      <section className="hero">
        <div className="hero-content container">
          <div className="hero-badge">
            <FaHandSparkles />
            <span>AI-Powered Sign Language Platform</span>
          </div>
          <h1 className="hero-title">
            Breaking <span className="gradient-text">Barriers</span> in
            <br />Communication
          </h1>
          <p className="hero-subtitle">
            Real-time American Sign Language detection and translation.
            Connect with anyone through video calls, learn ASL interactively,
            and practice with AI-powered feedback.
          </p>
          <div className="hero-actions">
            <Link to="/call" className="btn-primary">
              <span>Start Video Call</span>
              <FaVideo />
            </Link>
            <Link to="/learn" className="btn-secondary">
              <span>Learn ASL</span>
              <FaGraduationCap />
            </Link>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value gradient-text">36</span>
              <span className="stat-label">Signs Supported</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value gradient-text">Real-Time</span>
              <span className="stat-label">Translation</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value gradient-text">P2P</span>
              <span className="stat-label">Video Calls</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-glow" />
          <div className="hero-hand-emoji">🤟</div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="features container scroll-reveal">
        <h2 className="section-title">
          Everything You Need to <span className="gradient-text">Communicate</span>
        </h2>
        <p className="section-subtitle">
          Three powerful tools designed to make sign language accessible to everyone.
        </p>
        <div className="features-grid">
          <Link to="/learn" className="feature-card glass-card">
            <div className="feature-icon learn-icon">
              <FaGraduationCap />
            </div>
            <h3>Learn ASL</h3>
            <p>
              Interactive reference guide with all 36 ASL signs.
              Visual cards for every letter and number with learning tips.
            </p>
            <span className="feature-cta">Start Learning →</span>
          </Link>

          <Link to="/practice" className="feature-card glass-card featured">
            <div className="feature-badge">Most Popular</div>
            <div className="feature-icon practice-icon">
              <FaGamepad />
            </div>
            <h3>Practice Signs</h3>
            <p>
              Real-time camera feedback powered by AI.
              Practice any sign and get instant recognition with confidence scoring.
            </p>
            <span className="feature-cta">Start Practicing →</span>
          </Link>

          <Link to="/call" className="feature-card glass-card">
            <div className="feature-icon call-icon">
              <FaVideo />
            </div>
            <h3>Video Call</h3>
            <p>
              Peer-to-peer video calls with live ASL-to-text translation.
              Chat, screen share, and text-to-speech built in.
            </p>
            <span className="feature-cta">Make a Call →</span>
          </Link>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="how-it-works container scroll-reveal">
        <h2 className="section-title">
          How <span className="gradient-text">VisionTalk</span> Works
        </h2>
        <div className="steps-grid">
          <div className="step glass-card">
            <div className="step-number">01</div>
            <div className="step-icon">✋</div>
            <h3>Sign</h3>
            <p>Make an ASL hand sign in front of your camera. Our AI tracks 21 hand landmarks in real-time.</p>
          </div>
          <div className="step-connector">
            <div className="connector-line" />
            <FaBolt className="connector-icon" />
          </div>
          <div className="step glass-card">
            <div className="step-number">02</div>
            <div className="step-icon">🧠</div>
            <h3>Detect</h3>
            <p>MediaPipe extracts hand coordinates and our trained ML model classifies the sign instantly.</p>
          </div>
          <div className="step-connector">
            <div className="connector-line" />
            <FaBolt className="connector-icon" />
          </div>
          <div className="step glass-card">
            <div className="step-number">03</div>
            <div className="step-icon">💬</div>
            <h3>Translate</h3>
            <p>The detected sign is converted to text and displayed on screen — or spoken aloud via TTS.</p>
          </div>
        </div>
      </section>

      {/* ── Why VisionTalk ── */}
      <section className="why-section container scroll-reveal">
        <h2 className="section-title">
          Built for <span className="gradient-text">Accessibility</span>
        </h2>
        <div className="why-grid">
          <div className="why-card glass-card">
            <FaBolt className="why-icon" />
            <h4>Zero Latency</h4>
            <p>In-browser hand detection means instant response. No cloud round-trips.</p>
          </div>
          <div className="why-card glass-card">
            <FaShieldHalved className="why-icon" />
            <h4>Privacy First</h4>
            <p>Your camera feed stays on your device. Peer-to-peer, no server recording.</p>
          </div>
          <div className="why-card glass-card">
            <FaHandSparkles className="why-icon" />
            <h4>Easy to Use</h4>
            <p>No sign-up required. Generate a room code and start communicating.</p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section scroll-reveal">
        <div className="cta-card glass container">
          <h2>Ready to <span className="gradient-text">Connect</span>?</h2>
          <p>Start a video call or practice your ASL skills right now.</p>
          <div className="cta-actions">
            <Link to="/call" className="btn-primary">
              <span>Start Video Call</span>
              <FaVideo />
            </Link>
            <Link to="/practice" className="btn-secondary">
              <span>Practice Mode</span>
              <FaGamepad />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="container">
          <p className="footer-text">
            <span className="gradient-text">VisionTalk</span> — Empowering deaf and hard of hearing communities through technology.
          </p>
        </div>
      </footer>
    </div>
  )
}
