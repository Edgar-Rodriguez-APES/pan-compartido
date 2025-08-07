---
inclusion: always
---

# Pan Compartido - Product & Architecture Guidelines

Pan Compartido is a multi-tenant donation management system for Catholic parishes facilitating food distribution to families in need.

## Architecture Patterns

- **Multi-tenant isolation**: All data operations must include tenant context. Use `req.tenant` middleware for tenant-scoped queries
- **Service layer pattern**: Business logic resides in services (`/services`), controllers handle HTTP concerns only
- **Repository pattern**: Database operations abstracted through models with Knex query builder
- **Middleware chain**: Authentication → Tenant resolution → Route handlers

## User Roles & Permissions

- **Parish Admin (priest)**: Full tenant management, campaign oversight, branding configuration
- **Parishioner**: Donation creation, campaign viewing, profile management
- **Supplier**: Auction participation, product management (future feature)

## Code Conventions

- **API Routes**: RESTful design with tenant-scoped endpoints (`/api/tenants/:tenantId/...`)
- **Error Handling**: Use centralized error middleware, return consistent error format
- **Validation**: Joi schemas for all request validation
- **Database**: PostgreSQL with Knex migrations, Redis for caching and sessions
- **Authentication**: JWT tokens with tenant context, bcrypt for password hashing

## Key Business Rules

- All campaigns belong to a specific tenant (parish)
- Donations are immutable once processed
- Payment processing through Stripe/Wompi with webhook validation
- WhatsApp notifications for campaign updates and donation confirmations
- Branding customization per tenant (colors, logos, contact information)

## Mobile-First Design

- Responsive design prioritizing mobile experience
- Touch-friendly interfaces for donation flows
- Offline-capable features where possible