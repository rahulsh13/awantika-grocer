# FreshMart - Grocery E-commerce Mobile App PRD

## Overview
FreshMart is a full-featured cross-platform mobile grocery ecommerce application built with Expo (React Native) frontend, FastAPI backend, and MongoDB database.

## Core Features

### 1. Authentication
- Email/Password login and registration
- Google Sign-in via Emergent OAuth
- Forgot password with reset token
- JWT-based auth with access + refresh tokens
- Brute force protection (5 attempts, 15min lockout)
- Admin seeding on startup

### 2. Home Screen
- Personalized greeting
- AI-powered search bar
- Banner carousel for offers
- Category horizontal scroll (10 categories)
- Featured products grid (10 featured items)

### 3. Product Management
- 22 seeded products across 10 categories
- Product details: name, description, price, discount, images, stock, unit
- Filter by category, price range
- Sort by price (low/high), name
- AI-powered smart search via GPT-5.2

### 4. Cart
- Add/remove items
- Update quantities
- Dynamic total calculation
- Discount calculation with effective prices
- User-specific cart stored in MongoDB

### 5. Checkout
- Address selection
- Payment: Cash on Delivery + Stripe integration
- Coupon code support (WELCOME10, FRESH20)
- Order summary with totals

### 6. Order Management
- Order history with status tracking
- Status: Pending → Confirmed → Delivered
- Order detail with items, address, payment info

### 7. Address Management
- CRUD operations for delivery addresses
- Default address selection

### 8. Admin Panel
- Dashboard with stats (orders, revenue, products, users)
- Order management (confirm, deliver)
- Role-based access control

### 9. Wishlist & Coupons
- Product wishlist toggle
- Coupon validation with min order and max discount

## Tech Stack
- **Frontend**: Expo SDK 54, React Native, expo-router
- **Backend**: FastAPI, Python 3.11
- **Database**: MongoDB
- **Auth**: JWT + Emergent Google OAuth
- **AI**: GPT-5.2 via Emergent LLM Key
- **Payments**: Stripe via emergentintegrations

## Database Collections
- users, categories, products, carts, orders, addresses
- payment_transactions, login_attempts, password_reset_tokens
- wishlists, coupons

## API Endpoints
- Auth: /api/auth/* (register, login, logout, me, refresh, forgot-password, reset-password, google-session)
- Categories: /api/categories
- Products: /api/products (with search/filter/sort)
- Cart: /api/cart/* (get, add, update, remove, clear)
- Addresses: /api/addresses (CRUD)
- Orders: /api/orders (create, list, detail)
- Payments: /api/checkout/* (create-session, status)
- AI: /api/ai/search
- Wishlist: /api/wishlist (get, toggle)
- Coupons: /api/coupons/validate
- Admin: /api/admin/* (dashboard, categories, products, orders, coupons)

## Design
- Organic & Earthy theme: Forest Green (#1E3F20) + Terracotta (#E05236)
- Bottom tab navigation: Home, Categories, Cart, Account
- Rounded cards with subtle borders
- Responsive mobile-first layout
