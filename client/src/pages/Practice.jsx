import { useState, useRef, useEffect, useCallback } from 'react'
import { FaCamera, FaCameraRotate, FaBullseye, FaTrophy, FaArrowRotateLeft, FaDeleteLeft, FaPlay } from 'react-icons/fa6'
import './Practice.css'

/* global Hands, Camera */
const BACKEND_URL = 'http://localhost:5000'

export default function Practice() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const cameraRef = useRef(null)
  const handsRef = useRef(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [confidence, setConfidence] = useState(0)
  const [builtText, setBuiltText] = useState('')
  const [stats, setStats] = useState({ total: 0, correct: 0 })
  const [challengeMode, setChallengeMode] = useState(false)
  const [challengeLetter, setChallengeLetter] = useState(null)
  const [challengeResult, setChallengeResult] = useState(null) // 'correct' | 'wrong' | null
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState(null)
  const lastPredRef = useRef(null)
  const predCountRef = useRef(0)

  const generateChallenge = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const newChar = chars[Math.floor(Math.random() * chars.length)]
    setChallengeLetter(newChar)
    setChallengeResult(null)
  }, [])

  const sendLandmarks = useCallback(async (landmarks) => {
    try {
      // Flatten landmarks to [x0, y0, x1, y1, ... x20, y20] = 42 features
      const flatLandmarks = []
      for (const lm of landmarks) {
        flatLandmarks.push(lm.x, lm.y)
      }

      const res = await fetch(`${BACKEND_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks: flatLandmarks })
      })

      const data = await res.json()

      if (data.debounced || !data.prediction) return

      setPrediction(data.prediction)
      setConfidence(data.confidence)
      setIsDetecting(true)

      // Character hold logic for text building
      if (data.prediction === lastPredRef.current) {
        predCountRef.current += 1
        if (predCountRef.current === 5) {
          setBuiltText(prev => prev + data.prediction)
        }
      } else {
        lastPredRef.current = data.prediction
        predCountRef.current = 0
      }

      // Challenge mode check
      if (challengeMode && challengeLetter) {
        if (data.prediction.toUpperCase() === challengeLetter && data.confidence > 0.6) {
          setChallengeResult('correct')
          setStats(prev => ({ total: prev.total + 1, correct: prev.correct + 1 }))
          setTimeout(generateChallenge, 1500)
        }
      }

    } catch (err) {
      // Silently ignore network errors during prediction
      console.warn('Prediction error:', err.message)
    }
  }, [challengeMode, challengeLetter, generateChallenge])

  const startCamera = useCallback(async () => {
    try {
      setError(null)

      const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      })

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      })

      hands.onResults((results) => {
        // Draw on canvas
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!canvas || !ctx) return

        canvas.width = results.image.width
        canvas.height = results.image.height

        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(results.image, 0, 0)

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0]

          // Draw landmarks
          for (const lm of landmarks) {
            const x = lm.x * canvas.width
            const y = lm.y * canvas.height
            ctx.beginPath()
            ctx.arc(x, y, 4, 0, 2 * Math.PI)
            ctx.fillStyle = '#6c5ce7'
            ctx.fill()
            ctx.strokeStyle = '#00cec9'
            ctx.lineWidth = 1.5
            ctx.stroke()
          }

          // Draw connections
          const connections = [
            [0,1],[1,2],[2,3],[3,4],
            [0,5],[5,6],[6,7],[7,8],
            [0,9],[9,10],[10,11],[11,12],
            [0,13],[13,14],[14,15],[15,16],
            [0,17],[17,18],[18,19],[19,20],
            [5,9],[9,13],[13,17]
          ]
          ctx.strokeStyle = 'rgba(108, 92, 231, 0.5)'
          ctx.lineWidth = 2
          for (const [a, b] of connections) {
            ctx.beginPath()
            ctx.moveTo(landmarks[a].x * canvas.width, landmarks[a].y * canvas.height)
            ctx.lineTo(landmarks[b].x * canvas.width, landmarks[b].y * canvas.height)
            ctx.stroke()
          }

          sendLandmarks(landmarks)
        } else {
          setIsDetecting(false)
          setPrediction(null)
          setConfidence(0)
        }

        ctx.restore()
      })

      handsRef.current = hands

      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current })
        },
        width: 640,
        height: 480
      })

      cameraRef.current = camera
      await camera.start()
      setCameraActive(true)

    } catch (err) {
      console.error('Camera error:', err)
      setError('Could not access camera. Please allow camera permissions.')
    }
  }, [sendLandmarks])

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop()
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop())
    }
    setCameraActive(false)
    setIsDetecting(false)
    setPrediction(null)
    setConfidence(0)
  }, [])

  useEffect(() => {
    return () => {
      cameraRef.current?.stop()
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className="practice-page page-enter">
      <div className="container">
        {/* ── Header ── */}
        <div className="practice-header">
          <h1>Practice <span className="gradient-text">Sign Language</span></h1>
          <p>Use your camera to practice ASL signs and get real-time AI feedback.</p>
        </div>

        <div className="practice-layout">
          {/* ── Camera Feed ── */}
          <div className="camera-section">
            <div className={`camera-container glass ${isDetecting ? 'detecting' : ''}`}>
              <video ref={videoRef} style={{ display: 'none' }} playsInline />
              <canvas ref={canvasRef} className="camera-canvas" />

              {!cameraActive && (
                <div className="camera-placeholder">
                  <FaCamera className="placeholder-icon" />
                  <p>Click "Start Camera" to begin</p>
                </div>
              )}

              {/* Prediction Overlay */}
              {prediction && cameraActive && (
                <div className="prediction-overlay">
                  <div className="prediction-letter">{prediction}</div>
                  <div className="prediction-confidence">
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{ width: `${confidence * 100}%` }}
                      />
                    </div>
                    <span>{Math.round(confidence * 100)}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="camera-controls">
              {!cameraActive ? (
                <button className="btn-primary" onClick={startCamera} id="start-camera">
                  <span>Start Camera</span>
                  <FaCamera />
                </button>
              ) : (
                <button className="btn-secondary danger-btn" onClick={stopCamera} id="stop-camera">
                  <span>Stop Camera</span>
                  <FaCameraRotate />
                </button>
              )}
            </div>

            {error && (
              <div className="error-message">{error}</div>
            )}
          </div>

          {/* ── Side Panel ── */}
          <div className="practice-panel">
            {/* Built Text */}
            <div className="panel-card glass">
              <h3>📝 Detected Text</h3>
              <div className="built-text-display">
                {builtText || <span className="placeholder-text">Signs will appear here...</span>}
                <span className="text-cursor">|</span>
              </div>
              <div className="text-controls">
                <button className="btn-secondary sm" onClick={() => setBuiltText(prev => prev.slice(0, -1))}>
                  <FaDeleteLeft /> Backspace
                </button>
                <button className="btn-secondary sm" onClick={() => setBuiltText(prev => prev + ' ')}>
                  Space
                </button>
                <button className="btn-secondary sm" onClick={() => setBuiltText('')}>
                  <FaArrowRotateLeft /> Clear
                </button>
              </div>
              {builtText && (
                <button
                  className="btn-primary sm speak-btn"
                  onClick={() => {
                    const utter = new SpeechSynthesisUtterance(builtText)
                    speechSynthesis.speak(utter)
                  }}
                >
                  🔊 Speak Text
                </button>
              )}
            </div>

            {/* Challenge Mode */}
            <div className="panel-card glass">
              <h3><FaBullseye /> Challenge Mode</h3>
              {!challengeMode ? (
                <button className="btn-primary" onClick={() => { setChallengeMode(true); generateChallenge(); }} id="start-challenge">
                  <span>Start Challenge</span>
                  <FaPlay />
                </button>
              ) : (
                <div className="challenge-active">
                  <p className="challenge-prompt">Sign this letter:</p>
                  <div className={`challenge-letter ${challengeResult === 'correct' ? 'correct' : ''}`}>
                    {challengeLetter}
                  </div>
                  {challengeResult === 'correct' && (
                    <div className="challenge-success">✅ Correct! Next one coming...</div>
                  )}
                  <button className="btn-secondary sm" onClick={() => { setChallengeMode(false); setChallengeResult(null); }}>
                    End Challenge
                  </button>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="panel-card glass">
              <h3><FaTrophy /> Stats</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-num gradient-text">{stats.total}</span>
                  <span className="stat-lbl">Challenges</span>
                </div>
                <div className="stat-item">
                  <span className="stat-num gradient-text">{stats.correct}</span>
                  <span className="stat-lbl">Correct</span>
                </div>
                <div className="stat-item">
                  <span className="stat-num gradient-text">
                    {stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%
                  </span>
                  <span className="stat-lbl">Accuracy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
