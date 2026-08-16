'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

const FLYER_SIZE = 3919

const PHOTO_SLOT = { x: 1595, y: 470, w: 1270, h: 1210, radius: 110 }
const NAME_SLOT  = { x: 1595, y: 1730, w: 1270, h: 205, radius: 100 }

const NAME_FONT_SIZE   = 96
const NAME_FONT_FAMILY = 'Georgia, "Times New Roman", serif'
const NAME_COLOR       = '#1a1a2e'

function roundedClip(ctx, x, y, w, h, r) {
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

function drawImageCover(ctx, img, x, y, w, h) {
  const ir = img.naturalWidth / img.naturalHeight
  const sr = w / h
  let sx, sy, sw, sh
  if (ir > sr) {
    sh = img.naturalHeight; sw = sh * sr
    sx = (img.naturalWidth - sw) / 2; sy = 0
  } else {
    sw = img.naturalWidth; sh = sw / sr
    sx = 0; sy = (img.naturalHeight - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

export default function Home() {
  const canvasRef = useRef(null)
  const flyerRef  = useRef(null)
  const photoRef  = useRef(null)

  const [name,       setName]       = useState('')
  const [photoSrc,   setPhotoSrc]   = useState(null)
  const [flyerReady, setFlyerReady] = useState(false)
  const [dragOver,   setDragOver]   = useState(false)
  const [working,    setWorking]    = useState(false)

  useEffect(() => {
    const img = new Image()
    img.src = '/flyer.jpg'
    img.onload = () => { flyerRef.current = img; setFlyerReady(true) }
  }, [])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !flyerRef.current) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, FLYER_SIZE, FLYER_SIZE)
    ctx.drawImage(flyerRef.current, 0, 0, FLYER_SIZE, FLYER_SIZE)

    if (photoRef.current) {
      ctx.save()
      roundedClip(ctx, PHOTO_SLOT.x, PHOTO_SLOT.y, PHOTO_SLOT.w, PHOTO_SLOT.h, PHOTO_SLOT.radius)
      ctx.clip()
      drawImageCover(ctx, photoRef.current, PHOTO_SLOT.x, PHOTO_SLOT.y, PHOTO_SLOT.w, PHOTO_SLOT.h)
      ctx.restore()
    }

    const label = name.trim()
    if (label) {
      ctx.save()
      roundedClip(ctx, NAME_SLOT.x, NAME_SLOT.y, NAME_SLOT.w, NAME_SLOT.h, NAME_SLOT.radius)
      ctx.clip()
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      let fs = NAME_FONT_SIZE
      ctx.font = `bold ${fs}px ${NAME_FONT_FAMILY}`
      while (ctx.measureText(label).width > NAME_SLOT.w - 80 && fs > 36) {
        fs -= 4
        ctx.font = `bold ${fs}px ${NAME_FONT_FAMILY}`
      }
      ctx.fillStyle  = NAME_COLOR
      ctx.textAlign  = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, NAME_SLOT.x + NAME_SLOT.w / 2, NAME_SLOT.y + NAME_SLOT.h / 2)
      ctx.restore()
    }
  }, [name])

  useEffect(() => { if (flyerReady) render() }, [flyerReady, render])

  function loadPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { photoRef.current = img; setPhotoSrc(url); render() }
    img.src = url
  }

  function handleDownload() {
    setWorking(true)
    render()
    setTimeout(() => {
      canvasRef.current.toBlob(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `gratitude-concert-${(name || 'flyer').replace(/\s+/g, '-').toLowerCase()}.jpg`
        a.click()
        setWorking(false)
      }, 'image/jpeg', 0.95)
    }, 120)
  }

  const PREV = 460

  return (
    <div style={S.page}>
      <div style={S.card}>

        <div style={S.header}>
          <p style={S.eyebrow}>Glory Life Choir · Bariga Division</p>
          <h1 style={S.h1}>Personalise Your Flyer</h1>
          <p style={S.sub}>Gratitude: A Mega Praise Concert — Season 17</p>
        </div>

        <div style={S.preview}>
          <canvas
            ref={canvasRef}
            width={FLYER_SIZE}
            height={FLYER_SIZE}
            style={{ width: PREV, height: PREV, borderRadius: 10, display: 'block' }}
          />
          {!flyerReady && <div style={S.overlay}>Loading…</div>}
        </div>

        <div style={S.body}>

          <div style={S.field}>
            <label style={S.label}>Your Photo</label>
            <div
              style={{ ...S.drop, ...(dragOver ? S.dropActive : {}) }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); loadPhoto(e.dataTransfer.files[0]) }}
              onClick={() => document.getElementById('pi').click()}
            >
              {photoSrc
                ? <img src={photoSrc} alt="" style={S.thumb} />
                : <div style={S.dropInner}>
                    <span style={{ fontSize: 30 }}>📷</span>
                    <span style={S.dropText}>Click or drag your photo here</span>
                    <span style={S.dropHint}>Portrait photos work best</span>
                  </div>
              }
            </div>
            <input id="pi" type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => loadPhoto(e.target.files[0])} />
          </div>

          <div style={S.field}>
            <label style={S.label} htmlFor="ni">Your Name</label>
            <input
              id="ni"
              type="text"
              placeholder="e.g. Adaeze Okonkwo"
              value={name}
              maxLength={40}
              onChange={e => setName(e.target.value)}
              style={S.input}
            />
          </div>

          <button
            onClick={handleDownload}
            disabled={working || !flyerReady}
            style={{ ...S.btn, ...(working || !flyerReady ? S.btnOff : {}) }}
          >
            {working ? 'Preparing…' : '⬇  Download My Flyer'}
          </button>

          <p style={S.note}>
            Downloads as a high-resolution JPEG (3919 × 3919 px) — perfect for WhatsApp and social media.
          </p>

        </div>
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(150deg, #07101f 0%, #0d1b3e 55%, #1a0b10 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '36px 16px 64px',
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 540,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    padding: '28px 28px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  eyebrow: {
    margin: '0 0 6px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: 'rgba(245,200,66,0.6)',
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
    color: 'rgba(255,255,255,0.4)',
  },
  preview: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    padding: '20px 28px',
    background: 'rgba(0,0,0,0.25)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    background: 'rgba(0,0,0,0.4)',
  },
  body: {
    padding: '24px 28px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  drop: {
    border: '2px dashed rgba(245,200,66,0.3)',
    borderRadius: 12,
    minHeight: 96,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
    transition: 'border-color .2s, background .2s',
  },
  dropActive: {
    borderColor: '#f5c842',
    background: 'rgba(245,200,66,0.05)',
  },
  dropInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    padding: '16px 0',
  },
  dropText: { fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: 500 },
  dropHint: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  thumb: { width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '2px solid rgba(245,200,66,0.4)' },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '13px 15px',
    fontSize: 15,
    color: '#fff',
    fontFamily: 'inherit',
    outline: 'none',
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
    marginTop: 4,
  },
  btnOff: { opacity: 0.45, cursor: 'not-allowed' },
  note: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    lineHeight: 1.6,
    textAlign: 'center',
  },
}
