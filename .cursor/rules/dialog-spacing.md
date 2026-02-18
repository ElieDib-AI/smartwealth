# Dialog Component Spacing Rule

## Problem
The Dialog component has built-in padding for `DialogHeader` and `DialogFooter` (`p-6`), but the content area between them has NO horizontal padding by default. This causes a visual spacing mismatch where the content appears to touch the edges.

## Solution
**ALWAYS add `px-6` to any content div between `DialogHeader` and `DialogFooter`.**

## Correct Pattern

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    
    {/* ALWAYS add px-6 here */}
    <div className="px-6 py-4 space-y-4">
      {/* Your content */}
    </div>

    <DialogFooter>
      <Button>Action</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Why This Happens

Looking at `components/ui/dialog.tsx`:
- `DialogHeader` has `p-6 pb-4` (line 114)
- `DialogFooter` has `p-6 pt-4` (line 138)
- Content between them has NO padding

## Quick Reference

- ✅ **DO**: `<div className="px-6 py-4">...</div>`
- ❌ **DON'T**: `<div className="py-4">...</div>` (missing px-6)
- ❌ **DON'T**: `<div className="space-y-4">...</div>` (missing px-6)

## Files to Check

When creating or modifying dialogs, ensure proper spacing in:
- `app/dashboard/**/page.tsx` (inline dialogs)
- `components/**/*-dialog.tsx` (dialog components)
- `components/**/*-modal.tsx` (modal components)
