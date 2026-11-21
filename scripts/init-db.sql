-- Aurora Car Rental — Vercel Postgres schema
-- Run this against your Vercel Postgres database to create tables.

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Economy',
  price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | settled | overdue
  due_date DATE NOT NULL,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_id ON bookings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
