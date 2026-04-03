import { useState, useRef, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import {
  FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash,
  FaDesktop, FaComment, FaVolumeHigh, FaPhone, FaCopy,
  FaArrowRight, FaPlus, FaPaperPlane, FaXmark
} from 'react-icons/fa6'
import './VideoCall.css'

const SIGNALING_URL = 'http://localhost:3001'
const BACKEND_URL = 'http://localhost:5000'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

export default function VideoCall() {
  // ─── State ───
  const [phase, setPhase] = useState('lobby') // lobby | connecting | incall
  const [roomId, setRoomId] = useState('')
  const [username, setUsername] = useState('')
  const [remotePeer, setRemotePeer] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [localTranscription, setLocalTranscription] = useState('')
  const [remoteTranscription, setRemoteTranscription] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('')
  const [error, setError] = useState('')

  // ─── Refs ───
  const socketRef = useRef(null)
  const pcRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const handsRef = useRef(null)
  const cameraRef = useRef(null)
  const hiddenVideoRef = useRef(null)
  const remoteUserRef = useRef(null)
  const lastPredRef = useRef(null)
  const predCountRef = useRef(0)

  // ─── Create Room ───
  const createRoom = async () => {
    try {
      const res = await fetch(`${SIGNALING_URL}/create-room`)
      const data = await res.json()
      setRoomId(data.roomId)
    } catch (err) {
      setError('Could not connect to signaling server. Make sure it is running on port 3001.')
    }
  }

  // ─── Send Landmarks ───
  const sendLandmarks = useCallback(async (landmarks) => {
    try {
      const flat = []
      for (const lm of landmarks) {
        flat.push(lm.x, lm.y)
      }

      const res = await fetch(`${BACKEND_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks: flat })
      })
      const data = await res.json()
      if (data.debounced || !data.prediction) return

      // Build transcription
      if (data.prediction === lastPredRef.current) {
        predCountRef.current += 1
        if (predCountRef.current === 5) {
          setLocalTranscription(prev => prev + data.prediction)
          // Relay to remote
          if (socketRef.current && roomId) {
            socketRef.current.emit('asl-transcription', {
              roomId,
              text: data.prediction,
              username: username || 'You'
            })
          }
        }
      } else {
        lastPredRef.current = data.prediction
        predCountRef.current = 0
      }
    } catch (err) {
      // Silent
    }
  }, [roomId, username])

  // ─── Start MediaPipe ───
  const startMediaPipe = useCallback((videoElement) => {
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
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        sendLandmarks(results.multiHandLandmarks[0])
      }
    })
    handsRef.current = hands

    // Use hidden video for MediaPipe processing
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement })
      },
      width: 640,
      height: 480
    })
    cameraRef.current = camera
    camera.start()
  }, [sendLandmarks])

  // ─── Join Room ───
  const joinRoom = async () => {
    if (!roomId.trim()) {
      setError('Please enter a room code')
      return
    }
    const displayName = username.trim() || 'Anonymous'
    setUsername(displayName)
    setPhase('connecting')
    setConnectionStatus('Connecting to signaling server...')
    setError('')

    try {
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Start MediaPipe on hidden video
      const hiddenVideo = document.createElement('video')
      hiddenVideo.playsInline = true
      hiddenVideo.muted = true
      hiddenVideo.srcObject = stream
      hiddenVideo.play()
      hiddenVideoRef.current = hiddenVideo
      startMediaPipe(hiddenVideo)

      // Socket connection
      const socket = io(SIGNALING_URL)
      socketRef.current = socket

      socket.on('connect', () => {
        setConnectionStatus('Joining room...')
        socket.emit('join-room', { roomId: roomId.trim(), username: displayName })
      })

      socket.on('room-joined', async ({ roomId: room, users }) => {
        setConnectionStatus('Joined room. Waiting for peer...')
        setPhase('incall')

        if (users.length > 0) {
          // There's already someone in the room — create offer
          const userId = users[0].userId
          remoteUserRef.current = userId
          setRemotePeer(users[0].username)
          setConnectionStatus('Peer found! Establishing connection...')
          await createPeerConnection(socket, userId, stream, true)
        }
      })

      socket.on('room-full', () => {
        setError('Room is full. Maximum 2 participants.')
        setPhase('lobby')
        stream.getTracks().forEach(t => t.stop())
      })

      socket.on('user-joined', async ({ userId, username: name }) => {
        remoteUserRef.current = userId
        setRemotePeer(name)
        setConnectionStatus('Peer joined! Establishing connection...')
        await createPeerConnection(socket, userId, stream, false)
      })

      socket.on('offer', async ({ from, offer }) => {
        remoteUserRef.current = from
        if (!pcRef.current) {
          await createPeerConnection(socket, from, stream, false)
        }
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pcRef.current.createAnswer()
        await pcRef.current.setLocalDescription(answer)
        socket.emit('answer', { to: from, answer })
      })

      socket.on('answer', async ({ answer }) => {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer))
      })

      socket.on('ice-candidate', async ({ candidate }) => {
        try {
          await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (e) {
          console.warn('ICE candidate error:', e)
        }
      })

      socket.on('receive-message', (msg) => {
        setMessages(prev => [...prev, { ...msg, type: 'remote' }])
      })

      socket.on('asl-transcription', ({ text }) => {
        setRemoteTranscription(prev => prev + text)
        // TTS
        if (ttsEnabled) {
          const utter = new SpeechSynthesisUtterance(text)
          speechSynthesis.speak(utter)
        }
      })

      socket.on('user-left', () => {
        setConnectionStatus('Peer disconnected')
        setRemotePeer(null)
        setRemoteTranscription('')
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
        pcRef.current?.close()
        pcRef.current = null
      })

    } catch (err) {
      console.error('Join error:', err)
      setError('Could not access camera/mic. Please allow permissions.')
      setPhase('lobby')
    }
  }

  // ─── Create Peer Connection ───
  const createPeerConnection = async (socket, peerId, stream, createOffer) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('ice-candidate', { to: peerId, candidate: e.candidate })
      }
    }

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0]
        setConnectionStatus('Connected!')
      }
    }

    pc.onconnectionstatechange = () => {
      setConnectionStatus(pc.connectionState === 'connected' ? 'Connected!' : pc.connectionState)
    }

    if (createOffer) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('offer', { to: peerId, offer })
    }
  }

  // ─── Media Controls ───
  const toggleVideo = () => {
    const tracks = localStreamRef.current?.getVideoTracks()
    if (tracks) {
      tracks.forEach(t => t.enabled = !t.enabled)
      setVideoEnabled(!videoEnabled)
    }
  }

  const toggleAudio = () => {
    const tracks = localStreamRef.current?.getAudioTracks()
    if (tracks) {
      tracks.forEach(t => t.enabled = !t.enabled)
      setAudioEnabled(!audioEnabled)
    }
  }

  const toggleScreenShare = async () => {
    if (screenSharing) {
      // Stop screen share
      const videoTrack = localStreamRef.current?.getVideoTracks()[0]
      if (videoTrack) {
        const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(videoTrack)
      }
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      setScreenSharing(false)
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screenStream
        const screenTrack = screenStream.getVideoTracks()[0]
        const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(screenTrack)
        setScreenSharing(true)
        screenTrack.onended = () => { toggleScreenShare() }
      } catch (err) {
        console.warn('Screen share cancelled')
      }
    }
  }

  const sendMessage = () => {
    if (!chatInput.trim()) return
    const msg = {
      message: chatInput.trim(),
      username: username || 'You',
      timestamp: Date.now(),
      type: 'local'
    }
    setMessages(prev => [...prev, msg])
    socketRef.current?.emit('send-message', {
      roomId,
      message: chatInput.trim(),
      username: username || 'You'
    })
    setChatInput('')
  }

  const endCall = () => {
    pcRef.current?.close()
    socketRef.current?.disconnect()
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    cameraRef.current?.stop()
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    setPhase('lobby')
    setRemotePeer(null)
    setMessages([])
    setLocalTranscription('')
    setRemoteTranscription('')
  }

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      pcRef.current?.close()
      socketRef.current?.disconnect()
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      cameraRef.current?.stop()
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      
      if (hiddenVideoRef.current && hiddenVideoRef.current.srcObject) {
        hiddenVideoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // ─── Render: Lobby ───
  if (phase === 'lobby') {
    return (
      <div className="videocall-page page-enter">
        <div className="container">
          <div className="lobby">
            <div className="lobby-card glass">
              <div className="lobby-icon">📹</div>
              <h1>Start a <span className="gradient-text">Video Call</span></h1>
              <p>Connect with someone and communicate using ASL with real-time translation.</p>

              {error && <div className="lobby-error">{error}</div>}

              <div className="lobby-input-group">
                <input
                  type="text"
                  placeholder="Your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="lobby-input"
                  id="username-input"
                />
              </div>

              <div className="lobby-input-group">
                <input
                  type="text"
                  placeholder="Enter room code"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="lobby-input"
                  id="room-input"
                  maxLength={8}
                />
                <button className="btn-primary" onClick={joinRoom} id="join-room">
                  <span>Join</span>
                  <FaArrowRight />
                </button>
              </div>

              <div className="lobby-divider">
                <span>or</span>
              </div>

              <button className="btn-secondary create-room-btn" onClick={createRoom} id="create-room">
                <FaPlus />
                <span>Create New Room</span>
              </button>

              {roomId && (
                <div className="room-code-display">
                  <span>Room Code:</span>
                  <strong className="gradient-text">{roomId}</strong>
                  <button
                    className="copy-btn"
                    onClick={() => navigator.clipboard.writeText(roomId)}
                    title="Copy"
                  >
                    <FaCopy />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: In-Call ───
  return (
    <div className="videocall-page incall-page page-enter">
      <div className="call-layout">
        {/* ── Videos ── */}
        <div className="videos-section">
          {/* Remote Video */}
          <div className="remote-video-container glass">
            <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
            {!remotePeer && (
              <div className="waiting-overlay">
                <div className="waiting-spinner" />
                <p>{connectionStatus}</p>
              </div>
            )}
            {/* Remote Transcription */}
            {remoteTranscription && (
              <div className="transcription-bar remote-transcription">
                <span className="transcription-label">{remotePeer || 'Remote'}</span>
                <span className="transcription-text">{remoteTranscription}</span>
              </div>
            )}
          </div>

          {/* Local Video (PiP) */}
          <div className="local-video-container glass">
            <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
            {/* Local Transcription */}
            {localTranscription && (
              <div className="transcription-bar local-transcription">
                <span className="transcription-text">{localTranscription}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="call-controls glass">
          <button
            className={`control-btn ${!audioEnabled ? 'off' : ''}`}
            onClick={toggleAudio}
            title={audioEnabled ? 'Mute' : 'Unmute'}
          >
            {audioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>

          <button
            className={`control-btn ${!videoEnabled ? 'off' : ''}`}
            onClick={toggleVideo}
            title={videoEnabled ? 'Stop Video' : 'Start Video'}
          >
            {videoEnabled ? <FaVideo /> : <FaVideoSlash />}
          </button>

          <button
            className={`control-btn ${screenSharing ? 'active' : ''}`}
            onClick={toggleScreenShare}
            title="Screen Share"
          >
            <FaDesktop />
          </button>

          <button
            className={`control-btn ${chatOpen ? 'active' : ''}`}
            onClick={() => setChatOpen(!chatOpen)}
            title="Chat"
          >
            <FaComment />
            {messages.length > 0 && <span className="badge">{messages.length}</span>}
          </button>

          <button
            className={`control-btn ${ttsEnabled ? 'active' : ''}`}
            onClick={() => setTtsEnabled(!ttsEnabled)}
            title="Text-to-Speech"
          >
            <FaVolumeHigh />
          </button>

          <button className="control-btn end-call" onClick={endCall} title="End Call">
            <FaPhone />
          </button>
        </div>

        {/* ── Chat Panel ── */}
        {chatOpen && (
          <div className="chat-panel glass">
            <div className="chat-header">
              <h3>💬 Chat</h3>
              <button className="chat-close" onClick={() => setChatOpen(false)}>
                <FaXmark />
              </button>
            </div>
            <div className="chat-messages">
              {messages.length === 0 && (
                <p className="chat-empty">No messages yet. Say hi!</p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`chat-msg ${msg.type}`}>
                  <span className="msg-author">{msg.type === 'local' ? 'You' : msg.username}</span>
                  <span className="msg-text">{msg.message}</span>
                </div>
              ))}
            </div>
            <div className="chat-input-area">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="chat-input"
                id="chat-input"
              />
              <button className="btn-primary sm" onClick={sendMessage}>
                <FaPaperPlane />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
