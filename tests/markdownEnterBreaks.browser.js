// Run with agent-browser eval -b in an isolated MDpro session.
(async () => {
    const wait = async (check, label) => { for (let i=0;i<200;i++) { if (check()) return; await new Promise(r=>setTimeout(r,100)); } throw Error(label); };
    await wait(()=>window.AIChatBridge && typeof updateContent === 'function', 'app initialization');
    const source = '### 실제 데이터 수기 계산\n\n집단 A: 70, 75, 80, 72, 68\n집단 B: 65, 70, 68, 71, 69\n집단 C: 85, 82, 88, 90, 84\n\n**1단계 — 집단 평균**\n집단 합은 각각 365, 343, 429이다.\n\n'
      + String.raw`일반 인라인: \(\beta = .792\)

이중 이스케이프: \\(\\beta = .792\\)

괄호 안 수식: (\(\beta = .792\))

통계 유의성: \(*p<.05, **p<.01, ***p<.001\)

합계: \(\sum \beta_i^2\)

분수: \(\text{AVE}=\frac{2.7069}{4}=0.677\)

코드와 수식: ` + '`result$points`' + String.raw` 다음 값은 $x_i$이다.

일반 문장: (Self-Efficacy), (A/B testing), (→ 동기 부여)

정렬 환경:
$$
\begin{aligned}
a &= b \\
c &= d
\end{aligned}
$$`;
    updateContent(source);
    if (isEditMode) toggleMode('view');
    await wait(()=>document.querySelectorAll('#viewer mjx-container').length >= 8, 'main MathJax');
    function verify(doc, selector) {
        const root = doc.querySelector(selector);
        const group = Array.from(root.querySelectorAll('p')).find(p=>p.textContent.includes('집단 A:'));
        const step = Array.from(root.querySelectorAll('p')).find(p=>p.querySelector('strong,b')?.textContent.includes('1단계'));
        if (group?.querySelectorAll('br').length !== 2 || step?.querySelectorAll('br').length !== 1) throw Error('Enter breaks missing');
        if (root.querySelector('[data-mjx-error],mjx-merror') || root.textContent.includes('MATHSEG')) throw Error('math regression');
        if (!root.textContent.includes('result$points') || !root.textContent.includes('(Self-Efficacy)')) throw Error('code/text changed');
        return {dataBreaks:2,stepBreaks:1,math:Array.from(root.querySelectorAll('mjx-container')).filter(node=>!node.closest('mjx-assistive-mml')).length};
    }
    const main = verify(document,'#viewer');
    await openPreviewPopupWindow();
    await wait(()=>typeof previewPopupWindow !== 'undefined' && previewPopupWindow && previewPopupWindow.document.querySelectorAll('mjx-container').length >= 8, 'PV MathJax');
    const pv = verify(previewPopupWindow.document,'#pv-content');
    if (editorTextarea.value !== source) throw Error('render mutated Markdown source');
    return {main,pv,sourcePreserved:true};
})()
