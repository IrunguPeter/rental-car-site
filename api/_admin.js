export function requireAdmin(req, res) {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) return true;
  if (req.headers['x-admin-key'] === configuredKey) return true;
  res.status(401).json({ error: 'Admin authentication required' });
  return false;
}
