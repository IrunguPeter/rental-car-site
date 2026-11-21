export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const hasUrl = !!process.env.POSTGRES_URL;
  const hasDbUrl = !!process.env.DATABASE_URL;
  const pgHost = process.env.PGHOST || 'not set';
  return res.status(200).json({
    hasPostgresUrl: hasUrl,
    hasDatabaseUrl: hasDbUrl,
    pgHost,
    nodeVersion: process.version,
  });
}
