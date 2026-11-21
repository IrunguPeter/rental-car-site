# Aurora Car Rental

Static website for the fictional rental car company **Aurora Car Rental** — hero, features, fleet with expandable car cards, services, testimonials carousel, FAQ, contact form and footer.

## Structure

- `index.html` — the main site (single page)
- `admin/index.html` — the admin dashboard (see below)
- `api/leads.js` — validates and stores customer enquiries in Postgres
- `styles/style.css`, `styles/admin.css` — site + admin styles (Space Grotesk + Inter from Google Fonts, fall back to system fonts)
- `scripts/main.js`, `scripts/admin.js` — site + admin behavior
- `assets/favicon.svg` — favicon

## Admin dashboard (`admin/index.html`)

The admin page lets you:

- **Add or edit vehicles** — name, type (Economy/Midsize/SUV/Luxury/Minivan), price per day, photos (upload) and availability status
- **See which vehicles are rented** — badges show each vehicle as **Rented** (with a "Rented until …" note), **Upcoming** or **Available**
- **Record bookings** — vehicle + start/return dates; cancel bookings in the bookings table
- **Utilization by vehicle type** — fraction of each vehicle type currently rented
- **At a glance stats** — total vehicles, rented now, available, upcoming, booked days, utilization

Vehicle, booking, invoice and enquiry data is stored in the configured Postgres database. The admin interface is at `/admin/`; protect it with deployment authentication before using it in production.

## Run locally

```bash
cd /home/peter/projects/rental-car-site
python3 -m http.server 8000
# open http://localhost:8000/ (main site) and http://localhost:8000/admin/ (admin dashboard)
```

## Production configuration

Set `DATABASE_URL` (or `POSTGRES_URL`) for the Postgres connection. Set `ADMIN_API_KEY` in the deployment environment to protect booking, invoice and vehicle write operations; the admin dashboard will request the key once and keep it in session storage for that browser tab. Set `SITE_URL` to the exact public origin so enquiry CORS responses are restricted to the live site.

## Images

Car photos were planned as generated assets, but the image tool returned "Invalid credential" errors in this session, so the site uses clean gradient placeholders with car emoji (economy 🚗, midsize 🚘, SUV 🚙, luxury 🚕, minivan 🚐, hero 🚘). Replace the `card-img` / `hero-car` / `about-img` placeholder blocks with `<img>` tags to add real photos.
