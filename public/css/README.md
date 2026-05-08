# CSS Load Order

Keep `utilities.css` separate and load the Atlas CSS files in this order on public pages:

1. `tokens.css` - design tokens and shared custom properties.
2. `base.css` - reset, document defaults, body state, skip link, modal lock.
3. `layout.css` - shell, topbar, panels, navigation, shared layout primitives.
4. `components.css` - reusable controls, cards, badges, tags, empty states and shared widgets.
5. `home.css` - home and discovery sections.
6. `catalog.css` - catalog filters, intent chips and collection cards.
7. `guide.css` - guide hero, roadmap, editorial notes, sidebar and quick dock.
8. `checklist.css` - trophy checklist, filters, density and trophy cards.
9. `admin.css` - admin console, editor layout, quality panel and admin-only controls.
10. `responsive.css` - cross-page responsive and accessibility overrides that intentionally run last.

Admin pages should load only the shared foundation plus admin styles:

1. `utilities.css`
2. `tokens.css`
3. `base.css`
4. `layout.css`
5. `components.css`
6. `admin.css`
7. `responsive.css`
