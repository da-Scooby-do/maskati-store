# Maskati · ماسكاتي

Online store for Maskati hair care in Egypt. It is Arabic first, with English alongside.

- **Shop** (`/`): home page, products, routines, a hair consultation, reviews, FAQ, bag and checkout. Delivery is priced by governorate. Customers pay cash on delivery, by InstaPay or by Vodafone Cash.
- **Owner dashboard** (`/admin`): overview with sales, orders, products and photos, routines, review approval, home page sections, announcement bar, Q&A, contact and social links, and shipping fees.

## Stack

- Static HTML, CSS and JavaScript with no build step, hosted on Vercel.
- Supabase (Postgres, Auth, Storage) is the database. The browser uses the public anon key. Row-level security protects every table, and orders are priced on the server by the `place_order` function.

## Owner access

1. Open `/admin`, choose **Create owner account** and sign up with an email listed in `public.admin_emails`.
2. Click the confirmation link Supabase emails you, then sign in at `/admin`.

## Orders, Bosta and emails

- Statuses: Confirmed → With courier → Delivered, plus Cancelled and Returned. Orders only move forward. Every move adds a history entry and emails the customer. Cancelled and Returned put the stock back.
- Checkout needs a customer account. `place_order` reprices everything on the server, checks stock, applies promo codes, and refuses repeat orders within 25 seconds or more than 10 an hour.
- Delivery price comes from the delivery zone of the chosen governorate (or the flat rate). Customers also pick a Bosta district.
- **Bosta** (`supabase/functions/bosta`): Send to Bosta creates the delivery and moves the order to With courier. Bosta's webhook then moves it to Delivered or Returned. The function re-reads every webhook from Bosta, so a forged call can't change an order.
- **Emails** (`supabase/functions/notify-order`): sent through Resend in the customer's language. Each history entry stores the result.

Secrets to add in Supabase → Edge Functions → Secrets:

| Secret | Where to get it |
| --- | --- |
| `BOSTA_API_KEY` | Bosta → Settings → API Integration |
| `RESEND_API_KEY` | resend.com → API Keys |

## Customer accounts

Shoppers can create an account from the account icon in the header (`/#/account`). They see their orders and save their delivery details, which fill in checkout for them. Guests can still order without an account. Any login whose email is not in `admin_emails` is a customer and cannot open the dashboard.

To add another owner, run:

```sql
insert into public.admin_emails (email) values ('someone@example.com');
```

## Design

Colours, type and voice come from the Maskati design system. The fonts are Bodoni Moda (standing in for RoxboroughCF), Libre Caslon Text and Amiri. The product images in `assets/products/` are placeholder illustrations. Replace them with real photos from the dashboard.
