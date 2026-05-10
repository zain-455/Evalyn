import React from 'react';
import { createPortal } from 'react-dom';
import { useEB } from './ExamBuilderContext';

export default function QuestionSelectionModal() {
  const { bankModalVisible, setBankModalVisible, bankModalActive, setBankModalActive, closeBankModal, bankFilterDomain, setBankFilterDomain, bankFilterSubDomain, setBankFilterSubDomain, setBankAppliedDomain, setBankAppliedSubDomain, bankHasFiltered, setBankHasFiltered, bankQuestions, filteredBankQuestions, attachedBankIds, selectedBankQuestionIds, toggleBankQuestion, canEditPool, attachBankQuestionMutation, getDifficultyBadge, getDifficultyColor, selectableFilteredBankQuestionIds, allSelectableFilteredSelected, setSelectedBankQuestionIds, selectableFilteredIdSet, getPrimaryButtonStyle } = useEB();
  return (
    <>
      {bankModalVisible && createPortal(
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeBankModal()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            padding: '2rem',
            opacity: bankModalActive ? 1 : 0,
            transition: 'opacity 160ms ease'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '1100px',
              background: '#333335',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '1.75rem 1.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.15rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Select Questions From Bank
                </div>
                <div style={{ marginTop: '0.35rem', color: '#a0a0a5', fontSize: '0.9rem', lineHeight: 1.4 }}>
                  Pick one or more questions to attach to this exam pool.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', rowGap: '0.85rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '2px', paddingTop: '0.5rem', flexShrink: 0, position: 'relative', zIndex: 2 }}>
                <input
                  type="text"
                  placeholder="Domain"
                  value={bankFilterDomain}
                  onChange={(e) => setBankFilterDomain(e.target.value)}
                  style={{
                    width: '210px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    height: '44px',
                    fontFamily: "'Poppins', sans-serif"
                  }}
                />

                <input
                  type="text"
                  placeholder="Sub-domain"
                  value={bankFilterSubDomain}
                  onChange={(e) => setBankFilterSubDomain(e.target.value)}
                  style={{
                    width: '210px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    height: '44px',
                    fontFamily: "'Poppins', sans-serif"
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    const nextDomain = (bankFilterDomain || '').trim()
                    const nextSubDomain = (bankFilterSubDomain || '').trim()
                    setBankAppliedDomain(nextDomain)
                    setBankAppliedSubDomain(nextSubDomain)
                    setBankHasFiltered(!!(nextDomain || nextSubDomain))
                  }}
                  style={{
                    background: '#d98f30',
                    color: 'white',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '0 1.5rem 2px 1.5rem',
                    height: '44px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'filter 0.2s ease',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem'
                  }}
                  onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5v-2z"/>
                  </svg>
                  Filter
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.75rem', flex: 1, overflowY: 'auto' }}>
              {bankQuestions.length === 0 ? (
                <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.35)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '12px', background: 'rgba(0,0,0,0.15)' }}>
                  No questions available in the bank.
                </div>
              ) : filteredBankQuestions.length === 0 ? (
                <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.35)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '12px', background: 'rgba(0,0,0,0.15)' }}>
                  No results for the current filter.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredBankQuestions.map((q) => {
                    const id = q?.id
                    const isAttached = attachedBankIds.has(id)
                    const isSelected = selectedBankQuestionIds.includes(Number(id))
                    const difficulty = getDifficultyBadge(q)
                    const difficultyColor = getDifficultyColor(difficulty)
                    const questionTypeLabel = (q?.questionType || '').trim()
                    const firstTag = Array.isArray(q?.domainTags)
                      ? q.domainTags.find(t => ((t?.domainName || '').trim() || (t?.subDomain || '').trim()))
                      : null
                    const domainLabel = (firstTag?.domainName || '').trim()
                    const subDomainLabel = (firstTag?.subDomain || '').trim()
                    const domainSubdomainText = (domainLabel && subDomainLabel)
                      ? `${domainLabel} / ${subDomainLabel}`
                      : (domainLabel || subDomainLabel)

                    return (
                      <div
                        key={id}
                        onClick={() => {
                          if (!canEditPool || attachBankQuestionMutation.isPending || isAttached) return
                          toggleBankQuestion(id)
                        }}
                        style={{
                          display: 'flex',
                          padding: '1.25rem 1.25rem 1.75rem 1.25rem',
                          borderRadius: '12px',
                          border: isSelected ? '1px solid rgba(217, 143, 48, 0.5)' : '1px solid rgba(255,255,255,0.05)',
                          background: isSelected ? 'rgba(217, 143, 48, 0.08)' : 'rgba(0, 0, 0, 0.15)',
                          cursor: (!canEditPool || attachBankQuestionMutation.isPending || isAttached) ? 'not-allowed' : 'pointer',
                          opacity: isAttached ? 0.55 : 1,
                          position: 'relative'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                              <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.95rem' }}>#{id}</div>
                              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.18)' }} />
                              
                              {difficulty && (
                                <div style={{ fontSize: '0.92rem', fontWeight: 900, letterSpacing: '0.02em', color: difficultyColor }}>
                                  {difficulty}
                                </div>
                              )}

                              {domainSubdomainText && (
                                <>
                                  <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.14)' }} />
                                  <div
                                    title={domainSubdomainText}
                                    style={{
                                      maxWidth: '280px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      color: 'rgba(255,255,255,0.55)',
                                      fontSize: '0.88rem',
                                      fontWeight: 800,
                                      letterSpacing: '0.01em'
                                    }}
                                  >
                                    {domainSubdomainText}
                                  </div>
                                </>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2px solid ${isSelected ? difficultyColor : 'rgba(255,255,255,0.18)'}`, background: isSelected ? difficultyColor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                {isSelected && (
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginTop: '0.65rem', marginBottom: '0.75rem' }} />

                          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: '1.05rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {q?.questionText}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem 1.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(14px) saturate(1.05)', WebkitBackdropFilter: 'blur(14px) saturate(1.05)', boxShadow: '0 -10px 28px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                  Selected : <span style={{ color: '#ffffff', fontWeight: 900 }}>{selectedBankQuestionIds.length}</span>
                </div>

                {bankHasFiltered && (
                  <>
                    <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.14)' }} />
                    <button
                      type="button"
                      onClick={() => {
                        setBankFilterDomain('')
                        setBankFilterSubDomain('')
                        setBankAppliedDomain('')
                        setBankAppliedSubDomain('')
                        setBankHasFiltered(false)
                      }}
                      style={{
                        background: 'transparent',
                        color: 'rgba(255, 255, 255, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '100px',
                        padding: '0 1.35rem',
                        height: '44px',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)' }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      Clear Filter
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={closeBankModal}
                  disabled={attachBankQuestionMutation.isPending}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '100px',
                    padding: '0.75rem 1.6rem',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    cursor: attachBankQuestionMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: attachBankQuestionMutation.isPending ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!canEditPool || attachBankQuestionMutation.isPending || selectableFilteredBankQuestionIds.length === 0}
                  onClick={() => {
                    if (!canEditPool || attachBankQuestionMutation.isPending) return
                    if (allSelectableFilteredSelected) {
                      setSelectedBankQuestionIds(prev => prev.filter(id => !selectableFilteredIdSet.has(id)))
                      return
                    }

                    const unique = Array.from(new Set(selectableFilteredBankQuestionIds))
                    if (unique.length === 0) return
                    setSelectedBankQuestionIds(unique)
                  }}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '100px',
                    padding: '0.75rem 1.6rem',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    cursor: (!canEditPool || attachBankQuestionMutation.isPending) ? 'not-allowed' : 'pointer',
                    opacity: (!canEditPool || attachBankQuestionMutation.isPending) ? 0.6 : 1,
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseOver={e => { if (canEditPool && !attachBankQuestionMutation.isPending) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {allSelectableFilteredSelected ? 'Deselect All' : 'Select All'}
                </button>

                <button
                  type="button"
                  disabled={!canEditPool || attachBankQuestionMutation.isPending || selectedBankQuestionIds.length === 0}
                  onClick={async () => {
                    if (!canEditPool || attachBankQuestionMutation.isPending || selectedBankQuestionIds.length === 0) return
                    await attachBankQuestionMutation.mutateAsync(selectedBankQuestionIds)
                    setBankModalActive(false)
                    window.setTimeout(() => {
                      setBankModalVisible(false)
                      setSelectedBankQuestionIds([])
                    }, 170)
                  }}
                  style={getPrimaryButtonStyle(canEditPool && !attachBankQuestionMutation.isPending && selectedBankQuestionIds.length > 0)}
                  onMouseOver={e => {
                    if (canEditPool && !attachBankQuestionMutation.isPending && selectedBankQuestionIds.length > 0) e.currentTarget.style.filter = 'brightness(1.1)'
                  }}
                  onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  {attachBankQuestionMutation.isPending ? 'Selecting…' : 'Select'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
