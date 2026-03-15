# Spec 2.5: Lazy-Load FileAttachment + ImageUpload TipTap Extensions

**Category:** 2 — Bundle Size
**Priority:** Medium
**Severity:** Medium
**Audit Finding:** Category 2, Finding 1 (monolithic chunk)

---

## Problem

`Editor.tsx` statically imports `FileAttachment.tsx` and `ImageUpload.tsx`, both of which statically import `upload.ts`. This means the upload logic (and its dependencies) are in the main chunk before any lazy-loading can take effect.

The slash commands menu attempts to lazy-load `FileAttachment`, but since `Editor.tsx` already has a static import, the module is already in the main chunk — the lazy import resolves instantly from the existing module cache. No actual code splitting occurs.

## Fix

Remove the static imports of `FileAttachment` and `ImageUpload` from `Editor.tsx` and instead register those TipTap extensions lazily.

### Important Context

This is a **non-trivial refactor**. TipTap extensions are typically registered at editor creation time via the `extensions` array passed to `useEditor()`. Deferring extension registration requires one of these approaches:

### Approach A: Deferred Extension Registration

1. Create the editor without FileAttachment and ImageUpload extensions initially
2. Dynamically import the extensions when the user triggers file/image upload (via slash command, drag-and-drop, or toolbar button)
3. Use TipTap's `editor.registerExtension()` API (if available) or recreate the editor extensions list

**Risk:** TipTap may not support hot-registering extensions after editor creation. This needs investigation.

### Approach B: Extension Wrapper with Dynamic Import

1. Create lightweight wrapper extensions that are statically registered but internally dynamic-import the heavy upload logic:
   ```tsx
   // LightFileAttachment.ts — registered at editor creation, tiny
   const LightFileAttachment = Extension.create({
     name: 'fileAttachment',
     addCommands() {
       return {
         insertFileAttachment: () => async ({ editor }) => {
           const { FileAttachmentExtension } = await import('./FileAttachment');
           // Use the full extension logic
         },
       };
     },
   });
   ```
2. The wrapper is small (< 1 KB) and lives in the main chunk
3. The actual upload logic (`upload.ts`, `FileAttachment.tsx`, `ImageUpload.tsx`) is in a separate chunk loaded on first use

### Steps

1. Remove static imports of `FileAttachment` and `ImageUpload` from `Editor.tsx`
2. Implement one of the approaches above
3. Verify upload functionality still works via:
   - Slash command → file upload
   - Slash command → image upload
   - Drag-and-drop file/image into editor
   - Toolbar button (if exists)
4. Verify `pnpm build` shows upload.ts and related modules in a separate chunk

## Verification

- `upload.ts`, `FileAttachment.tsx`, `ImageUpload.tsx` are NOT in the main index.js chunk
- File and image upload still function correctly
- First upload interaction has a brief loading moment (acceptable)

## Risks

- TipTap extension API may not support the deferred pattern cleanly — investigate before committing to an approach
- Drag-and-drop handlers may need special treatment since they fire on the editor root, not from a lazy-loaded component

## Audit Targets Addressed

- Removes upload-related code from the main chunk
- Contributes to breaking the 2,073 KB monolithic chunk
