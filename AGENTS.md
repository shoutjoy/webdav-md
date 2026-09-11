# Repository UI preservation rules

## Preserve existing features

- Treat every existing visible control, keyboard shortcut, menu entry, setting, and interaction as part of the product contract.
- Do not delete, hide, disable, rename, or make an existing feature unreachable unless the user's current request explicitly asks for that exact change.
- When changing layout or responsive CSS, first inventory the controls in the affected component and verify that all of them remain reachable afterward.
- Prefer additive or narrowly scoped changes. Do not replace a complete toolbar or menu with a reduced version as an incidental part of another task.
- Preserve existing element IDs and event bindings unless the requested feature requires a migration, and update all callers and contract tests when a migration is necessary.

## AI Jena required controls

The expanded AI Jena header must always expose these controls in popup, Dock, fullscreen, and expanded bottom-floating layouts:

- `#ai-chat-history-toggle`
- `#ai-chat-new`
- `#ai-chat-copy-all`
- `#ai-chat-save-all`
- `#ai-chat-data-center-open`
- `#ai-chat-layout-menu-button`
- `#ai-chat-close`

The compact Alt+4 bottom menu must keep `#ai-chat-floating-drag-handle`, `#ai-chat-floating-toggle`, the input, response-mode controls, document real-time writing controls, and send/stop controls reachable. Real-time document writing must not automatically expand the compact bottom menu.

## Required verification

- After editing AI Jena UI code, run `node --test tests/aiJenaUiContract.test.mjs`.
- Run `node --check mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`, and `npm run build` after relevant UI changes.
- Review the final diff for accidental removals or new `display: none`, `visibility: hidden`, `opacity: 0`, clipping, or overflow rules affecting existing controls.
