require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Ghostwear API is running' });
});

const API_KEY = process.env.API_KEY;

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.use(requireApiKey);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

app.get('/captions', async (req, res) => {
  const result = await pool.query('SELECT * FROM captions ORDER BY id');
  res.json(result.rows);
});

app.post('/captions', async (req, res) => {
  const { topic } = req.body;
  if (typeof topic !== 'string' || topic.trim().length === 0) {
    return res.status(400).json({ error: 'topic must be a non-empty string' });
  }
  if (topic.length > 200) {
    return res.status(400).json({ error: 'topic must be 200 characters or fewer' });
  }
  const result = await pool.query(
    'INSERT INTO captions (topic, status) VALUES ($1, $2) RETURNING *',
    [topic.trim(), 'pending']
  );
  res.status(201).json(result.rows[0]);
});

app.patch('/captions/:id', async (req, res) => {
  const { id } = req.params;
  const { caption, status } = req.body;
  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'id must be a number' });
  }
  if (status !== undefined && !['pending', 'done'].includes(status)) {
    return res.status(400).json({ error: "status must be 'pending' or 'done'" });
  }
  const result = await pool.query(
    'UPDATE captions SET caption = COALESCE($1, caption), status = COALESCE($2, status) WHERE id = $3 RETURNING *',
    [caption, status, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'caption not found' });
  res.json(result.rows[0]);
});

app.delete('/captions/:id', async (req, res) => {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'id must be a number' });
  }
  const result = await pool.query('DELETE FROM captions WHERE id = $1 RETURNING *', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'caption not found' });
  res.json({ message: 'deleted', deleted: result.rows[0] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));