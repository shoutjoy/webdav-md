import katex from './vendor/katex/katex.mjs';

const symbols = {'−':'-','×':'times','·':'cdot','±':'+-','∓':'-+','≠':'neq','≤':'leq','≥':'geq','∑':'sum','∏':'prod','∫':'int','∮':'oint','∞':'inf','→':'rightarrow','←':'leftarrow','↔':'leftrightarrow','⇒':'Rightarrow','⇐':'Leftarrow','⇔':'Leftrightarrow','⋯':'cdots','…':'ldots','⋮':'vdots','⋱':'ddots','∈':'in','∉':'notin','∂':'partial','∇':'nabla','α':'alpha','β':'beta','γ':'gamma','δ':'delta','θ':'theta','λ':'lambda','μ':'mu','π':'pi','σ':'sigma','φ':'phi','ω':'omega','Γ':'Gamma','Δ':'Delta','Σ':'Sigma','Ω':'Omega'};
const group = value => `{${value}}`;
function convert(node) {
    const children = [...node.children];
    const at = i => convert(children[i]);
    const join = () => children.map(convert).join(' ');
    switch (node.localName) {
        case 'math': case 'semantics': return convert(children[0]);
        case 'annotation': return '';
        case 'mrow': {
            const value=join();
            if (children[0]?.localName==='mo' && children[0].textContent==='{' && children.some(c=>c.localName==='mtable') && children.at(-1).localName==='mtable') return value+' right .';
            return value;
        }
        case 'mi': case 'mn': return symbols[node.textContent] || node.textContent;
        case 'mo': {
            const text = node.textContent;
            if (node.getAttribute('fence') === 'true' || node.getAttribute('stretchy') === 'true' && '()[]{}|'.includes(text)) {
                const left = '([{'.includes(text) || node.previousElementSibling === null;
                return `${left ? 'left' : 'right'} ${text}`;
            }
            return [...text].map(c => symbols[c] || (c === '&' ? '"&"' : c)).join(' ');
        }
        case 'mtext': {
            if(node.textContent.includes('"'))throw new Error('따옴표가 포함된 수식 텍스트는 아직 지원하지 않습니다.');
            return '"' + node.textContent + '"';
        }
        case 'mspace': return '~';
        case 'mfrac': return `${group(at(0))} over ${group(at(1))}`;
        case 'msqrt': return `sqrt ${group(join())}`;
        case 'mroot': return `root ${group(at(1))} of ${group(at(0))}`;
        case 'msub': return `${group(at(0))}_${group(at(1))}`;
        case 'msup': return `${group(at(0))}^${group(at(1))}`;
        case 'msubsup': case 'munderover': { const base=at(0);return `${/^(sum|prod|int|oint|lim)$/.test(base)?base:group(base)}_${group(at(1))}^${group(at(2))}`; }
        case 'munder': return `${group(at(0))}_${group(at(1))}`;
        case 'mover': {
            const accent = children[1].textContent;
            if (node.getAttribute('accent') === 'true') {
                const command = {'→':'vec','^':'hat','ˆ':'hat','¯':'bar','˙':'dot','¨':'ddot','~':'tilde','˜':'tilde'}[accent];
                if (!command) throw new Error('지원하지 않는 수식 강조 기호: ' + accent);
                return `${command} ${group(at(0))}`;
            }
            return `${group(at(0))}^${group(at(1))}`;
        }
        case 'mtable': return `matrix {${children.map(row => [...row.children].map(convert).join(' & ')).join(' # ')}}`;
        case 'mtd': case 'mtr': return join();
        case 'mstyle': {
            const color = node.getAttribute('mathcolor');
            if (!color) return join();
            const named = {red:'255,0,0',blue:'0,0,255',purple:'128,0,128',black:'0,0,0',green:'0,128,0'};
            const rgb = named[color.toLowerCase()] || (/^#[0-9a-f]{6}$/i.test(color) ? [1,3,5].map(i => parseInt(color.slice(i,i+2),16)).join(',') : null);
            if (!rgb) throw new Error('지원하지 않는 수식 색상: '+color);
            return `color {${rgb}} ${group(join())}`;
        }
        default: throw new Error('지원하지 않는 수식 구조: '+node.localName);
    }
}
export function texToHwp(tex, display = false) {
    const markup = katex.renderToString(tex, {output:'mathml',displayMode:display,throwOnError:true,strict:'ignore',trust:false,maxExpand:1000});
    const parsed = new DOMParser().parseFromString(markup,'text/html');
    return convert(parsed.querySelector('math'));
}

export async function protectEquations(content) {
    if (!globalThis.MathRender) await import('../js/math_render/math_render.js');
    const prepared = globalThis.MathRender.protectMathSegments(content,{preserveStructuralRows:true});
    const equations = [];
    const text = prepared.text.replace(/@@MATHSEG_(\d+)@@/g, token => {
        const escaped = prepared.restoreHtml(token);
        const element = document.createElement('textarea'); element.innerHTML = escaped;
        const source = element.value;
        const display = source.startsWith('$$') || source.startsWith('\\[');
        const delimiter = source.startsWith('$') ? (display ? 2 : 1) : 2;
        const tex = source.slice(delimiter,-delimiter);
        if(equations.length>=2000)throw new Error('한 문서에서 수식은 2000개까지 지원합니다.');
        // Short private-use markers avoid inflating table row heights during
        // the native importer's initial text measurement. Check collisions.
        let marker='\uE000'+String.fromCharCode(0xe100+equations.length)+'\uE001';
        while(content.includes(marker))marker+='\uE002';
        equations.push({marker,tex,display,script:texToHwp(tex,display)});
        return marker;
    });
    return {text,equations};
}
