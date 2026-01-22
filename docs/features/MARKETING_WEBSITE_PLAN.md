# Aegira Marketing Website Plan

## Overview

**Framework:** Astro
**Purpose:** Marketing/Landing page to advertise Aegira WHS Management System
**Target Audience:** Business owners, HR managers, Safety officers, Operations managers

---

## Site Structure

```
/                     → Hero + Overview
/features             → Full feature breakdown
/pricing              → Pricing tiers
/demo                 → Request demo form
/about                → Company/Team info
/contact              → Contact form
/blog                 → Articles/Updates (optional)
```

---

## Navigation Header

```
Layout: Logo | Nav Links | CTA Buttons

Nav Links:
- Features
- Pricing
- About

CTA Buttons (header):
- "Book a Demo" (outline/ghost style)
- "Get Started" (primary solid)
```

---

## Page Content Plan

### 1. Homepage (/)

#### Hero Section
```
Headline: "Smarter Workforce. Safer Workplace."
Subheadline: "All-in-one WHS management system for modern businesses.
              Track attendance, manage incidents, ensure compliance."

CTA: Single text link → "See how it works ↓" (scrolls to features)

Note: NO buttons in hero - header CTAs are sufficient
      Keeps the hero clean and focused on the message
```

#### Problem Statement Section
```
Title: "Managing workforce safety shouldn't be complicated"

Pain Points:
- Manual attendance tracking leads to errors
- Paper-based incident reports get lost
- Compliance documentation is scattered
- No real-time visibility into team status
```

#### Solution Section
```
Title: "Aegira brings everything together"

Key Points:
- Real-time check-in/check-out tracking
- Digital incident reporting with AI analysis
- Automated compliance monitoring
- Role-based dashboards for every level
```

#### Feature Highlights (3-4 cards)
```
1. Smart Attendance
   - GPS-verified check-ins
   - Automatic overtime calculation
   - Exception request workflow

2. Incident Management
   - Mobile-friendly reporting
   - AI-powered severity analysis
   - Investigation workflow

3. Team Management
   - Hierarchical team structure
   - Performance metrics
   - Workload monitoring

4. Compliance & Reports
   - Official form generation
   - Audit-ready documentation
   - Custom report builder
```

#### Testimonials Section (Slider)
```
Title: "Trusted by safety-first companies"

Layout: Horizontal slider/carousel with arrows
        Auto-slide every 5 seconds
        Dots indicator at bottom

Card Design:
┌─────────────────────────────────────────┐
│  ★★★★★                                  │
│                                         │
│  "Aegira transformed how we manage      │
│   our workforce. No more paper forms,   │
│   no more lost incident reports."       │
│                                         │
│  [Avatar] Juan Dela Cruz                │
│           Safety Officer                │
│           ABC Construction Co.          │
└─────────────────────────────────────────┘

Sample Testimonials (based on actual Aegira features):

1. ★★★★★
   "Yung mobile check-in sobrang convenient! Hindi na kailangan
    pumila sa bundy clock. GPS verified pa kaya accurate talaga
    yung attendance records namin."
   — Juan Reyes, Construction Worker, BuildRight Corp

2. ★★★★★
   "Dati kapag may incident, papel at papel. Ngayon isang click
    lang sa phone, may photo attachment pa. Yung AI severity
    analysis nila nakakatulong mag-prioritize ng urgent cases."
   — Maria Santos, Safety Officer, Logistics Plus Inc.

3. ★★★★★
   "As a Team Lead, nakikita ko agad sino nag-check-in, sino
    late, sino nag-request ng exception. Real-time lahat!
    Hindi na ako naghahabol ng reports."
   — Roberto Garcia, Team Leader, Metro Manufacturing

4. ★★★★★
   "Yung Exception Request feature grabe! Workers can request
    leave or schedule changes, automatic notification sa akin
    for approval. Walang lost papers."
   — Ana Mendoza, Supervisor, Pacific Builders

5. ★★★★★
   "Dashboard ng Aegira pinaka-helpful. Nakikita ko lahat -
    incidents this month, overtime hours, team performance.
    One glance lang alam ko na status ng buong team."
   — Carlos Tan, Operations Manager, SafeWork Industries

6. ★★★★☆
   "Yung official form generation saved us hours! Before manual
    fill-up ng DOLE forms. Ngayon auto-populate na based sa
    incident data. Audit-ready agad!"
   — Linda Cruz, HR Compliance, First Safety Corp

7. ★★★★★
   "Incident investigation workflow nila solid. Assignment ng
    investigator, tracking ng progress, hanggang resolution.
    Lahat documented properly."
   — Mark Villanueva, WHS Manager, Industrial Solutions PH
```

#### Stats Section
```
Layout: 4 columns, large numbers with labels

┌──────────┬──────────┬──────────┬──────────┐
│  500+    │  10K+    │   99.9%  │   40%    │
│ Companies│ Workers  │  Uptime  │ Less     │
│ Trust Us │ Tracked  │          │ Incidents│
└──────────┴──────────┴──────────┴──────────┘

Animated counter on scroll (count up effect)
```

#### CTA Section
```
Title: "Ready to modernize your workplace safety?"
CTA: "Get Started Today"
```

---

### 2. Features Page (/features)

#### Attendance Management
- GPS-verified mobile check-in
- Real-time status dashboard
- Automatic late detection
- Overtime tracking
- Exception request system
- Bulk operations for supervisors

#### Incident Management
- Multi-type incident support (injury, near-miss, hazard, illness)
- Photo/evidence attachment
- AI severity analysis
- Investigation assignment
- Resolution tracking
- Official form generation

#### Team & Hierarchy
- Multi-level role system (Admin → Executive → Supervisor → Team Lead → Worker)
- Team-based organization
- Cross-team visibility for managers
- Member profile & history

#### Reporting & Analytics
- Real-time dashboards
- Trend analysis
- Compliance reports
- Export to PDF/Excel
- Custom date ranges

#### Security & Compliance
- Role-based access control
- Audit logging
- Data encryption
- Multi-tenant architecture

---

### 3. Pricing Page (/pricing)

#### Suggested Tiers

```
STARTER
- Up to 25 workers
- Basic attendance
- Incident reporting
- Email support
Price: ₱2,999/month

PROFESSIONAL
- Up to 100 workers
- All Starter features
- Analytics dashboard
- Priority support
- API access
Price: ₱7,999/month

ENTERPRISE
- Unlimited workers
- All Professional features
- Custom integrations
- Dedicated support
- SLA guarantee
Price: Custom pricing
```

#### FAQ Section
- What's included in each tier?
- Can I upgrade/downgrade?
- Is there a free trial?
- What payment methods accepted?
- Is my data secure?

---

### 4. Demo Page (/demo)

#### Form Fields
- Company Name
- Contact Person
- Email
- Phone
- Number of Employees
- Industry
- Message/Requirements

#### What to expect
- 30-minute live demo
- Custom walkthrough based on your needs
- Q&A session
- No commitment required

---

### 5. About Page (/about)

#### Company Story
- Why Aegira was built
- Mission: "Making workplaces safer through technology"
- Vision: "Every worker accounted for, every incident prevented"

#### Values
- Safety First
- Simplicity
- Reliability
- Innovation

---

### 6. Contact Page (/contact)

#### Contact Methods
- Email: support@aegira.com
- Phone: (placeholder)
- Address: (placeholder)

#### Contact Form
- Name
- Email
- Subject
- Message

---

## Design Guidelines

### Color Palette
```css
--primary: #2563eb;      /* Blue - Trust, Reliability */
--secondary: #10b981;    /* Green - Safety, Success */
--accent: #f59e0b;       /* Amber - Attention, Alerts */
--dark: #1e293b;         /* Slate - Professional */
--light: #f8fafc;        /* Off-white - Clean */
```

### Typography
```
Headings: Inter or Plus Jakarta Sans (Bold)
Body: Inter (Regular)
```

### Design Style
- Clean, modern, professional
- Lots of whitespace
- Subtle gradients
- Rounded corners (8-12px)
- Soft shadows
- Icons: Lucide or Heroicons

---

## Astro Project Structure

```
/
├── src/
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── Hero.astro
│   │   ├── FeatureCard.astro
│   │   ├── PricingCard.astro
│   │   ├── TestimonialCard.astro
│   │   ├── ContactForm.astro
│   │   └── ui/
│   │       ├── Button.astro
│   │       ├── Card.astro
│   │       └── Badge.astro
│   ├── layouts/
│   │   └── MainLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── features.astro
│   │   ├── pricing.astro
│   │   ├── demo.astro
│   │   ├── about.astro
│   │   └── contact.astro
│   └── styles/
│       └── global.css
├── public/
│   ├── images/
│   │   ├── hero-illustration.svg
│   │   ├── features/
│   │   └── logos/
│   └── favicon.svg
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

---

## Recommended Astro Integrations

```bash
# Initialize project
npm create astro@latest aegira-website

# Add integrations
npx astro add tailwind
npx astro add react      # For interactive components
npx astro add sitemap    # SEO
npx astro add partytown  # Analytics optimization
```

---

## SEO Checklist

- [ ] Meta titles & descriptions per page
- [ ] Open Graph tags for social sharing
- [ ] Structured data (Organization, Product)
- [ ] Sitemap.xml
- [ ] robots.txt
- [ ] Alt text for images
- [ ] Fast loading (Lighthouse 90+)

---

## Content Copywriting

### Taglines to use
- "Smarter Workforce. Safer Workplace."
- "Safety Made Simple"
- "Every Worker. Every Incident. Every Day."
- "Where Safety Meets Simplicity"
- "Your Workplace, Fully Managed"

### Key Messages
1. **Simplicity** - Easy to use, no training needed
2. **Visibility** - Real-time insights at every level
3. **Compliance** - Always audit-ready
4. **Mobile-first** - Works anywhere, any device

---

## Next Steps

1. [ ] Set up Astro project with Tailwind
2. [ ] Create base layout and components
3. [ ] Build homepage sections
4. [ ] Design feature illustrations/icons
5. [ ] Implement contact/demo forms
6. [ ] Add animations (view transitions)
7. [ ] SEO optimization
8. [ ] Deploy to Vercel/Netlify

---

## Inspiration Sites

- Linear.app (clean, modern SaaS)
- Notion.so (clear value prop)
- Stripe.com (great documentation style)
- SafetyCulture.com (similar industry)
