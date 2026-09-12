import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const mobileUi = readFileSync(new URL('../mdpro/MobileUI/mobile-ui.js', import.meta.url), 'utf8');
const mdproEditor = readFileSync(new URL('../src/components/MdproEditor.jsx', import.meta.url), 'utf8');
test('mobile header dropdowns use viewport positioning outside the horizontal scroller', () => {
  assert.match(mobileUi, /function positionHeaderDropdown\(menu, anchor, alignment\)/);
  assert.match(mobileUi, /document\.body\.appendChild\(menu\)/);
  assert.match(mobileUi, /menu\.style\.setProperty\('position', 'fixed'\)/);
  assert.match(mobileUi, /anchor\.getBoundingClientRect\(\)/);
  assert.match(mobileUi, /positionHeaderDropdown: positionHeaderDropdown/);
});

test('open, new-file, save, and WebDAV save menus opt into mobile positioning', () => {
  assert.match(mobileUi, /menuId: 'new-file-menu'/);
  assert.match(mobileUi, /menuId: 'open-source-menu'/);
  assert.match(mobileUi, /menuId: 'save-dropdown-menu'/);
  assert.match(mobileUi, /menuId: 'webdav-save-dropdown-menu'/);
  assert.match(mobileUi, /document\.addEventListener\('click', scheduleHeaderDropdownPositionSync, true\)/);
  assert.match(mdproEditor, /ui=20260912-mobile-header-portal-2/);
});

test('mobile dropdown inline positioning is cleared when menus close', () => {
  assert.match(mobileUi, /function clearHeaderDropdownPosition\(menu\)/);
  assert.match(mobileUi, /marker\.parentNode\.insertBefore\(menu, marker\)/);
  assert.match(mobileUi, /menu\.classList\.contains\('hidden'\)/);
  assert.match(mobileUi, /clearHeaderDropdownPosition\(menu\)/);
});

test('mobile positioning portals a visible menu to body and restores its original DOM slot', () => {
  const styleValues = new Map();
  const style = {
    setProperty(name, value) { styleValues.set(name, value); },
    removeProperty(name) { styleValues.delete(name); }
  };
  const originalParent = {
    children: [],
    insertBefore(node, reference) {
      const currentIndex = this.children.indexOf(node);
      if (currentIndex >= 0) this.children.splice(currentIndex, 1);
      const referenceIndex = this.children.indexOf(reference);
      this.children.splice(referenceIndex < 0 ? this.children.length : referenceIndex, 0, node);
      node.parentNode = this;
    }
  };
  const body = {
    classList: { contains(name) { return name === 'mobile-ui-active'; } },
    children: [],
    appendChild(node) {
      if (node.parentNode?.children) {
        const index = node.parentNode.children.indexOf(node);
        if (index >= 0) node.parentNode.children.splice(index, 1);
      }
      this.children.push(node);
      node.parentNode = this;
    }
  };
  const menu = {
    id: 'open-source-menu',
    style,
    parentNode: originalParent,
    offsetWidth: 190,
    offsetHeight: 120,
    getBoundingClientRect() { return { width: 190, height: 120 }; }
  };
  originalParent.children.push(menu);
  const document = {
    readyState: 'loading',
    body,
    documentElement: { clientWidth: 390, clientHeight: 800 },
    addEventListener() {},
    createComment() {
      return {
        parentNode: null,
        remove() {
          const index = this.parentNode?.children?.indexOf(this) ?? -1;
          if (index >= 0) this.parentNode.children.splice(index, 1);
          this.parentNode = null;
        }
      };
    }
  };
  const window = {
    matchMedia() { return { matches: true }; },
    visualViewport: null,
    setTimeout
  };
  vm.runInNewContext(mobileUi, { window, document, localStorage: { getItem() { return null; }, setItem() {} } });

  const anchor = {
    getBoundingClientRect() { return { left: 300, right: 340, top: 40, bottom: 80 }; }
  };
  assert.equal(window.MobileUI.positionHeaderDropdown(menu, anchor, 'right'), true);
  assert.equal(menu.parentNode, body);
  assert.equal(styleValues.get('position'), 'fixed');
  assert.equal(styleValues.get('left'), '150px');
  assert.equal(styleValues.get('top'), '86px');

  window.MobileUI.clearHeaderDropdownPosition(menu);
  assert.equal(menu.parentNode, originalParent);
  assert.deepEqual(originalParent.children, [menu]);
  assert.equal(styleValues.size, 0);
});
