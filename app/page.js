'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

// ── Slot coordinates on 3919×3919 source image ──────────────────────────────
const FLYER_SRC  = 3919
const PHOTO_SLOT = { x: 1972, y: 1138, w: 1793, h: 1600, r: 125 }
const NAME_SLOT  = { x: 2107, y: 2679, w: 1522, h: 400,  r: 100 }

// Confirmed stamp: centre point and size on source image
const STAMP = {
  cx: 1872 + Math.round(1693 * 0.08),
  cy: 1038 + 1447 - Math.round(1000 * 0.25),
  size: 1100,
  angle: -15,
}

// ── Canvas helpers ───────────────────────────────────────────────────────────
function roundedClip(ctx, s) {
  const { x, y, w, h, r } = s
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y,     x + w, y + r,     r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x,     y + h, x,     y + h - r, r)
  ctx.lineTo(x,     y + r)
  ctx.arcTo(x,     y,     x + r, y,         r)
  ctx.closePath()
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Home() {
  const flyerRef     = useRef(null)
  const stampRef     = useRef(null)
  const photoRef     = useRef(null)
  const dlCanvas     = useRef(null)
  const containerRef = useRef(null)
  const inputRef     = useRef(null)
  const cropCanvasRef = useRef(null)

  const [flyerReady,  setFlyerReady]  = useState(false)
  const [stampReady,  setStampReady]  = useState(false)
  const [photoSrc,    setPhotoSrc]    = useState(null)
  const [name,        setName]        = useState('')
  const [photoDrag,   setPhotoDrag]   = useState(false)
  const [working,     setWorking]     = useState(false)
  const [scale,       setScale]       = useState(1)
  const [fontSize,    setFontSize]    = useState(18)

  // Crop state
  const [cropping,    setCropping]    = useState(false)
  const [cropImg,     setCropImg]     = useState(null)   // raw img el before crop
  const [cropOffset,  setCropOffset]  = useState({ x: 0, y: 0 })
  const [cropZoom,    setCropZoom]    = useState(1)
  const [dragStart,   setDragStart]   = useState(null)
  const [cropOffsetStart, setCropOffsetStart] = useState({ x: 0, y: 0 })

  // ── Container scale ────────────────────────────────────────────────────────
  useEffect(() => {
    function measure() {
      if (!containerRef.current) return
      setScale(containerRef.current.clientWidth / FLYER_SRC)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Load flyer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const img = new Image()
    img.src = '/flyer.jpg'
    img.onload = () => { flyerRef.current = img; setFlyerReady(true) }
  }, [])

  // ── Load stamp ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const img = new Image()
    img.src = '/confirmed.png'
    img.onload = () => { stampRef.current = img; setStampReady(true) }
  }, [])

  // ── Auto-shrink name font ──────────────────────────────────────────────────
  useEffect(() => {
    if (!inputRef.current || scale === 0) return
    const maxW = NAME_SLOT.w * scale - 24
    const el   = inputRef.current
    let fs = Math.round(NAME_SLOT.h * scale * 0.58)
    el.style.fontSize = fs + 'px'
    while (el.scrollWidth > maxW && fs > 9) {
      fs -= 1
      el.style.fontSize = fs + 'px'
    }
    setFontSize(fs)
  }, [name, scale])

  // ── Draw crop canvas preview ───────────────────────────────────────────────
  const drawCrop = useCallback(() => {
    const canvas = cropCanvasRef.current
    if (!canvas || !cropImg) return
    const ctx = canvas.getContext('2d')
    const CW = canvas.width
    const CH = canvas.height

    ctx.clearRect(0, 0, CW, CH)

    // Draw photo at current offset + zoom
    const iw = cropImg.naturalWidth  * cropZoom
    const ih = cropImg.naturalHeight * cropZoom
    const dx = (CW - iw) / 2 + cropOffset.x
    const dy = (CH - ih) / 2 + cropOffset.y
    ctx.drawImage(cropImg, dx, dy, iw, ih)

    // Dim outside crop frame
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, CW, CH)

    // Cut out frame shape
    const fr = PHOTO_SLOT.r / FLYER_SRC * CW
    roundedClip(ctx, { x: 0, y: 0, w: CW, h: CH, r: fr })
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    // Redraw photo inside frame only
    ctx.save()
    roundedClip(ctx, { x: 0, y: 0, w: CW, h: CH, r: fr })
    ctx.clip()
    ctx.drawImage(cropImg, dx, dy, iw, ih)
    ctx.restore()

    // Frame border
    ctx.save()
    roundedClip(ctx, { x: 2, y: 2, w: CW-4, h: CH-4, r: fr })
    ctx.strokeStyle = '#f5c842'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.restore()
  }, [cropImg, cropOffset, cropZoom])

  useEffect(() => { drawCrop() }, [drawCrop])

  // ── Open crop tool ─────────────────────────────────────────────────────────
  function openCrop(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setCropImg(img)
      setCropOffset({ x: 0, y: 0 })
      // Initial zoom: fit image to fill frame (cover)
      const frameRatio = PHOTO_SLOT.w / PHOTO_SLOT.h
      const imgRatio   = img.naturalWidth / img.naturalHeight
      const zoom = imgRatio > frameRatio
        ? PHOTO_SLOT.h / img.naturalHeight
        : PHOTO_SLOT.w / img.naturalWidth
      setCropZoom(zoom)
      setCropping(true)
    }
    img.src = url
  }

  // ── Crop drag handlers ─────────────────────────────────────────────────────
  function onCropMouseDown(e) {
    e.preventDefault()
    const pt = e.touches ? e.touches[0] : e
    setDragStart({ x: pt.clientX, y: pt.clientY })
    setCropOffsetStart({ ...cropOffset })
  }

  function onCropMouseMove(e) {
    if (!dragStart) return
    const pt = e.touches ? e.touches[0] : e
    const dx = pt.clientX - dragStart.x
    const dy = pt.clientY - dragStart.y
    // Scale mouse delta to source image space
    const canvas = cropCanvasRef.current
    const dispW  = canvas ? canvas.offsetWidth : 1
    const srcScale = PHOTO_SLOT.w / dispW
    setCropOffset({
      x: cropOffsetStart.x + dx * srcScale / cropZoom * cropZoom,
      y: cropOffsetStart.y + dy * srcScale / cropZoom * cropZoom,
    })
  }

  function onCropMouseUp() { setDragStart(null) }

  // ── Commit crop → render into photo slot ──────────────────────────────────
  function commitCrop() {
    const canvas = document.createElement('canvas')
    canvas.width  = PHOTO_SLOT.w
    canvas.height = PHOTO_SLOT.h
    const ctx = canvas.getContext('2d')

    const iw = cropImg.naturalWidth  * cropZoom
    const ih = cropImg.naturalHeight * cropZoom
    const dx = (PHOTO_SLOT.w - iw) / 2 + cropOffset.x
    const dy = (PHOTO_SLOT.h - ih) / 2 + cropOffset.y
    ctx.drawImage(cropImg, dx, dy, iw, ih)

    const url = canvas.toDataURL('image/jpeg', 0.95)
    const img  = new Image()
    img.onload = () => {
      photoRef.current = img
      setPhotoSrc(url)
      setCropping(false)
      setCropImg(null)
    }
    img.src = url
  }

  // ── Download ───────────────────────────────────────────────────────────────
  function handleDownload() {
    setWorking(true)
    const canvas = dlCanvas.current
    canvas.width  = FLYER_SRC
    canvas.height = FLYER_SRC
    const ctx = canvas.getContext('2d')

    // 1. Flyer background
    ctx.drawImage(flyerRef.current, 0, 0, FLYER_SRC, FLYER_SRC)

    // 2. Photo inside rounded frame
    if (photoRef.current) {
      ctx.save()
      roundedClip(ctx, PHOTO_SLOT)
      ctx.clip()
      ctx.drawImage(photoRef.current, PHOTO_SLOT.x, PHOTO_SLOT.y, PHOTO_SLOT.w, PHOTO_SLOT.h)
      ctx.restore()
    }

    // 3. Name banner text
    const label = name.trim()
    if (label) {
      ctx.save()
      roundedClip(ctx, NAME_SLOT)
      ctx.clip()
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      let fs = Math.round(NAME_SLOT.h * 0.58)
      ctx.font = `bold ${fs}px Georgia, serif`
      ctx.fillStyle    = '#1a1a2e'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      while (ctx.measureText(label).width > NAME_SLOT.w - 80 && fs > 28) {
        fs -= 3
        ctx.font = `bold ${fs}px Georgia, serif`
      }
      ctx.fillText(label, NAME_SLOT.x + NAME_SLOT.w / 2, NAME_SLOT.y + NAME_SLOT.h / 2)
      ctx.restore()
    }

    // 4. Confirmed stamp on top, rotated -15°
    if (stampRef.current) {
      ctx.save()
      ctx.translate(STAMP.cx, STAMP.cy)
      ctx.rotate(STAMP.angle * Math.PI / 180)
      ctx.drawImage(stampRef.current, -STAMP.size / 2, -STAMP.size * (stampRef.current.naturalHeight / stampRef.current.naturalWidth) / 2, STAMP.size, STAMP.size * (stampRef.current.naturalHeight / stampRef.current.naturalWidth))
      ctx.restore()
    }

    setTimeout(() => {
      canvas.toBlob(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `gratitude-s17-${(name || 'flyer').replace(/\s+/g, '-').toLowerCase()}.jpg`
        a.click()
        setWorking(false)
      }, 'image/jpeg', 0.95)
    }, 80)
  }

  // ── Overlay positions (display px) ────────────────────────────────────────
  const photo = {
    left:         PHOTO_SLOT.x * scale,
    top:          PHOTO_SLOT.y * scale,
    width:        PHOTO_SLOT.w * scale,
    height:       PHOTO_SLOT.h * scale,
    borderRadius: PHOTO_SLOT.r * scale,
  }
  const nameBox = {
    left:         NAME_SLOT.x * scale,
    top:          NAME_SLOT.y * scale,
    width:        NAME_SLOT.w * scale,
    height:       NAME_SLOT.h * scale,
    borderRadius: NAME_SLOT.r * scale,
  }
  const stampDisp = {
    width:     STAMP.size * scale,
    height:    STAMP.size * scale * (stampRef.current ? stampRef.current.naturalHeight / stampRef.current.naturalWidth : 1),
    left:      (STAMP.cx - STAMP.size / 2) * scale,
    top:       (STAMP.cy - STAMP.size / 2) * scale,
    transform: `rotate(${STAMP.angle}deg)`,
  }

  // Crop canvas display size matches photo slot aspect ratio
  const CROP_DISP_W = Math.min(500, typeof window !== 'undefined' ? window.innerWidth - 48 : 500)
  const CROP_DISP_H = Math.round(CROP_DISP_W * PHOTO_SLOT.h / PHOTO_SLOT.w)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <canvas ref={dlCanvas} style={{ display: 'none' }} />

      {/* ── Crop modal ── */}
      {cropping && (
        <div style={S.cropOverlay}>
          <div style={S.cropModal}>
            <p style={S.cropTitle}>Drag to reposition · Scroll to zoom</p>

            <canvas
              ref={cropCanvasRef}
              width={PHOTO_SLOT.w}
              height={PHOTO_SLOT.h}
              style={{ width: CROP_DISP_W, height: CROP_DISP_H, cursor: 'grab', borderRadius: 10, display: 'block', touchAction: 'none' }}
              onMouseDown={onCropMouseDown}
              onMouseMove={onCropMouseMove}
              onMouseUp={onCropMouseUp}
              onMouseLeave={onCropMouseUp}
              onTouchStart={onCropMouseDown}
              onTouchMove={onCropMouseMove}
              onTouchEnd={onCropMouseUp}
              onWheel={e => {
                e.preventDefault()
                setCropZoom(z => Math.max(0.3, Math.min(5, z - e.deltaY * 0.001)))
              }}
            />

            <div style={S.cropZoomRow}>
              <span style={S.cropLabel}>Zoom</span>
              <input type="range" min="0.3" max="5" step="0.01"
                value={cropZoom}
                onChange={e => setCropZoom(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>

            <div style={S.cropBtns}>
              <button onClick={() => { setCropping(false); setCropImg(null) }} style={S.cropCancel}>
                Cancel
              </button>
              <button onClick={commitCrop} style={S.cropConfirm}>
                ✓ Use This Crop
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={S.wrap}>
        <div style={S.header}>
          <p style={S.eyebrow}>Glory Life Choir · Bariga Division</p>
          <h1 style={S.h1}>Personalise Your Flyer</h1>
          <p style={S.sub}>Tap the photo frame to add your picture · tap the name banner to type</p>
        </div>

        {/* ── Flyer with overlays ── */}
        <div ref={containerRef} style={S.flyerWrap}>
          {flyerReady
            ? <img src="/flyer.jpg" alt="Flyer" style={S.flyerImg} draggable={false} />
            : <div style={S.loading}>Loading…</div>
          }

          {/* Photo frame */}
          <div
            style={{
              ...S.photoSlot,
              ...photo,
              ...(photoDrag ? S.photoSlotDrag : {}),
              ...(photoSrc ? {
                backgroundImage: `url(${photoSrc})`,
                backgroundSize:  'cover',
                backgroundPosition: 'center',
              } : {}),
            }}
            onDragOver={e => { e.preventDefault(); setPhotoDrag(true) }}
            onDragLeave={() => setPhotoDrag(false)}
            onDrop={e => { e.preventDefault(); setPhotoDrag(false); openCrop(e.dataTransfer.files[0]) }}
            onClick={() => document.getElementById('pi').click()}
            title="Click or drop your photo here"
          >
            {!photoSrc && (
              <div style={S.photoPrompt}>
                <span style={{ fontSize: photo.width * 0.10 }}>📷</span>
                <span style={{ ...S.photoText, fontSize: Math.max(10, photo.width * 0.065) }}>
                  Drop or tap to add photo
                </span>
              </div>
            )}
            {photoDrag && <div style={S.dropFlash} />}
          </div>

          {/* Stamp overlay — on top of photo */}
          {stampReady && (
            <img
              src="/confirmed.png"
              alt=""
              draggable={false}
              style={{
                position:        'absolute',
                pointerEvents:   'none',
                userSelect:      'none',
                ...stampDisp,
              }}
            />
          )}

          {/* Name banner */}
          <div style={{ ...S.nameBanner, ...nameBox }}>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Type your name"
              maxLength={45}
              style={{
                ...S.nameInput,
                fontSize:     fontSize,
                borderRadius: NAME_SLOT.r * scale,
              }}
              spellCheck={false}
            />
          </div>
        </div>

        <input id="pi" type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => openCrop(e.target.files[0])} />

        <div style={S.footer}>
          <button
            onClick={handleDownload}
            disabled={working || !flyerReady}
            style={{ ...S.btn, ...(working || !flyerReady ? S.btnOff : {}) }}
          >
            {working ? 'Preparing…' : '⬇  Download My Flyer'}
          </button>
          <p style={S.note}>
            Exports at full resolution (3919 × 3919 px) · Ready for WhatsApp &amp; Instagram
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(150deg, #07101f 0%, #0d1b3e 55%, #1a0b10 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '36px 16px 64px',
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
    boxSizing: 'border-box',
  },
  wrap: {
    width: '100%',
    maxWidth: 580,
    display: 'flex',
    flexDirection: 'column',
  },
  header: { padding: '0 4px 16px' },
  eyebrow: {
    margin: '0 0 6px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: 'rgba(245,200,66,0.55)',
  },
  h1: {
    margin: '0 0 4px',
    fontSize: 24,
    fontWeight: 700,
    color: '#f5c842',
    letterSpacing: '-0.3px',
  },
  sub: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.38)',
    lineHeight: 1.5,
  },
  flyerWrap: {
    position: 'relative',
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
    lineHeight: 0,
  },
  flyerImg: {
    width: '100%',
    height: 'auto',
    display: 'block',
    userSelect: 'none',
    pointerEvents: 'none',
  },
  loading: {
    aspectRatio: '1/1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    background: '#0a0f1e',
  },
  photoSlot: {
    position: 'absolute',
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    transition: 'box-shadow 0.15s',
  },
  photoSlotDrag: {
    boxShadow: '0 0 0 4px #f5c842, 0 0 24px rgba(245,200,66,0.4)',
  },
  photoPrompt: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6%',
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.22)',
    backdropFilter: 'blur(1px)',
  },
  photoText: {
    fontWeight: 600,
    color: '#fff',
    textAlign: 'center',
    padding: '0 10%',
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
    lineHeight: 1.3,
  },
  dropFlash: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(245,200,66,0.2)',
    pointerEvents: 'none',
  },
  nameBanner: {
    position: 'absolute',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    width: '100%',
    height: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#1a1a2e',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontWeight: 700,
    textAlign: 'center',
    cursor: 'text',
    padding: '0 12px',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    caretColor: '#1a1a2e',
    lineHeight: 1,
  },
  footer: {
    padding: '20px 4px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  btn: {
    background: 'linear-gradient(135deg, #b8891e 0%, #f5c842 50%, #b8891e 100%)',
    color: '#07101f',
    border: 'none',
    borderRadius: 12,
    padding: '15px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.2px',
  },
  btnOff: { opacity: 0.4, cursor: 'not-allowed' },
  note: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
    lineHeight: 1.6,
    textAlign: 'center',
  },

  // Crop modal
  cropOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
    boxSizing: 'border-box',
  },
  cropModal: {
    background: '#0d1b3e',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    maxWidth: 548,
  },
  cropTitle: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
  },
  cropZoomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  cropLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    whiteSpace: 'nowrap',
  },
  cropBtns: {
    display: 'flex',
    gap: 12,
  },
  cropCancel: {
    flex: 1,
    padding: '12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
  },
  cropConfirm: {
    flex: 2,
    padding: '12px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #b8891e 0%, #f5c842 50%, #b8891e 100%)',
    color: '#07101f',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
  },
}
