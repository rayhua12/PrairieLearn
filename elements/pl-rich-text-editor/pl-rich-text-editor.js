/* eslint-env browser,jquery */
/* global Quill,he, MathJax */

window.PLRTE = function (uuid, options) {
  if (!options.modules) options.modules = {};
  if (options.readOnly) {
    options.modules.toolbar = false;
  } else {
    options.modules.toolbar = [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block', { script: 'sub' }, { script: 'super' }, 'formula'],
      [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
      [{ size: ['small', false, 'large'] }],
      [{ header: [1, 2, 3, false] }],
      [{ color: [] }, { background: [] }],
      ['clean'],
    ];
  }

  let inputElement = $('#rte-input-' + uuid);
  let quill = new Quill('#rte-' + uuid, options);

  let contents = atob(inputElement.val());
  quill.setContents(quill.clipboard.convert(contents));

  quill.on('text-change', function (_delta, _oldDelta, _source) {
    inputElement.val(
      btoa(
        he.encode(quill.root.innerHTML, {
          allowUnsafeSymbols: true, // HTML tags should be kept
          useNamedReferences: true,
        })
      )
    );
  });
};

// Override default implementation of 'formula'

var Embed = Quill.imports.parchment.Embed;

class MathFormula extends Embed  {
  static create(value) {
    const node = super.create(value);    
    if (typeof value === 'string') {
      this.waitUntilLoaded(node, value);
      
    }
    return node;
  }

  static waitUntilLoaded(node, value) {
    if(document.readyState !== 'complete'){
      window.setTimeout(this.waitUntilLoaded, 200, node, value);
    }
    else{
      let html = MathJax.tex2chtml(value);
      let formatted = html.innerHTML
      node.innerHTML = "&#65279;" + formatted + "&#65279;" + " ";
      MathJax.typeset()
      node.contentEditable = 'false';
      node.setAttribute('data-value', value);
      return node;
    }
  }

  static value(domNode) {
    return domNode.getAttribute('data-value');
  }

  html() {
    const { formula } = this.value();
    return `<span>${formula}</span>`;
  }
}
MathFormula.blotName = 'formula';
MathFormula.className = 'ql-formula';
MathFormula.tagName = 'SPAN';

Quill.register('formats/formula', MathFormula, true);
