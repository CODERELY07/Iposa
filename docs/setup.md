
# Iposa: Setup & Configuration Documentation

This document provides a consolidated guide for initializing your project and configuring your database schema.

## 1. Project Initialization

Follow these commands to set up your Next.js project:

Bash

```
npx create-next-app@latest my-app --yes
cd my-app
npm run dev

```

### Essential Integrations

-   **Authentication & Supabase Client:** Follow the [Supabase Server-Side Client Guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).
    
-   **Password Authentication:** Refer to the [Supabase Password Auth Guide](https://supabase.com/docs/guides/auth/passwords).
    
-   **Styling:** Install Tailwind CSS via the [Tailwind Next.js Framework Guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
    

## 2. Middleware Configuration

To ensure public access to your home page (`/`) while enforcing authentication on protected routes, update your middleware logic as follows:

TypeScript

```
const {

data: { user },

} =  await  supabase.auth.getUser()

  

// PROTECTED ROUTES LOGIC

const  isHomePage  =  request.nextUrl.pathname  ===  '/'

const  isAuthRoute  =

request.nextUrl.pathname.startsWith('/login') ||

request.nextUrl.pathname.startsWith('/signup') ||

request.nextUrl.pathname.startsWith('/auth')

  

if (!user  &&  !isHomePage  &&  !isAuthRoute) {

const  url  =  request.nextUrl.clone()

url.pathname  =  '/login'

return  NextResponse.redirect(url)

}

  

// If user IS logged in and tries to access /login, send them to /home

if (user  &&  isAuthRoute) {

const  url  =  request.nextUrl.clone()

url.pathname  =  '/home'

return  NextResponse.redirect(url)

}
```

## 3. Database Schema

Execute the following SQL script in your Supabase SQL Editor to initialize your inventory and sales tables:

SQL

```
create table profiles (
  id uuid primary key references auth.users(id),
  full_name text,
  role text default 'cashier',
  created_at timestamp default now()
);

create table categories (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamp default now()
);

create table products (
  id bigint generated always as identity primary key,
  category_id bigint references categories(id),
  name text not null,
  sku text unique,
  price numeric(10,2) not null,
  stock integer default 0,
  created_at timestamp default now()
);

create table inventory_logs (
  id bigint generated always as identity primary key,
  product_id bigint references products(id),
  quantity integer not null,
  type text check (type in ('in', 'out')),
  notes text,
  created_at timestamp default now()
);

create table sales (
  id bigint generated always as identity primary key,
  total numeric(10,2),
  payment numeric(10,2),
  change numeric(10,2),
  created_by uuid references auth.users(id),
  created_at timestamp default now()
);

create table sale_items (
  id bigint generated always as identity primary key,
  sale_id bigint references sales(id),
  product_id bigint references products(id),
  quantity integer,
  price numeric(10,2),
  subtotal numeric(10,2)
);
```