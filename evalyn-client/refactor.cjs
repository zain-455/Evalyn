const fs = require('fs');

const srcCode = fs.readFileSync('src/pages/instructor/ExamBuilder.original.jsx', 'utf8');

const modalStartTag = '{bankModalVisible && createPortal(';
const modalEndTag = "document.body\n      )}";

const settingsStartTag = '{/* Question Pool & Constraints */}';
const settingsEndTag = '{/* Question List */}';

const listStartTag = '{/* Question List */}';
const listEndTag = '    </div>\n  )\n}';

const mStart = srcCode.indexOf(modalStartTag);
const mEnd = srcCode.indexOf(modalEndTag) + modalEndTag.length;
const modalJSX = srcCode.substring(mStart, mEnd);

const pStart = srcCode.indexOf(settingsStartTag);
const pEnd = srcCode.indexOf(settingsEndTag);
const panelJSX = srcCode.substring(pStart, pEnd).trim();

const lStart = srcCode.indexOf(listStartTag);
const lEnd = srcCode.lastIndexOf(listEndTag);
let listJSX = srcCode.substring(lStart, lEnd).trim();
if (listJSX.endsWith('    </div>')) {
  listJSX = listJSX.substring(0, listJSX.lastIndexOf('    </div>')).trim();
}

// Write the files
fs.writeFileSync('src/components/ExamBuilder/QuestionSelectionModal.jsx',
`import React from 'react';\nimport { createPortal } from 'react-dom';\nimport { useEB } from './ExamBuilderContext';\n\nexport default function QuestionSelectionModal() {\n  const { bankModalVisible, bankModalActive, closeBankModal, bankFilterDomain, setBankFilterDomain, bankFilterSubDomain, setBankFilterSubDomain, setBankAppliedDomain, setBankAppliedSubDomain, setBankHasFiltered, bankQuestions, filteredBankQuestions, attachedBankIds, selectedBankQuestionIds, toggleBankQuestion, canEditPool, attachBankQuestionMutation, getDifficultyBadge, getDifficultyColor, bankHasFiltered, selectableFilteredBankQuestionIds, allSelectableFilteredSelected, setSelectedBankQuestionIds, selectableFilteredIdSet, getPrimaryButtonStyle } = useEB();\n  return (\n    <>\n      {${modalJSX}}\n    </>\n  );\n}\n`);

fs.writeFileSync('src/components/ExamBuilder/ExamSettingsPanel.jsx',
`import React from 'react';\nimport { useEB } from './ExamBuilderContext';\n\nexport default function ExamSettingsPanel() {\n  const { exam, publishEligibleCount, questions, pool, attachedBankQuestions, canEditPool, attachBankQuestionMutation, openBankModal, bankQuestions, detachBankQuestionMutation, poolCardStyle, poolCardSectionTitleStyle, poolCardHelperTextStyle, canEditConstraints, setPoolSettings, poolSettings, poolCardInputStyle, difficultyUi, DIFFICULTY_UI_MAX, DIFFICULTY_UI_MIN, difficultyBalanced, setDifficultyUi, setDifficultyTouched, setDifficultyBalanced, clampUi, uiToThetaBand, setMinDifficultyInput, setMaxDifficultyInput, uiWord, DEFAULT_MIN_DIFFICULTY, DEFAULT_MAX_DIFFICULTY, getPrimaryButtonStyle, updatePoolSettingsMutation, poolConstraintsLocked, setPoolConstraintsLocked, minDifficultyInput, maxDifficultyInput } = useEB();\n  return (\n    <>\n      ${panelJSX}\n    </>\n  );\n}\n`);

fs.writeFileSync('src/components/ExamBuilder/SelectedQuestionList.jsx',
`import React from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { useEB } from './ExamBuilderContext';\n\nexport default function SelectedQuestionList() {\n  const navigate = useNavigate();\n  const { exam, examId, questions, deleteQuestion } = useEB();\n  return (\n    <>\n      ${listJSX}\n    </>\n  );\n}\n`);

// Update ExamBuilder parent
const topLogic = srcCode.substring(0, srcCode.indexOf('  return (\n    <div className="fade-in"'));
const varRegex = /(?:const|let|var)\s+(?:\[(.*?)\]|(\w+))\s*=/g;
const methods = ["getPrimaryButtonStyle", "autoGrowTextarea", "clampTheta", "clampUi", "thetaToUi", "uiToThetaBand", "uiWord", "addQuestion", "getDifficultyBadge", "getDifficultyColor", "publishExam", "deleteQuestion", "setCorrectOption", "updateOption", "handleTypeChange", "closeBankModal", "openBankModal", "toggleBankQuestion"];
let vars = new Set(methods);

let match;
while ((match = varRegex.exec(topLogic)) !== null) {
  if (match[1]) match[1].split(',').forEach(v => vars.add(v.trim()));
  else if (match[2]) vars.add(match[2].trim());
}

const contextValueStr = `
  const contextValue = {
    ${Array.from(vars).filter(v => v).join(', ')}
  };
`;

const imports = `import { useParams, useNavigate } from 'react-router-dom'\nimport { ExamBuilderContext } from '../../components/ExamBuilder/ExamBuilderContext'\nimport QuestionSelectionModal from '../../components/ExamBuilder/QuestionSelectionModal'\nimport ExamSettingsPanel from '../../components/ExamBuilder/ExamSettingsPanel'\nimport SelectedQuestionList from '../../components/ExamBuilder/SelectedQuestionList'`;

const newTop = topLogic.replace("import { useParams, useNavigate } from 'react-router-dom'", imports) + contextValueStr;

// extract the header+form part which is between the modal and the settings panel
const headerFormJSX = srcCode.substring(srcCode.indexOf(modalEndTag) + modalEndTag.length, srcCode.indexOf(settingsStartTag));

const parentJSX = `
  return (
    <ExamBuilderContext.Provider value={contextValue}>
      <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <QuestionSelectionModal />
        ${headerFormJSX}
        <ExamSettingsPanel />
        <SelectedQuestionList />
      </div>
    </ExamBuilderContext.Provider>
  )
}

export default ExamBuilder;
`;

fs.writeFileSync('src/pages/instructor/ExamBuilder.jsx', newTop + parentJSX);
console.log('REFACTOR SUCCESSFUL!');
