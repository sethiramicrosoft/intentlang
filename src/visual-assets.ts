import { PAGE_EXAMPLES } from "./web-examples.js";

export const VISUAL_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IntentLang - Build pages in English</title>
<link rel="stylesheet" href="/visual.css"><script src="/visual.js" defer></script>
</head><body>
<header><a href="/" class="brand">IntentLang</a><span class="badge">Visual language / experimental</span>
<a href="/">Business App Builder</a></header>
<main>
<h1>Build pages in English.</h1>
<p class="intro">Start with Hello World, then build named, nested HTML elements and style them.
A deterministic language - no AI model, account, or database. This is a foundation, not complete web-platform coverage.</p>
<div class="workspace">
<section class="editor-pane" aria-labelledby="editor-title">
<div class="heading"><h2 id="editor-title">Your instructions</h2><label for="lesson">Example</label>
<select id="lesson">
<option value="hello">Hello, world</option><option value="style">Compound styles</option>
<option value="webpage">A complete page</option><option value="controls">Native form controls</option>
<option value="table">A real table</option>
<option value="lines">Text on separate lines</option><option value="poster">Words in motion</option>
<option value="ambiguity">Resolve ambiguity</option><option value="typo">Fix a typo</option>
<option value="position">Position</option><option value="left-right">Left to right</option>
<option value="right-left">Right to left</option><option value="top-bottom">Top to bottom</option>
<option value="bottom-top">Bottom to top</option></select></div>
<label for="source">Write one English instruction per line. No quotes or escape characters needed.</label>
<textarea id="source" spellcheck="false" maxlength="20000" aria-describedby="editor-help"></textarea>
<p id="editor-help">Combine styles with "and". Name elements to address them. Browse capabilities below for English instructions.
Ambiguities and typos offer choices, never silent corrections.
Edits stay in this tab; download source to keep them.</p>
<div class="actions"><button id="run" type="button">Run / replay</button>
<button id="download-source" type="button">Download source</button>
<button id="download" type="button" disabled>Download HTML</button></div>
<p id="status" role="status" aria-live="polite">Starting the compiler...</p>
<ul id="problems" aria-label="Compiler diagnostics"></ul>
</section>
<section class="preview-pane" aria-labelledby="preview-title">
<div class="heading"><h2 id="preview-title">Live preview</h2><span>Compiled locally</span></div>
<iframe id="preview" title="Your visual program" sandbox="" hidden></iframe>
<p id="placeholder">Your valid program will appear here.</p>
<p class="motion-note">Reduced-motion preference detected: movement is disabled. Text and styling still work.</p>
</section>
</div>
<details id="capabilities"><summary>Browse HTML and CSS capabilities</summary>
<p id="catalogue-status" role="status">Open to load the compiler's capability catalogue.</p>
<div class="catalogue-controls">
<label>Search <input id="capability-search" type="search" placeholder="heading, underline, background, required"></label>
<label>Kind <select id="capability-kind"><option value="elements">Elements</option><option value="styles">Styles</option><option value="attributes">Attributes</option></select></label>
<label>Target <select id="capability-target"><option value="text">text</option><option value="page">page</option></select></label>
<label>Value for a property <input id="capability-value" placeholder="blue, 24 pixels, yes, or your text"></label>
</div>
<ul id="capability-results"></ul>
<p>Element examples include required parents. Properties use the selected target and your value.
Restricted features are listed with reasons, not silently omitted.
Preview sandboxing blocks form submission and new windows; custom scripts and event handlers are not generated.</p>
</details>
<details><summary>Language reference</summary>
<p>Use one instruction per property; duplicates are errors, not hidden overrides.
Hello World and movement examples still use a single-text scene. Add instructions create a flowing, multi-element page.</p>
<pre>Add a section called welcome
Add a heading called greeting inside welcome
Set the text of greeting to Hello world
Make greeting large and bold
Set the background color of welcome to light blue
Set the padding of welcome to 24 pixels</pre>
<p>Use <code>Put greeting inside welcome</code> to change nesting. Names can contain several words.
Set instructions keep their value literally, so don't add sentence-ending punctuation unless it belongs in text.
Use <code>Set the style width of portrait to 100 percent</code> when width could mean either an attribute or a style.</p>
<pre>Show Hello, world!
Make the text blue
Make the background white
Make the text large and bold
Place the text at the top
Move the text from left to right over 3 seconds</pre>
<p>For several lines, write <code>Show the words THINK, BUILD and MOVE on separate lines</code>.
Or write <code>Show THINK BUILD MOVE</code>, then <code>Put each word on a new line</code>.
Use <code>Put the text on one line</code> to keep it together.
The editor offers choices when the grouping is unclear.</p>
<p>Colors: black, white, red, orange, yellow, green, blue, purple, pink, gray, grey, teal, navy, light blue, light gray.</p>
<p>Sizes: small, medium, large, huge, or a whole number from 12 to 160 pixels.
Positions: left, right, top, bottom, center.
Movement: left to right, right to left, top to bottom, bottom to top, over 0.1 to 60 seconds.</p>
<p>Combine styles: <code>Make the text large, blue and bold.</code>
Weight: bold or regular (not bold). Slant: italic or upright (not italic).
Underline: underline, underlined, or not underlined. You can also say <code>Underline the text</code>.
You can say "it" when the earlier target is unambiguous. "Normal" and "across"
need clarification; the IDE offers explicit replacements. Close spelling matches
also offer corrections without changing your display text.</p>
<p>Movement plays once and stays at its destination. Run / replay restarts it.
When movement is present it controls position; placement is used when reduced motion is enabled.
Lines starting with # are comments. A final period is optional. Unsupported English produces an error.</p>
</details>
</main></body></html>`;

export const VISUAL_CSS = `
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0e1424;color:#e2e8f0}
*{box-sizing:border-box}body{margin:0}header{display:flex;align-items:center;gap:18px;padding:20px 5%;border-bottom:1px solid #29344c;flex-wrap:wrap}
a{color:#a5b4fc}header a:last-child{margin-left:auto}.brand{font-weight:800;font-size:22px;text-decoration:none;color:#fff}
.badge{font-size:12px;background:#253050;border-radius:20px;padding:6px 12px}
main{max-width:1440px;margin:auto;padding:28px 5%}h1{font-size:clamp(32px,5vw,54px);margin:0 0 10px;letter-spacing:-.04em}
.intro{color:#aebbd1;max-width:760px;margin-bottom:28px;line-height:1.6}
.workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px}
section{min-width:0;border:1px solid #33415d;border-radius:14px;background:#151e32;padding:20px}
.heading{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}h2{font-size:18px;margin:0 auto 0 0}
.heading span,.heading label{font-size:12px;color:#b6c2d8}select{max-width:100%}
textarea{display:block;width:100%;height:265px;resize:vertical;margin-top:10px;padding:16px;
background:#0b1120;border:1px solid #526180;border-radius:8px;color:#f8fafc;font:15px/1.8 ui-monospace,monospace}
label,#editor-help{font-size:13px}#editor-help{color:#aebbd1;line-height:1.6}
button,select{font:inherit;background:#263453;color:#fff;border:1px solid #687da6;border-radius:7px;padding:9px 12px}
button{cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}#run{background:#4f46e5;border-color:#a5b4fc}
:focus-visible{outline:3px solid #c4b5fd;outline-offset:3px}.actions{display:flex;gap:8px;flex-wrap:wrap}
#status{font-size:14px;line-height:1.6}#status[data-error=true],#problems{color:#fda4af}
#problems{padding-left:20px;font-size:13px;line-height:1.6}#problems:empty{display:none}
#problems li{margin-bottom:14px}.suggestion{display:block;max-width:100%;text-align:left;margin-top:8px;font-size:13px;
white-space:normal;overflow-wrap:anywhere}.suggestion code{display:block;margin-top:4px;color:#c7d2fe;white-space:pre-wrap}
iframe{display:block;width:100%;height:360px;border:1px solid #526180;border-radius:8px;background:white}
[hidden]{display:none!important}#placeholder{display:grid;place-items:center;min-height:340px;color:#aebbd1}
.motion-note{display:none;font-size:13px;color:#fde68a;line-height:1.6}
@media(prefers-reduced-motion:reduce){.motion-note{display:block}}
details{margin-top:22px;border:1px solid #33415d;border-radius:12px;padding:18px;line-height:1.7;color:#b6c2d8}
summary{cursor:pointer;color:#f8fafc;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere}
.catalogue-controls{display:flex;gap:12px;flex-wrap:wrap}.catalogue-controls label{display:flex;flex-direction:column;gap:5px}
.catalogue-controls input{font:inherit;max-width:100%;padding:9px;background:#0b1120;color:#fff;border:1px solid #687da6;border-radius:7px}
#capability-results{padding-left:20px}#capability-results li{margin:16px 0;overflow-wrap:anywhere}
#capability-results button{margin-left:10px;font-size:13px}#capability-results code{display:block;white-space:pre-wrap}
@media(max-width:850px){.workspace{grid-template-columns:1fr}main{padding:24px 16px}header{padding:16px}iframe{height:320px}}
`;

export const VISUAL_JS = String.raw`
(function () {
  'use strict';
  var editor = document.getElementById('source');
  var preview = document.getElementById('preview');
  var placeholder = document.getElementById('placeholder');
  var status = document.getElementById('status');
  var problems = document.getElementById('problems');
  var download = document.getElementById('download');
  var hello = 'Show Hello, world!';
  var styled = hello + '\nMake the text large, purple, bold and underlined\nMake the background light blue';
  var examples = {
    hello: hello,
    style: styled,
    lines: 'Show THINK BUILD MOVE\nPut each word on a new line\nMake the text large and bold',
    poster: 'Show the words THINK, BUILD and MOVE on separate lines\nMake it 80 pixels, bold and italic\nMake the text light blue\nMake the background navy\nSlide the text from bottom to top over 8 seconds',
    ambiguity: hello + '\nMake the text normal',
    typo: hello + '\nMake the text larg and bold',
    position: styled + '\nPlace the text at the top',
    'left-right': styled + '\nMove the text from left to right over 3 seconds',
    'right-left': styled + '\nMove the text from right to left over 3 seconds',
    'top-bottom': styled + '\nMove the text from top to bottom over 3 seconds',
    'bottom-top': styled + '\nMove the text from bottom to top over 3 seconds'
  };
  var lastExample = hello;
  Object.assign(examples, ${JSON.stringify(PAGE_EXAMPLES)});
  var catalogue = null;
  var catalogueLoading = false;
  var currentElements = [{ name: 'text', tag: 'p' }, { name: 'page', tag: 'body' }];
  var catalogueStatus = document.getElementById('catalogue-status');
  var catalogueResults = document.getElementById('capability-results');
  var catalogueTarget = document.getElementById('capability-target');
  function renderCatalogue() {
    if (!catalogue) return;
    var kind = document.getElementById('capability-kind').value;
    var query = document.getElementById('capability-search').value.trim().toLowerCase();
    var target = currentElements.find(function (item) { return item.name === catalogueTarget.value; });
    var element = catalogue.elements.find(function (item) { return item.name === (target ? target.tag : 'p'); });
    var items = kind === 'attributes' ? (element ? element.attributes : []) : catalogue[kind];
    var matches = items.filter(function (item) {
      return (item.name + ' ' + item.words.join(' ') + ' ' + (item.reason || '')).toLowerCase().includes(query);
    });
    catalogueStatus.textContent = catalogue.elements.filter(function (item) { return item.status === 'available'; }).length +
      ' element types and ' + catalogue.styles.filter(function (item) { return item.status === 'available'; }).length +
      ' validated style properties available. ' + matches.length + ' matches; showing up to 40. Source: ' + catalogue.source;
    catalogueResults.textContent = '';
    matches.slice(0, 40).forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item.words[0] + ' - ' + item.status + (item.reason ? ': ' + item.reason : '');
      if (item.status === 'available') {
        var code = document.createElement('code');
        var value = document.getElementById('capability-value').value.trim();
        var instruction = kind === 'elements' ? item.example :
          'Set the ' + (kind === 'styles' ? 'style' : 'attribute') + ' ' + item.words[0] +
          ' of ' + catalogueTarget.value + ' to ' + (value || (item.boolean ? 'yes' : 'YOUR VALUE'));
        code.textContent = instruction;
        li.appendChild(code);
        if (item.values && item.values.length) {
          var choices = document.createElement('span');
          choices.textContent = 'Suggested values: ' + item.values.slice(0, 20).join(', ');
          li.appendChild(choices);
        }
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Insert instructions';
        button.disabled = kind !== 'elements' && !value && !item.boolean;
        button.addEventListener('click', function () {
          var inserted = instruction;
          if (kind === 'elements') {
            var number = 1;
            while (editor.value.toLowerCase().includes('sample ' + number + ' ')) number++;
            inserted = instruction.replace(/\b(called|inside) sample /g, '$1 sample ' + number + ' ');
          }
          var next = editor.value.trimEnd() + '\n' + inserted;
          if (next.length > editor.maxLength) {
            message('These instructions exceed the source limit. Shorten the source first.', true);
            return;
          }
          editor.value = next;
          editor.focus();
          compile();
        });
        li.appendChild(button);
      }
      catalogueResults.appendChild(li);
    });
  }
  document.getElementById('capabilities').addEventListener('toggle', async function (event) {
    if (!event.target.open || catalogue || catalogueLoading) return;
    catalogueLoading = true;
    catalogueStatus.textContent = 'Loading capabilities...';
    try {
      var response = await fetch('/api/visual/capabilities');
      if (!response.ok) throw new Error('Could not load capabilities. Close and reopen to retry.');
      catalogue = await response.json();
      renderCatalogue();
    } catch (error) {
      catalogueStatus.textContent = error.message || String(error);
    } finally { catalogueLoading = false; }
  });
  ['capability-search', 'capability-kind', 'capability-target', 'capability-value'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', renderCatalogue);
  });
  var csrf = null;
  var revision = 0;
  var timer;
  var html = null;
  editor.value = hello;
  function message(text, error) {
    status.textContent = text;
    status.dataset.error = String(!!error);
  }
  function invalidate() {
    revision += 1;
    html = null;
    download.disabled = true;
    preview.hidden = true;
    preview.removeAttribute('srcdoc');
    placeholder.hidden = false;
    problems.textContent = '';
  }
  async function compile() {
    clearTimeout(timer);
    invalidate();
    var current = revision;
    var source = editor.value;
    message('Compiling...');
    try {
      if (!csrf) {
        var stateResponse = await fetch('/api/state');
        if (!stateResponse.ok) throw new Error('Could not initialize Studio. Reload the page.');
        csrf = (await stateResponse.json()).csrfToken;
      }
      if (current !== revision) return;
      var response = await fetch('/api/visual/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Studio-CSRF-Token': csrf },
        body: JSON.stringify({ source: source })
      });
      var data = await response.json();
      if (current !== revision) return;
      if (!response.ok) throw new Error(data.error || 'Compilation request failed.');
      if (!data.ok) {
        (data.diagnostics || []).forEach(function (item) {
          var li = document.createElement('li');
          var category = item.category === 'ambiguity' ? 'Ambiguous' : item.category === 'typo' ? 'Possible typo' : 'Unsupported or invalid';
          li.textContent = category + ' - Line ' + item.line + ': ' + item.message + ' ' + item.hint;
          (item.suggestions || []).forEach(function (suggestion) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'suggestion';
            button.textContent = suggestion.label;
            var code = document.createElement('code');
            code.textContent = suggestion.replacement;
            button.appendChild(code);
            button.addEventListener('click', function () {
              if (editor.value !== source) {
                compile();
                return;
              }
              var lines = source.replace(/\r\n/g, '\n').split('\n');
              lines[item.line - 1] = suggestion.replacement;
              var amended = lines.join('\n');
              if (amended.length > editor.maxLength) {
                message('This suggestion would exceed the source length limit. Shorten the source first.', true);
                return;
              }
              editor.value = amended;
              editor.focus();
              compile();
            });
            li.appendChild(button);
          });
          problems.appendChild(li);
        });
        var ambiguous = data.diagnostics.some(function (item) { return item.category === 'ambiguity'; });
        message(ambiguous
          ? 'Ambiguous instructions: choose the meaning you intend below. No preview or HTML was generated.'
          : 'Fix the instructions below. No preview or HTML was generated.', true);
        return;
      }
      html = data.html;
      currentElements = data.ir.kind === 'page' ? data.ir.elements : [{ name: 'text', tag: 'p' }, { name: 'page', tag: 'body' }];
      var previousTarget = catalogueTarget.value;
      catalogueTarget.textContent = '';
      currentElements.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item.name;
        option.textContent = item.name;
        catalogueTarget.appendChild(option);
      });
      if (currentElements.some(function (item) { return item.name === previousTarget; })) catalogueTarget.value = previousTarget;
      renderCatalogue();
      preview.srcdoc = html;
      preview.hidden = false;
      placeholder.hidden = true;
      download.disabled = false;
      message('Ready. Edit a sentence or press Run / replay.');
    } catch (error) {
      if (current === revision) message(error.message || String(error), true);
    }
  }
  editor.addEventListener('input', function () {
    invalidate();
    message('Waiting for your edit...');
    clearTimeout(timer);
    timer = setTimeout(compile, 300);
  });
  document.getElementById('run').addEventListener('click', compile);
  document.getElementById('lesson').addEventListener('change', function (event) {
    if (editor.value !== lastExample && !window.confirm('Replace your edited instructions with this example? Download source first to keep your changes.')) {
      event.target.value = Object.keys(examples).find(function (key) { return examples[key] === lastExample; });
      return;
    }
    lastExample = examples[event.target.value];
    editor.value = lastExample;
    compile();
  });
  function save(content, filename, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type }));
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  download.addEventListener('click', function () {
    if (html !== null) save(html, 'intentlang-visual.html', 'text/html;charset=utf-8');
  });
  document.getElementById('download-source').addEventListener('click', function () {
    save(editor.value, 'hello-world.visual.intent', 'text/plain;charset=utf-8');
  });
  compile();
})();
`;
