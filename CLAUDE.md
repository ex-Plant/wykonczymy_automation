# Design System & Project Reference

---

## 1. PROJECT OVERVIEW

**Project**: wykonczymy
**Framework**: Next.js 16 (App Router) + React 19
**Styling**: Tailwind CSS 4.x + CSS Variables
**UI Library**: Shadcn UI + Radix UI Primitives
**Language**: TypeScript 5.9 (strict mode)

---

## 2. TOKEN DEFINITIONS & DESIGN TOKENS

### Location

- **Primary**: `/styles/globals.css` (Tailwind CSS 4 theme with CSS variables)
- **Font Config**: `/public/fonts/ABCFavorit.ts`
- **Environment**: `/lib/env.ts` (Zod validated)

### Color Tokens (OKLCH Color Space)

All colors use modern OKLCH color space for perceptual uniformity and better dark mode support.

#### Core Semantic Colors

```css
--background: white /* Page background */ --foreground: oklch(0.145 0 0) /* Primary text */
  --primary: oklch(0.205 0 0) /* Primary action color */ --secondary: oklch(0.97 0 0)
  /* Secondary actions */ --muted: oklch(0.97 0 0) /* Muted/disabled text */
  --accent: oklch(0.97 0 0) /* Accent highlights */ --destructive: oklch(0.577 0.245 27.325)
  /* Error/delete actions */ --border: oklch(0.922 0 0) /* Border colors */ --input: oklch(0.97 0 0)
  /* Input field backgrounds */ --ring: oklch(0.205 0 0) /* Focus ring color */;
```

#### Extended Semantic Colors (Foregrounds)

```css
--primary-foreground: white --secondary-foreground: oklch(0.145 0 0)
  --accent-foreground: oklch(0.145 0 0) --destructive-foreground: white
  --muted-foreground: oklch(0.577 0 0);
```

#### Sidebar Theme (Premium UI Pattern)

```css
--sidebar: oklch(0.985 0 0) /* Sidebar background */ --sidebar-foreground: oklch(0.145 0 0)
  /* Sidebar text */ --sidebar-primary: oklch(0.205 0 0) /* Sidebar primary */
  --sidebar-primary-foreground: white --sidebar-accent: oklch(0.97 0 0)
  --sidebar-accent-foreground: oklch(0.145 0 0) --sidebar-border: oklch(0.922 0 0)
  --sidebar-ring: oklch(0.205 0 0);
```

#### Chart Colors

```css
--chart-1: oklch(0.577 0.245 27.325) /* Red */ --chart-2: oklch(0.577 0.245 341.4) /* Blue */
  --chart-3: oklch(0.559 0.204 136) /* Green */ --chart-4: oklch(0.655 0.202 58.2) /* Amber */
  --chart-5: oklch(0.541 0.221 324) /* Purple */;
```

### Spacing & Sizing Tokens

```css
--radius: 0.625rem /* Base border radius */ --radius-sm: calc(--radius - 4px)
  --radius-md: calc(--radius - 2px) --radius-lg: --radius --radius-xl: calc(--radius + 4px)
  --radius-2xl: calc(--radius + 8px) --radius-3xl: calc(--radius + 12px)
  --radius-4xl: calc(--radius + 16px);
```

Spacing uses Tailwind's default scale (0.25rem increments via `p-1`, `p-2`, etc.).

### Typography Tokens

```css
--font-display:
  'Satoshi',
  'sans-serif' /* Display/heading font */ --font-abc-favorit: var(--font-abc-favorit)
    /* Custom body font */;
```

**Custom Font**: ABC Favorit (Weights: 300, 400)

- Location: `/public/fonts/`
- Weights: 300 (Light), 400 (Regular), 300 Italic

### Breakpoints

Tailwind 4.0 breakpoints (custom overrides in `@theme`):

```css
--breakpoint-sm: 48rem; /* 768px - Tablet */
--breakpoint-md: 64rem; /* 1024px - Tablet Large */
--breakpoint-lg: 80rem; /* 1280px - Desktop */
--breakpoint-xl: 90rem; /* 1440px - Desktop Large */
--breakpoint-2xl: 120rem; /* 1920px - Ultra-wide */
```

**Fest Grid Responsive Columns**:

- Mobile (default): **4 columns**
- SM (768px): **8 columns**
- MD (1024px): **12 columns**
- LG (1280px): **12 columns**
- XL (1440px): **16 columns**
- 2XL (1920px): **16 columns**

### Dark Mode

CSS variables are overridden in `.dark` class:

```css
.dark {
  --background: oklch(0.145 0 0) --foreground: oklch(0.985 0 0) --primary: oklch(0.97 0 0)
    /* ... inverted palette */;
}
```

---

## 3. COMPONENT LIBRARY ARCHITECTURE

### Component Organization

```
components/
├── ui/                          # Core design system components
│   ├── button.tsx              # CVA-based button with 7 variants
│   ├── input.tsx               # Text input with file support
│   ├── input-group.tsx         # Input group wrapper
│   ├── textarea.tsx            # Textarea
│   ├── label.tsx               # Accessible label (Radix)
│   ├── checkbox.tsx            # Accessible checkbox (Radix)
│   ├── select.tsx              # Accessible select dropdown (Radix)
│   ├── separator.tsx           # Visual divider (Radix)
│   ├── dialog.tsx              # Modal dialog (Radix)
│   ├── dropdown-menu.tsx       # Dropdown menu (Radix)
│   ├── field.tsx               # Comprehensive field system
│   ├── tag.tsx                 # Tag component
│   ├── card-box.tsx            # Card wrapper with icon header
│   ├── gradient.tsx            # Gradient decorative component
│   ├── url-pagination.tsx      # URL-based pagination
│   ├── icons/                  # 40+ custom SVG icons
│   │   ├── icon.tsx            # Icon registry & component
│   │   └── icon-variants.ts   # Size variants (xxs-lg)
│   └── loader/                 # Loading indicators
│       ├── loader.tsx
│       ├── spinner.tsx
│       └── fixed-client-loader.tsx
├── forms/                       # Form integration components
│   ├── form-base.tsx           # Form wrapper with validation
│   ├── form-input.tsx          # Form input field
│   ├── form-select.tsx         # Form select field
│   ├── form-checkbox.tsx       # Form checkbox field
│   ├── form-textarea.tsx       # Form textarea field
│   ├── form-file-input.tsx     # Form file upload field
│   ├── form-footer.tsx         # Form footer with submit button
│   ├── form-example.tsx        # Multi-step form example
│   ├── index.ts                # Barrel export
│   ├── types/
│   │   └── form-types.ts
│   ├── hooks/
│   │   ├── form-hooks.ts       # TanStack Form context setup
│   │   ├── use-check-form-errors.ts
│   │   ├── use-form-status.ts
│   │   └── use-sync-form-store.ts
│   ├── schemas_example/        # Zod validation examples
│   │   ├── cart-schema.ts
│   │   ├── cart-item-schema.ts
│   │   └── survey-schema.ts
│   └── stores_example/         # Zustand store examples
│       ├── cart-store.ts
│       └── survey-form-store.ts
├── layouts/                     # Layout components
│   ├── header/
│   │   ├── header.tsx
│   │   ├── nav-desktop.tsx
│   │   ├── nav-mobile.tsx
│   │   ├── nav-group-wrapper.tsx
│   │   └── accessibility/
│   │       ├── accessibility-menu.tsx
│   │       ├── dark-mode-toggle.tsx
│   │       ├── font-size-control.tsx
│   │       ├── language-switcher.tsx
│   │       └── index.ts
│   └── footer/
│       ├── footer.tsx
│       └── navigation-bottom.tsx
├── wrappers/
│   └── animated-list.tsx       # Framer Motion wrapper
├── debug_tools/                 # Dev-only debugging utilities
│   ├── debug-wrapper.tsx
│   ├── debug-tools-triggers.tsx
│   ├── debug-tools-checkbox.tsx
│   ├── grid-visual-helper.tsx
│   ├── debug-screens.tsx
│   └── use-debug-tools.ts
├── theme-provider.tsx           # next-themes provider
├── Logo.tsx                     # Logo component
└── toasts.ts                    # Toast notifications config
```

### Component Architecture Pattern: Slot-Based Composition

Components use `data-slot` attributes for styling and identification:

```typescript
// Example: Button component
<button
  className={cn(buttonVariants({ variant, size, className }))}
  data-slot="button"
  data-variant={variant}
  data-size={size}
  data-state={isLoading ? 'loading' : 'idle'}
  {...props}
>
  {children}
</button>
```

**Data Attributes Used**:

- `data-slot` - Component identifier (e.g., "button", "input")
- `data-variant` - Component variant (e.g., "default", "outline")
- `data-size` - Component size (e.g., "sm", "lg")
- `data-state` - Component state (e.g., "invalid", "loading")
- `data-invalid` - Form validation state

---

## 4. STYLING APPROACH & IMPLEMENTATION

### Tailwind CSS 4.x Setup

**Engine**: PostCSS with `@tailwindcss/postcss` plugin
**Configuration**: `/styles/globals.css` with `@theme` block (Tailwind 4.0 best practices)
**Theme Structure**: All design tokens in single `@theme` block with media queries for responsive variables
**Utilities**: Auto-sorted with `prettier-plugin-tailwindcss`

**CSS Architecture** (`/styles/globals.css`):

1. `@theme` — All design tokens (fonts, breakpoints, radius, colors, grid variables)
2. `.dark` — Dark mode color overrides
3. `@layer components` — Custom component classes (`.fest-grid`, `.fest-container`, typography)
4. `@utility` — Custom utilities (e.g., `scrollbar-hidden`)
5. `@layer base` — Base element resets
6. `@media` queries — Responsive grid column overrides (mobile-first)

### Class Variance Authority (CVA) Pattern

CVA is used for all variant-driven components. Example:

```typescript
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md gap-1.5 px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
```

### Utility Function: `cn()`

Located in `/lib/cn.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Fest Grid System

Custom CSS Grid implementation using CSS variables for responsive column layouts:

**Components**:

- `.fest-container` — Max-width container with responsive padding
- `.fest-grid` — Grid wrapper using `--fest-columns` variable

**Responsive Behavior**:

```css
@theme {
  --fest-columns: 4; /* Mobile */
  --fest-gutter: 0;
  --fest-margin: 1rem;
  --fest-content-width: 21.5rem; /* 344px */
}

@media (min-width: 48rem) {
  --fest-columns: 8;
  --fest-content-width: 45rem;
} /* SM */
@media (min-width: 64rem) {
  --fest-columns: 12;
  --fest-content-width: 62rem;
} /* MD */
@media (min-width: 80rem) {
  --fest-columns: 12;
  --fest-content-width: 78rem;
} /* LG */
@media (min-width: 90rem) {
  --fest-columns: 16;
  --fest-content-width: 88rem;
} /* XL */
@media (min-width: 120rem) {
  --fest-columns: 16;
  --fest-content-width: 88rem;
} /* 2XL */
```

---

## 5. FRAMEWORKS & LIBRARIES

### Core Dependencies

| Package          | Version | Purpose                    |
| ---------------- | ------- | -------------------------- |
| `react`          | 19.2.3  | UI framework               |
| `next`           | 16.1.1  | Meta-framework, App Router |
| `typescript`     | 5.9.3   | Type checking              |
| `tailwindcss`    | 4.1.18  | Styling engine             |
| `shadcn-ui`      | Latest  | Component library          |
| `@radix-ui/*`    | Latest  | UI primitives              |
| `lucide-react`   | 0.563.0 | Icons                      |
| `@tanstack/form` | 1.27.7  | Form state management      |
| `zod`            | 4.3.5   | Schema validation          |
| `zustand`        | 5.0.9   | State management           |
| `framer-motion`  | 12.26.2 | Animation library          |
| `react-toastify` | 11.0.5  | Toast notifications        |

---

## 6. FORM SYSTEM ARCHITECTURE

### TanStack Form Integration

**Form Hook Setup** (`components/forms/hooks/form-hooks.ts`):

```typescript
import { createFormHook, createFormHookContexts } from '@tanstack/react-form'
import { FormCheckbox, FormInput, FormSelect, FormTextarea } from '../index'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

const { useAppForm } = createFormHook({
  fieldComponents: {
    Input: FormInput,
    Select: FormSelect,
    Checkbox: FormCheckbox,
    Textarea: FormTextarea,
  },
  formComponents: {},
  fieldContext,
  formContext,
})

export { fieldContext, formContext, useFieldContext, useFormContext }
export { useAppForm }
```

### Field System (`components/ui/field.tsx`)

Comprehensive form field wrapper supporting:

- **Multiple orientations**: vertical, horizontal, responsive
- **Error handling**: Unique error deduplication, customizable display
- **Accessibility**: Full ARIA support
- **State variants**: valid, invalid, disabled, loading

**Sub-Components**:

- `FieldSet` - Container for field groups
- `FieldLegend` - Legend with variant support
- `FieldGroup` - Field grouping wrapper (orientation: vertical/horizontal)
- `Field` - Main field container
- `FieldLabel` - Associated labels with id linking
- `FieldContent` - Content wrapper for label + description
- `FieldDescription` - Helper/hint text
- `FieldError` - Error messages with deduplication
- `FieldSeparator` - Visual separators
- `FieldTitle` - Field section titles

### Form Validation with Zod

```typescript
import { z } from 'zod'

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  age: z.number().min(18, 'Must be 18+'),
  terms: z.boolean().refine((val) => val === true, 'You must accept terms'),
})

type UserFormData = z.infer<typeof userSchema>
```

---

## 7. ICON SYSTEM

### Custom Icon Component

**Location**: `components/ui/icons/icon.tsx`

40+ custom SVG icons registered in an icon map with a unified `<Icon>` component.

**Size Variants** (from `icon-variants.ts`):

- `xxs` = size-2.5
- `xs` = size-3
- `sm` = size-4
- `md` = size-5
- `lg` = size-6

```typescript
import Icon from '@/components/ui/icons/icon'

<Icon iconName="calendar" size="md" className="text-primary" />
```

---

## 8. PROJECT STRUCTURE

### Next.js App Router Structure

```
app/
├── layout.tsx                 # Root layout (fonts, theme provider, gradient)
├── [[...slug]]/               # Dynamic route catch-all
│   ├── layout.tsx             # Slug layout (header, footer, i18n, debug tools)
│   ├── page.tsx               # Placeholder page
│   ├── error.tsx              # Error boundary
│   ├── loading.tsx            # Loading UI
│   └── not-found.tsx          # 404 page
├── template.tsx               # Framer Motion page transitions
├── global-error.tsx           # Global error boundary
├── robots.ts                  # SEO robots
└── sitemap.ts                 # Sitemap generation
```

### Root Layout

```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={cn(abcFavorit.variable, dmSans.variable, spaceMono.variable, 'antialiased')} suppressHydrationWarning>
      <body className="bg-background dark:bg-background-contrast dark:text-contrast relative overscroll-none scroll-smooth">
        <Gradient placement="top" />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <Gradient placement="bottom" />
      </body>
    </html>
  )
}
```

### Server vs Client Components

**Server Components** (Default): Data fetching, layout, providers, sensitive operations.

**Client Components** (Marked with `'use client'`): Interactive features, event handlers, hooks, forms, debug tools.

---

## 9. INTERNATIONALIZATION

### i18n Setup (`lib/i18n/`)

- **Locales**: Polish (`pl`), English (`en`)
- **Default**: Polish
- **Provider**: `TranslationsProvider` wraps layouts
- **Hooks**: `useTranslation()`, `useLocale()`
- **Files**: `locales/pl.json`, `locales/en.json`

---

## 10. ACCESSIBILITY FEATURES

### Font Size Control (`stores/font-size-store.ts`)

- WCAG 1.4.4 compliant: 100% - 200% scaling
- Persists to localStorage
- Applies to document root via Zustand store

### Accessibility Menu (`components/layouts/header/accessibility/`)

- Dark mode toggle (next-themes)
- Font size control (increment/decrement)
- Language switcher (pl/en)

---

## 11. TYPE SAFETY & VALIDATION

### Environment Variables (`lib/env.ts`)

```typescript
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_FRONTEND_URL: z.string().refine(isValidUrl, 'Invalid URL'),
})

export const env = validateEnv()
```

---

## 12. BUILD & DEVELOPMENT SETUP

### Scripts

```json
{
  "dev": "next dev --turbo",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "format": "prettier --check --ignore-path .gitignore .",
  "format:fix": "prettier --write --ignore-path .gitignore .",
  "typecheck": "tsc --noEmit"
}
```

### Code Quality Tools

**Prettier** (`.prettierrc`): Single quotes, 2-space tabs, trailing commas, 100 print width, no semicolons, `prettier-plugin-tailwindcss`.

**ESLint** (`eslint.config.mjs`): Core rules + TypeScript rules + Next.js rules + React hooks rules.

**Pre-commit Hooks** (Husky + lint-staged): Auto-format TS/JSX, lint JS, format JSON/CSS/MD.

---

## 13. DEBUGGING & DEVELOPMENT TOOLS

### Debug Tools (Dev-only)

Located in `/components/debug_tools/`:

- **grid-visual-helper** — Layout grid overlay reflecting fest-grid responsive columns (4/8/12/16)
- **debug-screens** — Responsive breakpoint visualizer
- **debug-tools-triggers** — Toggle debug features
- **debug-tools-checkbox** — Checkbox utilities

These are wrapped in `DebugWrapper` and removed in production builds.

---

## 14. CREATING NEW COMPONENTS

### Template for Shadcn-style component

```typescript
import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const componentVariants = cva('base-classes', {
  variants: {
    variant: { default: 'variant-classes' },
    size: { default: 'size-classes' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

type ComponentPropsT = React.HTMLAttributes<HTMLElement> & VariantProps<typeof componentVariants>

const Component = React.forwardRef<HTMLElement, ComponentPropsT>(
  ({ className, variant, size, ...props }, ref) => (
    <element
      ref={ref}
      className={cn(componentVariants({ variant, size, className }))}
      data-slot="component"
      data-variant={variant}
      data-size={size}
      {...props}
    />
  ),
)

Component.displayName = 'Component'

export { Component, componentVariants }
```

---

## 15. KEY FILE PATHS

| Purpose               | Path                                  |
| --------------------- | ------------------------------------- |
| **Global Styles**     | `/styles/globals.css`                 |
| **Design Tokens**     | `/styles/globals.css` (CSS variables) |
| **Core Components**   | `/components/ui/`                     |
| **Forms**             | `/components/forms/`                  |
| **Field System**      | `/components/ui/field.tsx`            |
| **Icons**             | `/components/ui/icons/`               |
| **Layouts**           | `/components/layouts/`                |
| **Debug Tools**       | `/components/debug_tools/`            |
| **Utilities**         | `/lib/cn.ts`                          |
| **Environment**       | `/lib/env.ts`                         |
| **i18n**              | `/lib/i18n/`                          |
| **Stores**            | `/stores/`                            |
| **Hooks**             | `/hooks/`                             |
| **Fonts**             | `/public/fonts/`                      |
| **Root Layout**       | `/app/layout.tsx`                     |
| **TypeScript Config** | `tsconfig.json`                       |
| **Prettier Config**   | `.prettierrc`                         |
| **ESLint Config**     | `eslint.config.mjs`                   |

---

## 16. RESOURCES

- **Tailwind CSS**: https://tailwindcss.com/docs
- **Next.js**: https://nextjs.org/docs
- **Shadcn UI**: https://ui.shadcn.com
- **Radix UI**: https://www.radix-ui.com
- **Lucide Icons**: https://lucide.dev
- **TanStack Form**: https://tanstack.com/form
- **Zod**: https://zod.dev
- **Framer Motion**: https://www.framer.com/motion
- **Class Variance Authority**: https://cva.style
