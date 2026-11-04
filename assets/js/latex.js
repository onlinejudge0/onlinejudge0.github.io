let mathJaxPromise;

if (window.MathJax) {
    window.MathJax.tex ??= {};
    window.MathJax.tex.inlineMath ??= [["\\(", "\\)"], ["$", "$"]];
    window.MathJax.tex.displayMath ??= [["\\[", "\\]"], ["$$", "$$"]];
} else {
    window.MathJax = {
        tex: {
            inlineMath: [["\\(", "\\)"], ["$", "$"]],
            displayMath: [["\\[", "\\]"], ["$$", "$$"]],
        },
        options: {
            skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
        },
    };
}

export function loadMathJax() {
    if (window.MathJax?.typesetPromise) {
        return Promise.resolve();
    }
    if (mathJaxPromise) {
        return mathJaxPromise;
    }

    mathJaxPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Không tải được bộ hiển thị LaTeX (MathJax)."));
        document.head.appendChild(script);
    });

    return mathJaxPromise;
}

export async function typesetMath(element) {
    await loadMathJax();
    window.MathJax.typesetClear?.([element]);
    await window.MathJax.typesetPromise([element]);
}
