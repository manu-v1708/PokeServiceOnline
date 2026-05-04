const { Pool } = require('pg');

// En Render, configuraremos la variable DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Obligatorio para conectar con Supabase desde Render
  }
});

// Verificación de conexión
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error adquiriendo el cliente:', err.stack);
  }
  console.log('✅ Conexión exitosa a la base de datos en Supabase');
  release();
});

module.exports = pool;