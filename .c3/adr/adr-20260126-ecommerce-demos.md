---
id: adr-20260126-ecommerce-demos
status: deprecated
created: 2026-01-26
deprecated: 2026-01-30
deprecation-reason: Demo content removed in favor of Workflow design system demos
approved-files:
  - previews/screens/pricing/config.yaml
  - previews/screens/pricing/index.tsx
  - previews/screens/cart/config.yaml
  - previews/screens/cart/index.tsx
  - previews/screens/checkout-success/config.yaml
  - previews/screens/checkout-success/index.tsx
  - previews/flows/checkout/index.yaml
---

# ADR: E-commerce Demo Content

> **⚠️ DEPRECATED:** This ADR was deprecated on 2026-01-30. The e-commerce demo content was removed in favor of Workflow design system demos. See commit `f2e06f1`.

## Goal

Add diverse e-commerce demo content to showcase screen and flow preview capabilities.

## Problem

The documentation showcase lacks diverse screen and flow examples. Currently only has login, dashboard, and a basic onboarding flow.

## Decision

Add e-commerce themed demo content:

**Screens:**
- `pricing` - SaaS pricing page with tiered plans
- `cart` - Shopping cart with item list
- `checkout-success` - Order confirmation page

**Flows:**
- `checkout` - Complete checkout journey

## Rationale

E-commerce is a common use case that demonstrates:
- Complex UI layouts (pricing grids, cart items)
- Multi-step flows (checkout process)
- State management (cart contents, billing toggle)

## Affected Layers

Demo content only - no architectural changes.
