'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

// ── Source-image slot coordinates (on 3919×3919 flyer) ──────────────────────
const FLYER_SRC  = 3919
const PHOTO_SLOT = { x: 1595, y: 470,  w: 1270, h: 1210, r: 110 }
const NAME_SLOT  = { x: 1595, y: 1730, w: 1270, h: 205,  r: 100 }

// ── Canvas download helpers ──────────────────────────────────────────────────
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

function drawCover(ctx, img, x, y, w, h) {
  const ir = img.naturalWidth / img.naturalHeight
  const sr = w / h
  let sx, sy, sw, sh
  if (ir > sr) {
    sh = img.naturalHeight; sw = sh * sr; sx = (img.naturalWidth - sw) / 2; sy = 0
  } else {
    sw = img.naturalWidth; sh = sw / sr; sx = 0; sy = (img.naturalHeight - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Home() {
  const flyerRef     = useRef(null)
  const photoRef     = useRef(null)
  const dlCanvas     = useRef(null)
  const containerRef = useRef(null)
  const inputRef     = useRef(null)

  const [flyerReady, setFlyerReady] = useState(false)
  const [photoSrc,   setPhotoSrc]   = useState(null)
  const [name,       setName]       = useState('')
  const [photoDrag,  setPhotoDrag]  = useState(false)
  const [working,    setWorking]    = useState(false)
  const [scale,      setScale]      = useState(1)
  const [fontSize,   setFontSize]   = useState(18)

  // ── Measure container → overlay scale ────────────────────────────────────
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

  // ── Load flyer ────────────────────────────────────────────────────────────
  useEffect(() => {
    const img = new Image()
    img.src = '/flyer.jpg'
    img.onload = () => { flyerRef.current = img; setFlyerReady(true) }
  }, [])

  // ── Auto-shrink name font ─────────────────────────────────────────────────
  useEffect(() => {
    if (!inputRef.current || scale === 0) return
    const maxW = NAME_SLOT.w * scale - 24
    const el   = inputRef.current
    let fs = Math.round(NAME_SLOT.h * scale * 0.52)
    el.style.fontSize = fs + 'px'
    while (el.scrollWidth > maxW && fs > 9) {
      fs -= 1
      el.style.fontSize = fs + 'px'
    }
    setFontSize(fs)
  }, [name, scale])

  // ── Load photo ────────────────────────────────────────────────────────────
  function loadPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { photoRef.current = img; setPhotoSrc(url) }
    img.src = url
  }

  // ── Download ──────────────────────────────────────────────────────────────
  function handleDownload() {
    setWorking(true)
    const canvas = dlCanvas.current
    canvas.width  = FLYER_SRC
    canvas.height = FLYER_SRC
    const ctx = canvas.getContext('2d')

    ctx.drawImage(flyerRef.current, 0, 0, FLYER_SRC, FLYER_SRC)

    if (photoRef.current) {
      ctx.save()
      roundedClip(ctx, PHOTO_SLOT)
      ctx.clip()
      drawCover(ctx, photoRef.current, PHOTO_SLOT.x, PHOTO_SLOT.y, PHOTO_SLOT.w, PHOTO_SLOT.h)
      ctx.restore()
    }

    const label = name.trim()
    if (label) {
      ctx.save()
      roundedClip(ctx, NAME_SLOT)
      ctx.clip()
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      let fs = Math.round(NAME_SLOT.h * 0.52)
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

  // ── Overlay positions in display px ──────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <canvas ref={dlCanvas} style={{ display: 'none' }} />

      <div style={S.wrap}>

        <div style={S.header}>
          <p style={S.eyebrow}>Glory Life Choir · Bariga Division</p>
          <h1 style={S.h1}>Personalise Your Flyer</h1>
          <p style={S.sub}>Drop your photo directly onto the frame · tap the name banner to type</p>
        </div>

        {/* ── Flyer with interactive overlays ── */}
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
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : {}),
            }}
            onDragOver={e => { e.preventDefault(); setPhotoDrag(true) }}
            onDragLeave={() => setPhotoDrag(false)}
            onDrop={e => { e.preventDefault(); setPhotoDrag(false); loadPhoto(e.dataTransfer.files[0]) }}
            onClick={() => document.getElementById('pi').click()}
            title="Click or drop your photo here"
          >
            {!photoSrc && (
              <div style={S.photoPrompt}>
                <span style={{ fontSize: photo.width * 0.12 }}>📷</span>
                <span style={{ ...S.photoText, fontSize: photo.width * 0.068 }}>
                  Drop or tap to add photo
                </span>
              </div>
            )}
            {photoDrag && <div style={S.dropFlash} />}
          </div>

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
                fontSize: fontSize,
                borderRadius: NAME_SLOT.r * scale,
              }}
              spellCheck={false}
            />
          </div>

        </div>

        <input id="pi" type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => loadPhoto(e.target.files[0])} />

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
    gap: 0,
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
    aspectRatio: '1 / 1',
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
    background: 'rgba(0,0,0,0.28)',
    backdropFilter: 'blur(1px)',
  },
  photoText: {
    fontWeight: 600,
    color: '#fff',
    textAlign: 'center',
    padding: '0 10%',
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
    letterSpacing: '0.2px',
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
}
