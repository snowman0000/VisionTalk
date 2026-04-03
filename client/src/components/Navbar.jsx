import { NavLink } from 'react-router-dom'
import { FaHandSparkles, FaGraduationCap, FaGamepad, FaVideo } from 'react-icons/fa6'
import { useState } from 'react'
import './Navbar.css'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { to: '/', label: 'Home', icon: <FaHandSparkles /> },
    { to: '/learn', label: 'Learn ASL', icon: <FaGraduationCap /> },
    { to: '/practice', label: 'Practice', icon: <FaGamepad /> },
    { to: '/call', label: 'Video Call', icon: <FaVideo /> },
  ]

  return (
    <nav className="navbar glass">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand">
          <span className="brand-icon">🤟</span>
          <span className="brand-text gradient-text">VisionTalk</span>
        </NavLink>

        <button
          className={`hamburger ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {links.map(link => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
                end={link.to === '/'}
              >
                {link.icon}
                <span>{link.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
