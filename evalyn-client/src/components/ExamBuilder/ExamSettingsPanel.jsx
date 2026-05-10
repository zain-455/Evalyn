import React from 'react';
import { useEB } from './ExamBuilderContext';

export default function ExamSettingsPanel() {
  const { exam, publishEligibleCount, questions, pool, attachedBankQuestions, canEditPool, attachBankQuestionMutation, openBankModal, bankQuestions, detachBankQuestionMutation, poolCardStyle, poolCardSectionTitleStyle, poolCardHelperTextStyle, canEditConstraints, setPoolSettings, poolSettings, poolCardInputStyle, difficultyUi, DIFFICULTY_UI_MAX, DIFFICULTY_UI_MIN, difficultyBalanced, difficultyTouched, setDifficultyUi, setDifficultyTouched, setDifficultyBalanced, clampUi, uiToThetaBand, setMinDifficultyInput, setMaxDifficultyInput, uiWord, DEFAULT_MIN_DIFFICULTY, DEFAULT_MAX_DIFFICULTY, getPrimaryButtonStyle, updatePoolSettingsMutation, poolConstraintsLocked, setPoolConstraintsLocked, minDifficultyInput, maxDifficultyInput } = useEB();
  return (
    <>
      {/* Question Pool & Constraints */}
      <div style={{
        background: '#333335',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '2.5rem',
        marginTop: '1rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1.5rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#ffffff', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {exam?.isAdaptive ? 'QUESTION POOL & CONSTRAINTS' : 'QUESTION POOL'}
          </h3>

          <div style={{ marginLeft: 'auto', color: '#a0a0a5', fontSize: '0.98rem', display: 'flex', gap: '1.25rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <span>
              {exam?.isAdaptive ? 'Eligible questions' : 'Available questions'} : <span style={{ color: '#ffffff', fontWeight: 800 }}>{publishEligibleCount}</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
            <span>Exam questions : <span style={{ color: '#ffffff', fontWeight: 800 }}>{questions.length}</span></span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
            <span>Attached bank questions : <span style={{ color: '#ffffff', fontWeight: 800 }}>{pool?.attachedBankQuestionCount ?? attachedBankQuestions.length}</span></span>
          </div>
        </div>

        {/* REDESIGNED: Attach Questions Header & List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          {/* Top Row: Attach Controls and Header */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '1.5rem',
            alignItems: 'stretch', 
            background: 'rgba(0,0,0,0.15)',
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', minWidth: 0 }}>
                <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
                  Attach Questions
                </div>

                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    disabled={!canEditPool || attachBankQuestionMutation.isPending || bankQuestions.length === 0}
                    onClick={openBankModal}
                    style={getPrimaryButtonStyle(canEditPool && !attachBankQuestionMutation.isPending && bankQuestions.length > 0)}
                    onMouseOver={e => {
                      if (canEditPool && !attachBankQuestionMutation.isPending && bankQuestions.length > 0) e.currentTarget.style.filter = 'brightness(1.1)'
                    }}
                    onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    Select
                  </button>
                </div>
              </div>

              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', whiteSpace: 'nowrap', textAlign: 'right' }}>
                Attached Question List
              </div>
            </div>
          </div>

          {/* List of Attached Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {attachedBankQuestions.length === 0 ? (
              <div style={{ 
                padding: '3rem', 
                textAlign: 'center', 
                background: 'rgba(0, 0, 0, 0.15)', 
                borderRadius: '12px', 
                border: '1px dashed rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.3)',
                fontSize: '0.95rem'
              }}>
                No questions attached from the bank yet.
              </div>
            ) : (
              attachedBankQuestions.map(q => (
                <div key={q.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '1.5rem 2rem',
                  gap: '1.5rem',
                  transition: 'all 0.2s ease',
                  boxShadow: 'none'
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.22)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.15)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; }}
                >
                  <div style={{ minWidth: '160px', color: '#ffffff', fontWeight: 700, fontSize: '1.05rem' }}>
                    Question ID #{q.id}
                  </div>

                  <div style={{
                    width: '1px',
                    alignSelf: 'stretch',
                    background: 'rgba(255,255,255,0.12)',
                    margin: '0 0.5rem'
                  }} />
                  
                  <div style={{ 
                    flex: 1, 
                    color: 'rgba(255,255,255,0.85)', 
                    fontSize: '1rem', 
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {q.questionText}
                  </div>

                  <div style={{
                    width: '1px',
                    alignSelf: 'stretch',
                    background: 'rgba(255,255,255,0.12)',
                    margin: '0 0.5rem'
                  }} />

                  <button
                    type="button"
                    disabled={!canEditPool || detachBankQuestionMutation.isPending}
                    onClick={() => detachBankQuestionMutation.mutateAsync(q.id)}
                    style={getPrimaryButtonStyle(canEditPool && !detachBankQuestionMutation.isPending)}
                    onMouseOver={e => {
                      if (canEditPool && !detachBankQuestionMutation.isPending) e.currentTarget.style.filter = 'brightness(1.1)'
                    }}
                    onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {exam?.isAdaptive && (
        <>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '2.5rem 0 1.5rem 0' }}></div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(280px, 1.1fr) minmax(250px, 1fr)', gap: '1.5rem', alignItems: 'start' }}>

          {/* Column 1: Constraints */}
          <div style={poolCardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem', paddingBottom: '0.9rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Constraints</div>
              <div style={poolCardHelperTextStyle}>Control what types of questions can enter the pool.</div>
            </div>

            <div style={poolCardSectionTitleStyle}>Question Sources</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start', cursor: canEditConstraints ? 'pointer' : 'default' }}>
                <div
                  onClick={() => canEditConstraints && setPoolSettings(ps => ({ ...ps, allowAIGenerated: !ps.allowAIGenerated }))}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    border: `2px solid ${poolSettings.allowAIGenerated ? '#d98f30' : 'rgba(255,255,255,0.18)'}`,
                    background: poolSettings.allowAIGenerated ? '#d98f30' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    cursor: canEditConstraints ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                >
                  {poolSettings.allowAIGenerated && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                  <span style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.2 }}>Allow AI-generated questions</span>
                  <span style={poolCardHelperTextStyle}>Include AI-generated items in the pool.</span>
                </div>
              </label>

              <label style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start', cursor: canEditConstraints ? 'pointer' : 'default' }}>
                <div
                  onClick={() => canEditConstraints && setPoolSettings(ps => ({ ...ps, requireCalibrated: !ps.requireCalibrated }))}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    border: `2px solid ${poolSettings.requireCalibrated ? '#d98f30' : 'rgba(255,255,255,0.18)'}`,
                    background: poolSettings.requireCalibrated ? '#d98f30' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    cursor: canEditConstraints ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                >
                  {poolSettings.requireCalibrated && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                  <span style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.2 }}>Require calibrated questions only</span>
                  <span style={poolCardHelperTextStyle}>Filter the pool to calibrated items only.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Column 2: Difficulty */}
          <div style={poolCardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem', paddingBottom: '0.9rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Difficulty</div>
              <div style={poolCardHelperTextStyle}>Restrict the pool by how easy or hard questions should be.</div>
            </div>

            <div style={poolCardSectionTitleStyle}>Difficulty Range</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Labels Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '0.25rem'
              }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 500 }}>Easier</div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 800 }}>{uiWord(difficultyUi)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', fontWeight: 700 }}> ({difficultyUi}/{DIFFICULTY_UI_MAX})</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 500, textAlign: 'right' }}>Harder</div>
              </div>

              {/* Slider Container */}
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '1.75rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <input
                  type="range"
                  min={DIFFICULTY_UI_MIN}
                  max={DIFFICULTY_UI_MAX}
                  step="1"
                  disabled={!canEditConstraints || difficultyBalanced}
                  className="pool-range"
                  value={difficultyUi}
                  style={{
                    '--p': `${((difficultyUi - DIFFICULTY_UI_MIN) / (DIFFICULTY_UI_MAX - DIFFICULTY_UI_MIN)) * 100}%`
                  }}
                  onChange={(e) => {
                    const next = clampUi(Number(e.target.value))
                    setDifficultyUi(next)
                    setDifficultyTouched(true)
                    setDifficultyBalanced(false)

                    const band = uiToThetaBand(next)
                    setMinDifficultyInput(band.min === DEFAULT_MIN_DIFFICULTY ? '' : String(band.min))
                    setMaxDifficultyInput(band.max === DEFAULT_MAX_DIFFICULTY ? '' : String(band.max))
                  }}
                  aria-label="Difficulty"
                />
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'rgba(255,255,255,0.45)',
                fontSize: '0.78rem',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: '1rem',
                gap: '0.75rem'
              }}>
                {(() => {
                  if (difficultyBalanced) return <span>Full range (Balanced mix)</span>

                  const band = difficultyTouched
                    ? uiToThetaBand(difficultyUi)
                    : {
                        min: Number(poolSettings.minDifficulty ?? DEFAULT_MIN_DIFFICULTY),
                        max: Number(poolSettings.maxDifficulty ?? DEFAULT_MAX_DIFFICULTY)
                      }

                  const fmt = (v) => {
                    const n = Number(v)
                    if (!Number.isFinite(n)) return ''
                    return n.toFixed(2).replace(/\.00$/, '')
                  }

                  return (
                    <span style={{ 
                      fontFamily: "'Poppins', sans-serif", 
                      fontSize: '0.82rem', 
                      fontWeight: 500, 
                      color: 'rgba(255,255,255,0.7)',
                      letterSpacing: '0.01em'
                    }}>
                      Band : ( {fmt(band.min)} to {fmt(band.max)} )
                    </span>
                  )
                })()}

                <button
                  type="button"
                  disabled={!canEditConstraints}
                  onClick={() => {
                    if (!canEditConstraints) return
                    setDifficultyBalanced(prev => {
                      const next = !prev
                      if (next) {
                        setDifficultyTouched(false)
                        setMinDifficultyInput('')
                        setMaxDifficultyInput('')
                        setDifficultyUi(5)
                      } else {
                        const band = uiToThetaBand(difficultyUi)
                        setDifficultyTouched(true)
                        setMinDifficultyInput(band.min === DEFAULT_MIN_DIFFICULTY ? '' : String(band.min))
                        setMaxDifficultyInput(band.max === DEFAULT_MAX_DIFFICULTY ? '' : String(band.max))
                      }
                      return next
                    })
                  }}
                  style={getPrimaryButtonStyle(canEditConstraints)}
                  onMouseOver={e => { if (canEditConstraints) e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  Balance
                </button>
              </div>
            </div>
          </div>

          {/* Column 3: Tagging */}
          <div style={{ ...poolCardStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingBottom: '0.9rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Tagging</div>
              <div style={poolCardHelperTextStyle}>Require specific tags to be present in the pool.</div>
            </div>

            <div>
              <div style={{ ...poolCardSectionTitleStyle, marginBottom: '0.35rem' }}>Required Tag</div>
              <div style={{ ...poolCardHelperTextStyle, marginBottom: '0.75rem' }}>Add a specific domain tag to require:</div>
              <input
                type="text"
                placeholder="Add tags"
                disabled={!canEditConstraints}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    e.preventDefault();
                    const newTag = { domainName: e.target.value.trim(), subDomain: '' };
                    setPoolSettings(ps => ({ ...ps, allowedTags: [...(ps.allowedTags || []), newTag] }));
                    e.target.value = '';
                  }
                }}
                style={poolCardInputStyle}
              />
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1rem', flex: 1 }}>
              <div style={poolCardSectionTitleStyle}>Tags in Use</div>
              <div style={{
                display: 'flex',
                flexWrap: 'nowrap',
                gap: '0.5rem',
                padding: '0.85rem',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0,0,0,0.12)',
                height: '56px',
                alignItems: 'center',
                overflowX: 'auto',
                overflowY: 'hidden'
              }}>
                {(poolSettings.allowedTags || []).length === 0 ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', ...poolCardHelperTextStyle, fontSize: '0.85rem' }}>
                    No tags specified
                  </div>
                ) : (
                  (poolSettings.allowedTags || []).map((t, i) => (
                    <div key={i} style={{
                      background: 'rgba(217, 143, 48, 0.14)',
                      border: '1px solid rgba(217, 143, 48, 0.35)',
                      borderRadius: '100px',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.8rem',
                      color: 'rgba(255,255,255,0.92)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexShrink: 0
                    }}>
                      {t.domainName} {t.subDomain && `- ${t.subDomain}`}
                      <span
                        onClick={() => {
                          if (canEditConstraints) setPoolSettings(ps => ({ ...ps, allowedTags: ps.allowedTags.filter((_, idx) => idx !== i) }))
                        }}
                        style={{
                          cursor: canEditConstraints ? 'pointer' : 'default',
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: '1rem',
                          lineHeight: '1',
                          opacity: canEditConstraints ? 1 : 0.5
                        }}
                      >×</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Separator and Bottom Bar */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1.75rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#a0a0a5', fontSize: '1.05rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Max Question Count:</span>
              <span style={{ color: '#ffffff', fontWeight: 900 }}>{exam?.maxQuestions || 10}</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.15)' }}>|</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Min Time:</span>
              <span style={{ color: '#ffffff', fontWeight: 900 }}>
                {typeof exam?.durationMinutes === 'number' && Number.isFinite(exam.durationMinutes)
                  ? `${exam.durationMinutes} mins`
                  : 'N/A'}
              </span>
            </div>
          </div>
          
          <button
            type="button"
            disabled={!canEditPool || updatePoolSettingsMutation.isPending}
            onClick={() => {
              if (!canEditPool || updatePoolSettingsMutation.isPending) return

              if (poolConstraintsLocked) {
                setPoolConstraintsLocked(false)
                return
              }

              const clamp = (value) => Math.max(DEFAULT_MIN_DIFFICULTY, Math.min(DEFAULT_MAX_DIFFICULTY, value))
              const parseOrDefault = (raw, fallback) => {
                if (raw == null) return fallback
                const trimmed = String(raw).trim()
                if (!trimmed) return fallback
                const n = Number(trimmed)
                return Number.isFinite(n) ? n : fallback
              }

              const minDifficulty = clamp(parseOrDefault(minDifficultyInput, DEFAULT_MIN_DIFFICULTY))
              const maxDifficulty = clamp(parseOrDefault(maxDifficultyInput, DEFAULT_MAX_DIFFICULTY))

              const payload = {
                allowAIGenerated: !!poolSettings.allowAIGenerated,
                requireCalibrated: !!poolSettings.requireCalibrated,
                minDifficulty,
                maxDifficulty,
                allowedTags: (poolSettings.allowedTags || []).filter(t => (t.domainName || '').trim())
              }
              updatePoolSettingsMutation.mutateAsync(payload)
            }}
            style={getPrimaryButtonStyle(canEditPool && !updatePoolSettingsMutation.isPending)}
            onMouseOver={e => { if (canEditPool && !updatePoolSettingsMutation.isPending) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
          >
            {updatePoolSettingsMutation.isPending
              ? 'Saving…'
              : (poolConstraintsLocked ? 'Edit Saved Constraints' : 'Save Constraints')}
          </button>
        </div>

        </>
        )}
      </div>
    </>
  );
}
