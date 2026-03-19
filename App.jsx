import { useState, useRef, useCallback } from 'react'
import styles from './App.module.css'

/* ── helpers ─────────────────────────────────────────── */
let _uid = 0
const uid = () => ++_uid
const fmt2 = n => (isNaN(n) ? '' : parseFloat(n).toFixed(2).replace('.', ','))
const parseOdd = s => parseFloat(String(s).replace(',', '.'))
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* ── MatchCard ───────────────────────────────────────── */
function MatchCard ({ match, index, onChange, onRemove }) {
  const { id, t1, t2, o1, o2, o3, imported: imp } = match
  const upd = (field, val) => onChange(id, { ...match, [field]: val })

  const handleOddKey = (e, num) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const next = num < 3
      ? document.getElementById(`odd${num + 1}-${id}`)
      : null
    next?.focus()
  }

  const sanitize = val => {
    let v = val.replace(/[^0-9.,]/g, '')
    const parts = v.replace(',', '.').split('.')
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('')
    return v
  }

  const l1 = t1 ? `Victoire ${t1}` : 'Victoire Équipe 1'
  const l3 = t2 ? `Victoire ${t2}` : 'Victoire Équipe 2'

  return (
    <div className={`${styles.card} ${imp ? styles.cardImp : ''}`}>
      <div className={styles.cardHdr}>
        <span className={styles.cardNum}>
          Match {index + 1}
          {imp && <span className={styles.impBadge}>📷 Importé</span>}
        </span>
        <button className={styles.btnRm} onClick={() => onRemove(id)}>✕ Supprimer</button>
      </div>
      <div className={styles.teams}>
        <input className={styles.teamIn} placeholder="Équipe 1" value={t1}
          onChange={e => upd('t1', e.target.value)} />
        <span className={styles.vs}>VS</span>
        <input className={styles.teamIn} placeholder="Équipe 2" value={t2}
          onChange={e => upd('t2', e.target.value)} />
      </div>
      <div className={styles.oddsRow}>
        {[['o1', l1, 1], ['o2', 'Match Nul', 2], ['o3', l3, 3]].map(([field, label, num]) => (
          <div className={styles.oddCell} key={field}>
            <div className={styles.oddLbl} title={label}>{label}</div>
            <input
              id={`odd${num}-${id}`}
              className={styles.oddIn}
              placeholder="0,00"
              value={match[field]}
              onChange={e => upd(field, sanitize(e.target.value))}
              onKeyDown={e => handleOddKey(e, num)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── ImageThumb ─────────────────────────────────────── */
function ImageThumb ({ src, name, onRemove }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img src={src} alt={name}
        style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid #2e3450', display: 'block' }} />
      <button onClick={onRemove}
        style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#e8213a', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, lineHeight: 1 }}>
        ✕
      </button>
    </div>
  )
}

/* ── App ─────────────────────────────────────────────── */
export default function App () {
  const [fb, setFb] = useState('')
  const [matches, setMatches] = useState([
    { id: uid(), t1: '', t2: '', o1: '', o2: '', o3: '', imported: false },
    { id: uid(), t1: '', t2: '', o1: '', o2: '', o3: '', imported: false },
    { id: uid(), t1: '', t2: '', o1: '', o2: '', o3: '', imported: false },
  ])
  const [images, setImages] = useState([]) // [{src, data, mediaType, name}]
  const [drag, setDrag] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [importStatus, setImportStatus] = useState({ msg: '', cls: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef()

  /* ── image loading ── */
  const loadFile = file => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const src = e.target.result
      const data = src.split(',')[1]
      setImages(imgs => [...imgs, { src, data, mediaType: file.type || 'image/jpeg', name: file.name }])
      setImportStatus({ msg: `${images.length + 1} image(s) prête(s). Ajoutez-en d'autres ou lancez l'analyse.`, cls: '' })
    }
    reader.readAsDataURL(file)
  }

  const loadFiles = files => Array.from(files).forEach(loadFile)

  const removeImage = idx => {
    setImages(imgs => {
      const next = imgs.filter((_, i) => i !== idx)
      if (next.length === 0) setImportStatus({ msg: '', cls: '' })
      else setImportStatus({ msg: `${next.length} image(s) prête(s).`, cls: '' })
      return next
    })
  }

  /* ── analyze ── */
  const analyze = async () => {
    if (images.length === 0) return
    setAnalyzing(true)
    setImportStatus({ msg: `Analyse de ${images.length} capture(s) en cours…`, cls: '' })

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images.map(img => ({ data: img.data, mediaType: img.mediaType }))
        })
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      const found = json.matches
      if (!Array.isArray(found) || found.length === 0) {
        setImportStatus({ msg: 'Aucun match détecté. Vérifiez que les captures contiennent des matchs avec cotes.', cls: 'err' })
      } else {
        found.forEach(m => addMatch({
          t1: m.team1 || '', t2: m.team2 || '',
          o1: m.odd1, o2: m.odd2, o3: m.odd3, imported: true
        }))
        setImportStatus({
          msg: `✓ ${found.length} match${found.length > 1 ? 's' : ''} importé${found.length > 1 ? 's' : ''} depuis ${images.length} capture${images.length > 1 ? 's' : ''} !`,
          cls: 'ok'
        })
      }
    } catch (e) {
      setImportStatus({ msg: 'Erreur : ' + e.message, cls: 'err' })
    }
    setAnalyzing(false)
  }

  /* ── match management ── */
  const addMatch = (data = {}) => {
    setMatches(ms => [...ms, {
      id: uid(),
      t1: data.t1 || '', t2: data.t2 || '',
      o1: data.o1 != null ? fmt2(data.o1) : '',
      o2: data.o2 != null ? fmt2(data.o2) : '',
      o3: data.o3 != null ? fmt2(data.o3) : '',
      imported: data.imported || false
    }])
  }
  const updateMatch = (id, updated) => setMatches(ms => ms.map(m => m.id === id ? updated : m))
  const removeMatch = id => setMatches(ms => ms.filter(m => m.id !== id))

  /* ── calculation ── */
  const calcRate = (m1, m2, m3) => {
    let sum = 0
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      const c = m1.odds[i] * m2.odds[j] * m3.odds[k]
      if (c <= 1) return 0
      sum += 1 / (c - 1)
    }
    return sum === 0 ? 0 : 1 / sum
  }

  const calculate = () => {
    setError(''); setResult(null)
    const fbVal = parseFloat(String(fb).replace(',', '.'))
    if (!fbVal || fbVal <= 0) { setError('Veuillez entrer un montant de FreeBets valide.'); return }
    if (matches.length < 3) { setError('Veuillez ajouter au moins 3 matchs.'); return }

    const parsed = matches.map(m => ({
      ...m, odds: [parseOdd(m.o1), parseOdd(m.o2), parseOdd(m.o3)]
    }))

    for (const m of parsed) {
      for (const o of m.odds) {
        if (isNaN(o) || o <= 1) {
          setError(`Côtes invalides pour "${m.t1 || '?'} vs ${m.t2 || '?'}" (doivent être > 1).`)
          return
        }
      }
    }

    let bestRate = 0, bestTriple = null
    for (let a = 0; a < parsed.length - 2; a++)
      for (let b = a + 1; b < parsed.length - 1; b++)
        for (let c = b + 1; c < parsed.length; c++) {
          const r = calcRate(parsed[a], parsed[b], parsed[c])
          if (r > bestRate) { bestRate = r; bestTriple = [parsed[a], parsed[b], parsed[c]] }
        }

    if (!bestTriple || bestRate === 0) { setError('Impossible de calculer. Vérifiez que toutes les côtes sont > 1.'); return }
    setResult({ triple: bestTriple, rate: bestRate, fb: fbVal, G: fbVal * bestRate })
  }

  /* ── table rows ── */
  const renderRows = () => {
    if (!result) return null
    const { triple: [m1, m2, m3], G } = result
    const lbl = [
      [`Victoire ${m1.t1 || 'Éq.1'}`, 'Match Nul', `Victoire ${m1.t2 || 'Éq.2'}`],
      [`Victoire ${m2.t1 || 'Éq.1'}`, 'Match Nul', `Victoire ${m2.t2 || 'Éq.2'}`],
      [`Victoire ${m3.t1 || 'Éq.1'}`, 'Match Nul', `Victoire ${m3.t2 || 'Éq.2'}`],
    ]
    const rows = []; let n = 1, totalFB = 0
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      const cote = m1.odds[i] * m2.odds[j] * m3.odds[k]
      const mise = G / (cote - 1)
      totalFB += mise
      rows.push(
        <tr key={n}>
          <td className={styles.tm}>{n++}</td>
          <td style={{ fontSize: '.83rem', lineHeight: 1.4 }}><strong>{lbl[0][i]} · {lbl[1][j]} · {lbl[2][k]}</strong></td>
          <td className={styles.tc}>{cote.toFixed(2)}</td>
          <td className={styles.tf}>{mise.toFixed(2)} FB</td>
          <td className={styles.tg}>{G.toFixed(2)} €</td>
        </tr>
      )
    }
    rows.push(
      <tr key="total" style={{ background: 'rgba(245,200,66,.05)' }}>
        <td colSpan={3} className={styles.tFootLbl}>Total FB utilisés</td>
        <td className={styles.tf} style={{ color: '#f5c842' }}>{totalFB.toFixed(2)} FB</td>
        <td />
      </tr>
    )
    return rows
  }

  /* ── render ── */
  return (
    <div>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>FreeBet Converter</div>
        <div className={styles.subtitle}>Optimisation de conversion FB → €</div>
      </header>

      <div className={styles.wrap}>

        {/* FB amount */}
        <div className={styles.fbRow}>
          <div className={styles.fbLbl}>Montant à convertir <span>FreeBets</span></div>
          <div className={styles.fbWrap}>
            <input className={styles.fbInput} type="number" placeholder="Ex : 170" min="0" step="any"
              value={fb} onChange={e => setFb(e.target.value)} />
          </div>
        </div>

        {/* Import */}
        <div className={styles.importBox}>
          <div className={styles.importTitle}>📷 Import par captures d'écran</div>

          {/* Drop zone */}
          <div
            className={`${styles.drop} ${drag ? styles.dropDrag : ''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); loadFiles(e.dataTransfer.files) }}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => { loadFiles(e.target.files); e.target.value = '' }} />
            <div className={styles.dropIcon}>📲</div>
            <div className={styles.dropText}>
              <strong>Glissez vos captures d'écran</strong> ou cliquez pour sélectionner<br />
              <span style={{ fontSize: '.8rem', marginTop: 4, display: 'inline-block' }}>
                Plusieurs captures acceptées simultanément — tous les matchs sont détectés en un seul clic
              </span>
            </div>
          </div>

          {/* Thumbnails */}
          {images.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                {images.map((img, i) => (
                  <ImageThumb key={i} src={img.src} name={img.name} onRemove={() => removeImage(i)} />
                ))}
                {/* Add more button */}
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: 70, height: 70, borderRadius: 8, border: '2px dashed #2e3450',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#3b8ef0', fontSize: 24, fontWeight: 700,
                    transition: 'border-color .2s'
                  }}
                  title="Ajouter d'autres captures"
                >+</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button className={styles.btnAnalyze} onClick={analyze} disabled={analyzing}>
                  {analyzing && <span className={styles.spinner} />}
                  {analyzing
                    ? `Analyse de ${images.length} capture${images.length > 1 ? 's' : ''}…`
                    : `✦ Analyser ${images.length} capture${images.length > 1 ? 's' : ''} et importer les matchs`}
                </button>
                <div className={`${styles.importStatus} ${importStatus.cls === 'ok' ? styles.statusOk : importStatus.cls === 'err' ? styles.statusErr : ''}`}>
                  {importStatus.msg}
                </div>
              </div>
            </div>
          )}

          {images.length === 0 && importStatus.msg && (
            <div className={`${styles.importStatus} ${importStatus.cls === 'ok' ? styles.statusOk : importStatus.cls === 'err' ? styles.statusErr : ''}`} style={{ marginTop: 10 }}>
              {importStatus.msg}
            </div>
          )}
        </div>

        {/* Matches list */}
        <div className={styles.matchesHdr}>
          <div className={styles.stitle}>Matchs disponibles</div>
          <button className={styles.btnAdd} onClick={() => addMatch()}>+ Ajouter un match</button>
        </div>

        {matches.map((m, idx) => (
          <MatchCard key={m.id} match={m} index={idx} onChange={updateMatch} onRemove={removeMatch} />
        ))}

        {/* Calc */}
        <div className={styles.calcSection}>
          <button className={styles.btnCalc} onClick={calculate}>⚡ Calculer la meilleure conversion</button>
          {error && <div className={styles.errMsg}>{error}</div>}
        </div>

        {/* Results */}
        {result && (
          <div className={styles.results}>
            <div className={styles.banner}>
              <div className={styles.bannerLbl}>🏆 Taux de conversion optimal</div>
              <div className={styles.rate}>{(result.rate * 100).toFixed(2)}<span>%</span></div>
              <div className={styles.matchNames}>
                {result.triple.map(m => `${m.t1 || 'Éq.1'} vs ${m.t2 || 'Éq.2'}`).join('  ·  ')}
              </div>
              <div className={styles.euros}>
                Gain garanti : {result.G.toFixed(2)} € pour {result.fb} FB misés
              </div>
            </div>

            <div className={styles.stitle} style={{ marginBottom: 13 }}>Meilleure combinaison de matchs</div>
            <div className={styles.best3}>
              {result.triple.map((m, i) => (
                <div className={styles.bestCard} key={i}>
                  <div className={styles.bestLbl}>Match {i + 1}</div>
                  <div className={styles.bestTeams}>
                    {m.t1 || 'Équipe 1'}<br />
                    <span style={{ color: '#7a84a0', fontSize: '.78rem' }}>vs</span><br />
                    {m.t2 || 'Équipe 2'}
                  </div>
                  <div className={styles.bestOdds}>
                    {m.odds.map((o, j) => <span className={styles.pill} key={j}>{o.toFixed(2)}</span>)}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.tblTitle}>📋 Détail des 27 paris à placer</div>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>#</th><th>Issue combinée</th><th>Côte combinée</th><th>Mise (FB)</th><th>Gain garanti (€)</th>
                </tr>
              </thead>
              <tbody>{renderRows()}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
