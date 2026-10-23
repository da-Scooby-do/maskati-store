# Animated components in the Maskati shop

All seven were added with `npx shadcn@latest add <url>`. The files sit in `components/kokonutui/` and `components/continuous-tabs.tsx`. Like all shadcn components, they're your own code now, so they were adjusted to the Maskati colours and to Arabic. Every adjustment is marked with a `Maskati:` comment.

## 1. Page flip: the "Our story" book

`components/home.tsx` → `Story()`

```tsx
import PageFlip from "@/components/kokonutui/page-flip";

<div dir="ltr">   {/* the book's mechanics are left-to-right; each page sets its own dir */}
  <PageFlip
    pages={[<Cover />, <PageOne />, <PageTwo />, /* … */ <BackCover />]}
    labels={{ previous: "الصفحة اللي فاتت", next: "الصفحة الجاية", of: "من" }}
  />
</div>
```

The first page is the cover, alone on the right. Drag a corner, click, or use the arrow keys to turn. Size text inside pages in `cqw` so a page scales as one piece.

## 2. Profile dropdown: the customer's menu in the header

`components/site-chrome.tsx` → `SiteHeader()`

```tsx
import ProfileDropdown from "@/components/kokonutui/profile-dropdown";

<ProfileDropdown
  accounts={[{ id: user.id, name, email, avatar: <AvatarFace seed={profile.avatar_seed} /> }]}
  items={[{ label: "طلباتي", icon: <ShoppingBag />, onSelect: () => router.push("/account") }]}
  labels={{ signOut: "تسجيل الخروج", hold: "اضغطي مطوّل", keepHolding: "كمّلي ضغط" }}
  onSignOut={() => db.auth.signOut()}
  showStatus={false}
  showTheme={false}
/>
```

Signing out requires holding the button, so it can't happen by accident.

## 3. Avatar picker: each customer's own face

`app/account/page.tsx` → the **صورتي / My avatar** tab

```tsx
import AvatarPicker, { AvatarFace } from "@/components/kokonutui/avatar-picker";

<AvatarPicker
  defaultValue={{ displayName: "Nour", variant: 0 }}
  onComplete={({ seed, displayName, variant }) => save(seed)}   // saved to profiles.avatar_seed
/>

<AvatarFace seed={profile.avatar_seed} className="size-8 rounded-full" />  // show it anywhere
```

## 4. Marker text: hand-drawn highlights

`components/marked.tsx` wraps the component, so you can mark words inside ordinary text:

| Write | You get |
| --- | --- |
| `[[words]]` | highlighter |
| `__words__` | underline |
| `((words))` | circle |
| `{{words}}` | box |

```tsx
<Marked text="جمالك يبدأ من [[لحظة حب صغيرة]] تمنحيها لنفسك." />
```

This works in the dashboard too: write `[[…]]` in **Home page → Our story**, in **Site text**, or in a **Q&A** answer, and the mark draws on the site. The marks draw in reading order when the text scrolls into view.

## 5. Slide-text button: calls to action

Used in the hero ("Shop now" / "Find your routine"), "View all", the FAQ WhatsApp link, the thank-you page and the account page.

```tsx
import SlideTextButton from "@/components/kokonutui/slide-text-button";

<SlideTextButton href="/shop" text="تسوّقي دلوقتي" hoverText="يلا بينا"
  className="h-12 rounded-full bg-action px-8 text-on-action hover:bg-action-hover" />
```

## 6. Cart button: the bag and every "Add" button

`AddToCartButton` on every product card and product page: "Add +" opens into a "− n +" stepper bound to the real bag. `CartButton` is the bag drawer itself.

```tsx
import CartButton, { AddToCartButton } from "@/components/kokonutui/cart-button";

<AddToCartButton quantity={qtyInBag} max={stock}
  onQuantityChange={(n) => setQty("product", id, n)} label="أضيفي" limitLabel="الحد {x} في الطلب" />

<CartButton items={lines} quantities={qtys} onQuantityChange={(id, n) => …}
  formatMoney={money} onCheckout={() => router.push("/checkout")} />
```

## 7. Continuous tabs: every tab bar on the site

Used for the shop filter (dry / damaged / after colour), the product details (description / how to use / ingredients), sign in / create account, and the account sections.

```tsx
import { ContinuousTabs } from "@/components/continuous-tabs";

<ContinuousTabs layoutId="shop-filter" activeId={need} onChange={setNeed}
  tabs={[{ id: "all", label: "الكل" }, { id: "dry", label: "جاف" }]} />
```

Give each tab bar its own `layoutId` so two bars on one page animate separately.

## Motion across the site

`components/motion.tsx` holds the shared pieces. They all use one easing curve, and all respect the visitor's "reduce motion" setting.

- `Reveal`: fades and lifts content in when it scrolls into view.
- `Stagger` / `StaggerItem`: grids appear one card after another.
- `WordsReveal`: headlines rise word by word.
- `Parallax`: depth while scrolling.
- `ScrollProgress`: the olive line along the top of the page.
- Page changes fade up out of a blur (`app/template.tsx`).
- The hero draws its leaves line by line, zooms its product in from a mask, and drifts a soft light behind.
