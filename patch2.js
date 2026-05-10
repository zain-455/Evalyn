const fs = require('fs');
const file = 'evalyn-client/src/pages/instructor/CreateExam.jsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /<div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>[\s\S]*?Questions scale to ability\.<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1\.5rem', marginTop: '1rem', paddingTop: '2rem', borderTop: '1px solid rgba\(255,255,255,0\.05\)' }}>/;

const str =               <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label className="form-label" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.75rem', display: 'block' }}>Assessment Engine</label>
                <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>       
                  <div
                    onClick={() => setIsAdaptive(false)}
                    style={{
                      padding: '1.25rem 1rem',
                      background: !isAdaptive ? 'transparent' : 'rgba(0, 0, 0, 0.2)',
                      border: !isAdaptive ? '1.5px solid rgba(196, 140, 52, 0.6)' : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: !isAdaptive ? '0 0 15px rgba(196, 140, 52, 0.25)' : 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      height: '100%',
                      flex: 1
                    }}
                  >
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%',       
                      border: !isAdaptive ? '2px solid #cba072' : '2px solid rgba(255,255,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {!isAdaptive && <div style={{ width: '8px', height: '8px', background: '#cba072', borderRadius: '50%' }} />}
                    </div>
                    <div>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>Standard Linear</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '0.4rem', lineHeight: '1.4' }}>Fixed sequence of questions.</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setIsAdaptive(true)}
                    style={{
                      padding: '1.25rem 1rem',
                      background: isAdaptive ? 'transparent' : 'rgba(0, 0, 0, 0.2)',
                      border: isAdaptive ? '1.5px solid rgba(196, 140, 52, 0.6)' : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: isAdaptive ? '0 0 15px rgba(196, 140, 52, 0.25)' : 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      height: '100%',
                      flex: 1
                    }}
                  >
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%',       
                      border: isAdaptive ? '2px solid #cba072' : '2px solid rgba(255,255,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isAdaptive && <div style={{ width: '8px', height: '8px', background: '#cba072', borderRadius: '50%' }} />}
                    </div>
                    <div>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>Adaptive Engine</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '0.4rem', lineHeight: '1.4' }}>Questions scale to ability.</div>
                    </div>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '1rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)' }};

code = code.replace(regex, str);
fs.writeFileSync(file, code);
console.log('done replacing');
