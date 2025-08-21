# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Shopify theme based on Dawn (Shopify's reference theme), heavily customized for an e-commerce store. The theme includes:

- Custom components with "alc-" and "aless-" prefixes (Alessandro customizations)
- Tailwind CSS integration for styling
- PageFly app integration for landing pages
- Multi-language support (locales directory)
- Flag icons integration for country/language selection

## Development Commands

### Start Development
```bash
npm run dev
```
This runs both Tailwind CSS compilation and Shopify theme development server concurrently.

### Individual Commands
```bash
npm run dev:tailwind    # Watch and compile Tailwind CSS
npm run dev:shopify     # Start Shopify theme dev server
```

### Shopify CLI Commands
```bash
shopify theme dev       # Start development server
shopify theme check     # Run theme validation/linting
shopify theme pull      # Pull theme from Shopify store
shopify theme push      # Push theme to Shopify store
```

## Architecture & File Structure

### Key Directories
- `assets/` - CSS, JavaScript, images, and static assets
- `sections/` - Shopify sections (reusable page components)
- `snippets/` - Reusable template code snippets
- `templates/` - Page templates and their JSON configurations
- `layout/` - Theme layout files (theme.liquid, etc.)
- `locales/` - Translation files for internationalization
- `config/` - Theme settings and configuration

### Custom Component Naming
- `alc-*` prefix: Alessandro custom components (main customizations)
- `aless-*` prefix: Alessandro-specific features
- `pf-*` prefix: PageFly app-generated components

### CSS Architecture
- **Tailwind CSS**: Primary utility framework (compiled from `style.css` to `assets/style.css`)
- **Component CSS**: Individual component stylesheets in `assets/`
- **Custom Colors**: Theme extends Tailwind with `als-gray: #919296`

### JavaScript Architecture
- Modular JavaScript files in `assets/`
- Deferred loading for performance
- PubSub pattern for component communication (`pubsub.js`)

## Theme Customizations

### Custom Sections
- `alc-header.liquid` - Custom header implementation
- `alc-tw-product-grid.liquid` - Tailwind-styled product grid
- `alc-collection-list.liquid` - Custom collection listing
- `alc-breadcrumbs.liquid` - Navigation breadcrumbs

### Custom Snippets
- `alc-tw-product-card.liquid` - Tailwind-styled product cards
- `alc-price.liquid` - Custom price display
- `alc-header-drawer-stacked.liquid` - Mobile navigation drawer
- `aless-mega-menu.liquid` - Custom mega menu

### PageFly Integration
Multiple PageFly-generated sections and templates for landing pages:
- `pagefly-home.liquid`, `pagefly-section.liquid`
- Various `pf-*` template files for specific campaigns

## Development Workflow

1. **File Watching**: Use `npm run dev` to watch both Tailwind and Shopify changes
2. **CSS Changes**: Edit `style.css` (root) → compiles to `assets/style.css`
3. **Liquid Changes**: Edit templates/sections/snippets → auto-sync with Shopify CLI
4. **Asset Changes**: Edit files in `assets/` → auto-sync with Shopify CLI

## Important Notes

### Tailwind Configuration
- Content scanning: `['./**/*.liquid']`
- Custom colors defined in `tailwind.config.js`
- Compiled output goes to `assets/style.css`

### Asset Loading
- CSS loaded with media queries for performance
- JavaScript loaded with defer attribute
- Progressive enhancement approach

### Internationalization
- Extensive locale support (20+ languages)
- Schema files for theme editor translations
- Flag icons for country selection

### Performance Considerations
- Lazy loading for images
- Deferred JavaScript loading
- Critical CSS inlined where appropriate
- Asset preconnection for fonts

## Testing & Quality

Use Shopify's recommended tools:
- `shopify theme check` for linting and validation
- Theme Inspector for performance analysis
- Lighthouse audits for web performance

## Git Workflow

Currently on `aless` branch. Key modified files:
- `assets/component-menu-drawer.css`
- `assets/style.css`
- `layout/theme.liquid`
- `sections/alc-collapsible-content.liquid`
- `snippets/alc-header-drawer-stacked.liquid`