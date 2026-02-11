# 🎯 WordPress Frontend

A modern Next.js frontend application designed for seamless WordPress REST API integration. Built with TypeScript, featuring comprehensive form handling, state management, and developer tools.

## 🚀 Quick Start

### Prerequisites

- **Node.js 24** (managed via Mise)
- **WordPress Backend** with REST API enabled
- **Application Password** configured in WordPress

### Installation

1. **Clone the repository**

   ```sh
   git clone <repository-url>
   cd fest-frontend
   ```

2. **Install dependencies**

   ```sh
   npm install
   ```

3. **Environment Configuration**

   ```sh
   cp .env.local.example .env.local
   ```

   Configure your environment variables:

   ```env
   # Public vars (available in browser)
   NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
   NEXT_PUBLIC_WORDPRESS_API_URL=https://your-wordpress-site.com/wp-json

   # Server-only vars (never exposed to browser)
   WORDPRESS_USERNAME=your-wordpress-username
   WORDPRESS_APPLICATION_PASSWORD=your-generated-app-password
   REVALIDATE_TOKEN=your-revalidate-token
   PREVIEW_TOKEN=your-preview-token
   ```

4. **Start development server**

   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open [http://localhost:3000](http://localhost:3000)

## 🛠️ Tech Stack

### Core Framework

- **Next.js 16** - React framework with App Router
- **React 19** - UI library with concurrent features
- **TypeScript** - Type-safe JavaScript with strict mode

### Styling & UI

- **Tailwind CSS 4.x** - Utility-first CSS framework
- **Shadcn UI** - Accessible component library built on Radix UI
- **Framer Motion** - Production-ready animations
- **Lucide React** - Beautiful icon library

### Forms & Validation

- **TanStack Form** - Modern, framework-agnostic form library
- **Zod** - TypeScript-first schema validation

### State Management

- **Zustand** - Lightweight, scalable state management

### Backend Integration

- **WordPress REST API** - Headless CMS integration
- **Advanced Custom Fields** - ACF content support

### Development Tools

- **Mise** - Cross-platform version manager
- **ESLint** - Code linting with Next.js rules
- **Prettier** - Code formatting
- **Husky** - Git hooks for code quality
- **lint-staged** - Pre-commit linting

### Additional Libraries

- **React Toastify** - Toast notifications
- **Sharp** - High-performance image processing
- **usehooks-ts** - Extended React hooks
- **server-only** - Server-side code isolation

## 📁 Project Structure

```
├── app/                          # Next.js App Router
│   ├── [[...slug]]/             # Dynamic catch-all routes
│   │   ├── layout.tsx           # Layout with providers
│   │   ├── page.tsx             # Dynamic page rendering
│   │   ├── loading.tsx          # Loading UI
│   │   ├── error.tsx            # Error boundary
│   │   └── not-found.tsx        # 404 page
│   ├── api/                     # API routes
│   │   ├── preview/             # Preview functionality
│   │   └── revalidate/          # Cache revalidation
│   ├── template.tsx             # Page transitions (Framer Motion)
│   └── global-error.tsx         # Global error boundary
├── components/                  # React components
│   ├── ui/                      # Shadcn UI components
│   ├── forms/                   # TanStack Form components
│   │   ├── hooks/               # Form-specific hooks
│   │   ├── schemas_example/     # Zod validation examples
│   │   └── stores_example/      # Zustand store examples
│   ├── layouts/                 # Layout components
│   │   ├── header/              # Header component
│   │   └── footer/              # Footer component
│   ├── wordpress/               # WordPress integration
│   │   ├── templateDecider.tsx  # Template routing logic
│   │   ├── wpImage.tsx          # WordPress image component
│   │   └── previewModeBanner.tsx
│   └── debug_tools/             # Development debugging
├── lib/                         # Utility functions
│   ├── api/                     # API client & helpers
│   ├── cn.ts                    # Class merge utility
│   ├── env.ts                   # Environment validation
│   └── isValidUrl.ts            # URL validation helper
├── hooks/                       # Custom React hooks
├── config/                      # Configuration files
│   ├── wordpress.ts             # WordPress integration config
│   └── i18n.ts                  # i18n configuration
├── styles/                      # Global styles
│   └── globals.css              # Tailwind and theme setup
├── types/                       # TypeScript definitions
│   └── api.ts                   # API response types
└── public/                      # Static assets
```

## 🎨 Key Features

### WordPress Integration

- **REST API Client**: Type-safe WordPress API integration
- **Custom Post Types**: Support for custom content types
- **Advanced Custom Fields**: ACF content rendering
- **SEO Optimization**: Dynamic meta tags and sitemap generation

### Form System

- **TanStack Form**: Modern form library with advanced validation
- **Complex Forms**: Multi-step surveys with state persistence
- **Field Types**: Input, textarea, select, checkbox components
- **Validation**: Zod schema validation with custom error messages

### Developer Experience

- **Debug Tools**: Built-in debugging utilities for development
- **Hot Reload**: Fast development with Next.js Turbo mode
- **Type Safety**: Full TypeScript coverage with strict mode
- **Code Quality**: Automated linting and formatting

### UI Components

- **Shadcn UI**: Accessible, customizable component library
- **Animations**: Smooth page transitions with Framer Motion
- **Responsive Design**: Mobile-first approach
- **Dark Mode Ready**: Theme system prepared

## 📝 Development Scripts

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start development server with Turbo mode |
| `npm run build`      | Create production build                  |
| `npm run start`      | Start production server                  |
| `npm run lint`       | Run ESLint code analysis                 |
| `npm run format`     | Check code formatting                    |
| `npm run format:fix` | Auto-fix formatting issues               |
| `npm run typecheck`  | Run TypeScript type checking             |
| `npm run static`     | Build static export                      |

## 🔧 Configuration

### WordPress Integration

Configure custom post types in `config/wordpress.ts`:

```typescript
export type PostType = 'pages' | 'posts'

export const wordpress = {
  postTypes: ['pages', 'posts'] as PostType[],
  defaultPostType: 'pages' as PostType,
} as const
```

### Environment Variables

All environment variables are validated at runtime using Zod schemas in `lib/env.ts`. The validation ensures type safety and fails fast on invalid configurations.

#### Adding New Environment Variables

1. **Add to Zod Schema**: Define the new variable in the `envSchema` object:

```typescript
const envSchema = z.object({
  // Existing variables...
  NEXT_PUBLIC_FRONTEND_URL: z.string().refine(isValidUrl, 'Invalid URL'),
  NEXT_PUBLIC_WORDPRESS_API_URL: z.string().refine(isValidUrl, 'Invalid URL'),
  WORDPRESS_USERNAME: z.string().min(1),
  WORDPRESS_APPLICATION_PASSWORD: z.string().min(1),

  // Add new variables here
  NEW_PUBLIC_VAR: z.string().min(1), // Public (NEXT_PUBLIC_*)
  NEW_SERVER_VAR: z.string().min(1), // Server-only
  OPTIONAL_VAR: z.string().optional(), // Optional variable
  URL_VAR: z.string().refine(isValidUrl), // URL validation
})
```

2. **Add to .env.local**: Include the variable in your environment file:

```env
# Add your new environment variables
NEW_PUBLIC_VAR=your-public-value
NEW_SERVER_VAR=your-server-value
OPTIONAL_VAR=optional-value
URL_VAR=https://example.com
```

3. **Usage in Code**: Import and use the validated environment:

```typescript
import { env } from '@/lib/env'

// Type-safe access with autocomplete
const apiUrl = env.NEXT_PUBLIC_WORDPRESS_API_URL
const username = env.WORDPRESS_USERNAME
```

#### Environment Variable Types

- **Public Variables** (`NEXT_PUBLIC_*`): Available in browser and server
- **Server Variables**: Only available on server-side (never exposed to browser)
- **Optional Variables**: Use `.optional()` for non-required variables
- **URL Validation**: Use `.refine(isValidUrl)` for URL validation

The application will fail to start if required environment variables are missing or invalid, providing clear error messages for debugging.

### Template System

Use the `TemplateDecider` component to route content based on WordPress post types and templates:

```tsx
// components/wordpress/templateDecider.tsx
export const TemplateDecider = ({ type, pageContent }) => {
  // Routing logic based on post type and template
}
```

### Environment Setup

Ensure your production environment has:

- Node.js 24+
- WordPress backend with REST API enabled
- Matching preview and revalidation secrets

## 🔧 Development Workflow

### Code Quality

The project uses automated code quality tools:

1. **Pre-commit hooks** run linting and formatting
2. **TypeScript** validates types on every build
3. **ESLint** enforces coding standards
4. **Prettier** ensures consistent formatting

### Debug Tools

Development-only debugging features:

- **Grid Visualizer**: Toggle layout grid overlay
- **Outline Debugger**: Highlight component boundaries
- **Layer Inspector**: Debug component stacking
