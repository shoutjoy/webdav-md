# Repository UI preservation rules

## Required MDpro development handoff

- For every MDpro feature, fix, refactor or cross-app port, follow `docs/mdpro-development/README.md`.
- Before finishing, create/update the change document under `docs/mdpro-development/changes/`, update the index, and include concrete code changes, target-specific adaptation, verification evidence and a copyable implementation prompt for the other app.
- Preserve the other app's independent code. Do not copy complete files over it merely because the feature names match. Document unavailable target inspection as unverified.
- Record the MDproViewer Tauri impact and pending work in the change document and build queue. Follow the target's `Docs/mdpro-development/TAURI_BUILD.md` when a Tauri build is requested there.
- Documentation-only changes do not require a recursively generated handoff. Do not auto-port, auto-build, commit or deploy merely to complete documentation.

## Required math rendering contract

- Before changing Markdown math parsing, MathJax loading/typesetting, view/PV rendering, or DOCX/PDF math output, read and follow `docs/MATH_RENDER_RULES.md` (`MDPRO-MATH-RENDER-CONTRACT`).
- Preserve rule IDs M-01 through M-13 when porting fixes to another MDPro app. Copy the contract, connect every rendering surface to the common pipeline, and port the required regression cases.
- A successful syntax check, unit test, or build is not live rendering proof. Verify the supplied formulas in the real main view and PV; for DOCX changes, export a new file and inspect it in Word.

## Required print and PDF contract

- Before changing printing, PDF export, preview pagination, or output handling for math, Mermaid, tables, and images, read and follow `docs/PRINT_PDF_RULES.md` (`MDPRO-PRINT-PDF-CONTRACT`).
- Preserve its C/P/D rule IDs and required behavior when porting to MDproViewer or another app. Copy and connect the contract to that app's developer instructions, map each rule to its implementation, and verify actual output.
- Existing clipping fallbacks are documented limitations, not permitted behavior. Report unresolved mandatory rules as partial compliance; do not claim full compliance from a successful build alone.

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
