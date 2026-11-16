// Lightweight W3C-compatible Node DOM shim for mounting React 19 components
// via react-dom/client in `node --test` without adding external dependencies.

export function installNodeDomShim() {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  class ShimEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.bubbles = Boolean(init.bubbles);
      this.cancelable = Boolean(init.cancelable);
      this.defaultPrevented = false;
      this.cancelBubble = false;
      this.target = null;
      this.currentTarget = null;
      this.eventPhase = 0;
    }
    preventDefault() {
      if (this.cancelable) this.defaultPrevented = true;
    }
    stopPropagation() {
      this.cancelBubble = true;
    }
    stopImmediatePropagation() {
      this.cancelBubble = true;
    }
  }

  class ShimUIEvent extends ShimEvent {}
  class ShimMouseEvent extends ShimUIEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.button = init.button ?? 0;
      this.buttons = init.buttons ?? 0;
    }
  }
  class ShimFocusEvent extends ShimUIEvent {}

  class ShimNode {
    constructor(nodeType, nodeName) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.parentNode = null;
      this.childNodes = [];
      this.ownerDocument = null;
      this._listeners = new Map();
    }
    get firstChild() {
      return this.childNodes[0] ?? null;
    }
    get lastChild() {
      return this.childNodes[this.childNodes.length - 1] ?? null;
    }
    get nextSibling() {
      if (!this.parentNode) return null;
      const idx = this.parentNode.childNodes.indexOf(this);
      return idx >= 0 ? this.parentNode.childNodes[idx + 1] ?? null : null;
    }
    get previousSibling() {
      if (!this.parentNode) return null;
      const idx = this.parentNode.childNodes.indexOf(this);
      return idx > 0 ? this.parentNode.childNodes[idx - 1] ?? null : null;
    }
    appendChild(child) {
      return this.insertBefore(child, null);
    }
    insertBefore(child, refNode) {
      if (child.nodeType === 11) {
        const items = [...child.childNodes];
        for (const item of items) this.insertBefore(item, refNode);
        return child;
      }
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      child.ownerDocument = this.ownerDocument;
      if (refNode) {
        const idx = this.childNodes.indexOf(refNode);
        if (idx >= 0) {
          this.childNodes.splice(idx, 0, child);
          return child;
        }
      }
      this.childNodes.push(child);
      return child;
    }
    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx >= 0) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }
    replaceChild(newChild, oldChild) {
      this.insertBefore(newChild, oldChild);
      this.removeChild(oldChild);
      return oldChild;
    }
    contains(other) {
      let cur = other;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentNode;
      }
      return false;
    }
    addEventListener(type, fn, options) {
      if (!fn) return;
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      const key = `${type}::${capture ? 'c' : 'b'}`;
      const list = this._listeners.get(key) ?? [];
      if (!list.includes(fn)) list.push(fn);
      this._listeners.set(key, list);
    }
    removeEventListener(type, fn, options) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      const key = `${type}::${capture ? 'c' : 'b'}`;
      const list = this._listeners.get(key);
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    }
    dispatchEvent(event) {
      event.target = event.target || this;
      const path = [];
      let cur = this;
      while (cur) {
        path.push(cur);
        cur = cur.parentNode;
      }
      if (this.ownerDocument && !path.includes(this.ownerDocument)) {
        path.push(this.ownerDocument);
      }
      // Capture phase (document -> parent)
      event.eventPhase = 1;
      for (let i = path.length - 1; i >= 1; i--) {
        if (event.cancelBubble) break;
        const target = path[i];
        event.currentTarget = target;
        for (const fn of [...(target._listeners.get(`${event.type}::c`) ?? [])]) {
          fn.call(target, event);
        }
      }
      // Target phase
      if (!event.cancelBubble) {
        event.eventPhase = 2;
        event.currentTarget = this;
        for (const fn of [
          ...(this._listeners.get(`${event.type}::c`) ?? []),
          ...(this._listeners.get(`${event.type}::b`) ?? []),
        ]) {
          fn.call(this, event);
        }
      }
      // Bubble phase
      if (event.bubbles) {
        event.eventPhase = 3;
        for (let i = 1; i < path.length; i++) {
          if (event.cancelBubble) break;
          const target = path[i];
          event.currentTarget = target;
          for (const fn of [...(target._listeners.get(`${event.type}::b`) ?? [])]) {
            fn.call(target, event);
          }
        }
      }
      return !event.defaultPrevented;
    }
    get textContent() {
      if (this.nodeType === 3 || this.nodeType === 8) return this.nodeValue ?? '';
      return this.childNodes.map((c) => c.textContent).join('');
    }
    set textContent(val) {
      const str = val == null ? '' : String(val);
      this.childNodes = [];
      if (str.length > 0) {
        const tn = new ShimText(str);
        tn.parentNode = this;
        tn.ownerDocument = this.ownerDocument;
        this.childNodes.push(tn);
      }
    }
  }

  class ShimText extends ShimNode {
    constructor(data) {
      super(3, '#text');
      this.nodeValue = String(data ?? '');
    }
    get data() {
      return this.nodeValue;
    }
    set data(val) {
      this.nodeValue = String(val ?? '');
    }
  }

  class ShimComment extends ShimNode {
    constructor(data) {
      super(8, '#comment');
      this.nodeValue = String(data ?? '');
    }
  }

  class ShimDocumentFragment extends ShimNode {
    constructor() {
      super(11, '#document-fragment');
    }
  }

  function matchSingleSelector(el, selector) {
    if (!el || el.nodeType !== 1) return false;
    const attrMatch = selector.match(/^([a-zA-Z0-9_-]+)?\[([^=\^$*~|]+)(\^=|\$=|\*=|=)?(?:"([^"]*)")?\]$/);
    if (attrMatch) {
      const [, tag, attrName, op, attrVal] = attrMatch;
      if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
      if (!el.hasAttribute(attrName)) return false;
      if (attrVal === undefined) return true;
      const actual = el.getAttribute(attrName) || '';
      if (op === '^=') return actual.startsWith(attrVal);
      if (op === '$=') return actual.endsWith(attrVal);
      if (op === '*=') return actual.includes(attrVal);
      return actual === attrVal;
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return (el.getAttribute('class') || '').split(/\s+/).includes(cls);
    }
    if (selector.startsWith('#')) {
      return el.getAttribute('id') === selector.slice(1);
    }
    return el.tagName.toLowerCase() === selector.toLowerCase();
  }

  function collectMatching(root, selector, out = []) {
    const parts = selector.trim().split(/\s+/);
    if (parts.length > 1) {
      let current = [root];
      for (const part of parts) {
        const next = [];
        const seen = new Set();
        for (const node of current) {
          for (const m of collectMatching(node, part, [])) {
            if (!seen.has(m)) {
              seen.add(m);
              next.push(m);
            }
          }
        }
        current = next;
      }
      return current;
    }
    for (const child of root.childNodes) {
      if (child.nodeType === 1) {
        if (matchSingleSelector(child, selector)) out.push(child);
        collectMatching(child, selector, out);
      }
    }
    return out;
  }

  class ShimElement extends ShimNode {
    constructor(tagName) {
      const upper = tagName.toUpperCase();
      super(1, upper);
      this.tagName = upper;
      this.attributes = new Map();
      this.style = {};
      this.dataset = {};
      this._value = '';
      this._checked = false;
      this.disabled = false;
      this.type = '';
    }
    setAttribute(name, val) {
      const str = String(val);
      this.attributes.set(name, str);
      if (name === 'value') this._value = str;
      if (name === 'disabled') this.disabled = true;
      if (name === 'type') this.type = str;
    }
    getAttribute(name) {
      if (name === 'disabled') return this.disabled ? '' : null;
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    }
    hasAttribute(name) {
      if (name === 'disabled') return Boolean(this.disabled);
      return this.attributes.has(name);
    }
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name === 'disabled') this.disabled = false;
    }
    get className() {
      return this.attributes.get('class') ?? '';
    }
    set className(val) {
      this.attributes.set('class', String(val ?? ''));
    }
    set innerHTML(val) {
      if (val === '') {
        this.childNodes = [];
        return;
      }
      this.childNodes = [];
      const tn = new ShimText(val);
      tn.parentNode = this;
      tn.ownerDocument = this.ownerDocument;
      this.childNodes.push(tn);
    }
    get innerHTML() {
      return this.childNodes
        .map((c) => {
          if (c.nodeType === 3) return c.nodeValue;
          if (c.nodeType === 8) return `<!--${c.nodeValue}-->`;
          const attrs = [...c.attributes.entries()]
            .map(([k, v]) => ` ${k}="${v.replace(/"/g, '&quot;')}"`)
            .join('');
          const tag = c.tagName.toLowerCase();
          return `<${tag}${attrs}>${c.innerHTML}</${tag}>`;
        })
        .join('');
    }
    querySelector(selector) {
      return collectMatching(this, selector)[0] ?? null;
    }
    querySelectorAll(selector) {
      return collectMatching(this, selector);
    }
    focus() {}
    blur() {}
    click() {
      if (this.disabled) return;
      if (this.tagName === 'INPUT' && this.type === 'checkbox') {
        const desc = Object.getOwnPropertyDescriptor(ShimHTMLInputElement.prototype, 'checked');
        if (desc?.set) desc.set.call(this, !this._checked);
        else this._checked = !this._checked;
      }
      this.dispatchEvent(new ShimMouseEvent('click', { bubbles: true, cancelable: true }));
      if (this.tagName === 'BUTTON' && (!this.type || this.type === 'submit')) {
        let cur = this.parentNode;
        while (cur && cur.tagName !== 'FORM') cur = cur.parentNode;
        if (cur) cur.dispatchEvent(new ShimEvent('submit', { bubbles: true, cancelable: true }));
      }
    }
  }

  class ShimHTMLElement extends ShimElement {}
  class ShimHTMLInputElement extends ShimHTMLElement {
    constructor(tag) {
      super(tag);
      this.type = 'text';
    }
    get value() {
      return this._value;
    }
    set value(v) {
      this._value = v == null ? '' : String(v);
    }
    get checked() {
      return this._checked;
    }
    set checked(v) {
      this._checked = Boolean(v);
    }
  }
  class ShimHTMLTextAreaElement extends ShimHTMLElement {
    get value() {
      return this._value;
    }
    set value(v) {
      this._value = v == null ? '' : String(v);
    }
  }
  class ShimHTMLSelectElement extends ShimHTMLElement {
    get options() {
      return this.querySelectorAll('option');
    }
    get selectedIndex() {
      const opts = this.options;
      const idx = opts.findIndex((o) => o.selected);
      return idx >= 0 ? idx : opts.length > 0 ? 0 : -1;
    }
    set selectedIndex(idx) {
      const opts = this.options;
      opts.forEach((o, i) => {
        o.selected = i === idx;
      });
    }
    get value() {
      if (this._value) return this._value;
      const sel = this.options.find((o) => o.selected) ?? this.options[0];
      return sel ? sel.value : '';
    }
    set value(v) {
      this._value = v == null ? '' : String(v);
      for (const opt of this.options) {
        opt.selected = opt.value === this._value;
      }
    }
  }
  class ShimHTMLOptionElement extends ShimHTMLElement {
    constructor(tag) {
      super(tag);
      this.selected = false;
      this.defaultSelected = false;
    }
    get value() {
      return this.attributes.has('value') ? this.attributes.get('value') : this.textContent;
    }
    set value(v) {
      this._value = String(v ?? '');
      this.attributes.set('value', this._value);
    }
  }
  class ShimHTMLFormElement extends ShimHTMLElement {}
  class ShimHTMLButtonElement extends ShimHTMLElement {}
  class ShimHTMLIFrameElement extends ShimHTMLElement {}
  class ShimSVGElement extends ShimElement {}

  class ShimDocument extends ShimNode {
    constructor() {
      super(9, '#document');
      this.documentElement = new ShimHTMLElement('html');
      this.head = new ShimHTMLElement('head');
      this.body = new ShimHTMLElement('body');
      this.documentElement.ownerDocument = this;
      this.head.ownerDocument = this;
      this.body.ownerDocument = this;
      this.documentElement.appendChild(this.head);
      this.documentElement.appendChild(this.body);
      this.ownerDocument = this;
      this.activeElement = this.body;
      this.oninput = null;
      this.onchange = null;
      this.onclick = null;
      this.onsubmit = null;
    }
    createElement(tag) {
      const lower = String(tag).toLowerCase();
      let el;
      if (lower === 'input') el = new ShimHTMLInputElement(lower);
      else if (lower === 'textarea') el = new ShimHTMLTextAreaElement(lower);
      else if (lower === 'select') el = new ShimHTMLSelectElement(lower);
      else if (lower === 'option') el = new ShimHTMLOptionElement(lower);
      else if (lower === 'form') el = new ShimHTMLFormElement(lower);
      else if (lower === 'button') el = new ShimHTMLButtonElement(lower);
      else if (lower === 'iframe') el = new ShimHTMLIFrameElement(lower);
      else el = new ShimHTMLElement(lower);
      el.ownerDocument = this;
      return el;
    }
    createElementNS(ns, tag) {
      if (String(ns).includes('svg')) {
        const el = new ShimSVGElement(tag);
        el.ownerDocument = this;
        return el;
      }
      return this.createElement(tag);
    }
    createTextNode(text) {
      const t = new ShimText(text);
      t.ownerDocument = this;
      return t;
    }
    createComment(text) {
      const c = new ShimComment(text);
      c.ownerDocument = this;
      return c;
    }
    createDocumentFragment() {
      const f = new ShimDocumentFragment();
      f.ownerDocument = this;
      return f;
    }
    querySelector(sel) {
      return this.body.querySelector(sel);
    }
    querySelectorAll(sel) {
      return this.body.querySelectorAll(sel);
    }
  }

  const document = new ShimDocument();
  const windowObj = {
    document,
    location: { href: 'http://localhost:3000/', pathname: '/', search: '' },
    navigator: { userAgent: 'node-dom-shim' },
    addEventListener: document.addEventListener.bind(document),
    removeEventListener: document.removeEventListener.bind(document),
    dispatchEvent: document.dispatchEvent.bind(document),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    HTMLElement: ShimHTMLElement,
    HTMLInputElement: ShimHTMLInputElement,
    HTMLTextAreaElement: ShimHTMLTextAreaElement,
    HTMLSelectElement: ShimHTMLSelectElement,
    HTMLOptionElement: ShimHTMLOptionElement,
    HTMLFormElement: ShimHTMLFormElement,
    HTMLButtonElement: ShimHTMLButtonElement,
    HTMLIFrameElement: ShimHTMLIFrameElement,
    SVGElement: ShimSVGElement,
    Document: ShimDocument,
    Element: ShimElement,
    Node: ShimNode,
    Event: ShimEvent,
    MouseEvent: ShimMouseEvent,
    FocusEvent: ShimFocusEvent,
  };
  windowObj.window = windowObj;
  windowObj.self = windowObj;
  document.defaultView = windowObj;

  Object.assign(globalThis, {
    window: windowObj,
    document,
    Event: ShimEvent,
    MouseEvent: ShimMouseEvent,
    FocusEvent: ShimFocusEvent,
    Node: ShimNode,
    Element: ShimElement,
    HTMLElement: ShimHTMLElement,
    HTMLInputElement: ShimHTMLInputElement,
    HTMLTextAreaElement: ShimHTMLTextAreaElement,
    HTMLSelectElement: ShimHTMLSelectElement,
    HTMLOptionElement: ShimHTMLOptionElement,
    HTMLFormElement: ShimHTMLFormElement,
    HTMLButtonElement: ShimHTMLButtonElement,
    HTMLIFrameElement: ShimHTMLIFrameElement,
    SVGElement: ShimSVGElement,
    Document: ShimDocument,
    requestAnimationFrame: windowObj.requestAnimationFrame,
    cancelAnimationFrame: windowObj.cancelAnimationFrame,
  });

  if (!globalThis.navigator) {
    Object.defineProperty(globalThis, 'navigator', {
      value: windowObj.navigator,
      configurable: true,
    });
  }

  return {
    document,
    window: windowObj,
    setInputValue(el, value) {
      const proto =
        el.tagName === 'SELECT'
          ? ShimHTMLSelectElement.prototype
          : el.tagName === 'TEXTAREA'
          ? ShimHTMLTextAreaElement.prototype
          : ShimHTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor?.set) descriptor.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new ShimEvent('input', { bubbles: true }));
      el.dispatchEvent(new ShimEvent('change', { bubbles: true }));
    },
    setCheckbox(el, checked) {
      if (Boolean(el.checked) !== Boolean(checked)) {
        el.click();
      }
    },
    submitForm(form) {
      form.dispatchEvent(new ShimEvent('submit', { bubbles: true, cancelable: true }));
    },
  };
}
