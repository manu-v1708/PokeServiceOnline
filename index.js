// ============================================================
//  POKESERVICE – Backend producción
//  Stack: Node.js · Express · node-fetch · cors · swagger
//  Base de datos: Supabase (Publishable key + RLS policy)
//  Deploy: Render
// ============================================================

const express      = require('express');
const cors         = require('cors');
const swaggerUi    = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Credenciales Supabase ─────────────────────────────────
const SUPABASE_URL = 'https://cazxvbycmisoljeuonct.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Sq2eZV6TTVkkTARpmd9ENQ_l6cPlIdN';

// Nombre exacto de la tabla en Supabase
const TABLE_NAME = 'PokeService';

// ── Middlewares ───────────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin        : '*',
  methods       : ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));

// ── Helper: consulta a Supabase REST API ──────────────────
async function buscarPokemonEnSupabase(nombreOriginal) {
  const fetch = (await import('node-fetch')).default;

  // Capitalizar primera letra para coincidir con los datos en Supabase
  const nombreCapitalizado =
    nombreOriginal.charAt(0).toUpperCase() + nombreOriginal.slice(1).toLowerCase();

  const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}`
    + `?select=id,nombre,peso,altura,imagenfrontal,imagenposterior,poderes`
    + `&nombre=eq.${encodeURIComponent(nombreCapitalizado)}`
    + `&limit=1`;

  console.log(`🔍 URL Supabase: ${url}`);

  const response = await fetch(url, {
    method : 'GET',
    headers: {
      'apikey'       : SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type' : 'application/json',
      'Accept'       : 'application/json'
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Supabase error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  console.log(`📦 Resultado Supabase:`, JSON.stringify(data));
  return data.length > 0 ? data[0] : null;
}

// ── Swagger ───────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title      : 'PokeService API',
      version    : '5.0.0',
      description: 'Microservicio REST – Supabase Publishable key + RLS policy'
    },
    servers: [
      { url: 'https://pokeserviceonline.onrender.com', description: 'Producción' },
      { url: `http://localhost:${PORT}`,               description: 'Local' }
    ]
  },
  apis: ['./index.js']
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ── ENDPOINTS ─────────────────────────────────────────────

/**
 * @swagger
 * /pokemon/{nombre}:
 *   get:
 *     summary: Consultar un Pokémon por nombre
 *     tags: [Pokémon]
 *     parameters:
 *       - in: path
 *         name: nombre
 *         required: true
 *         schema:
 *           type: string
 *         example: sandile
 *     responses:
 *       200:
 *         description: Pokémon encontrado
 *       404:
 *         description: No encontrado
 *       500:
 *         description: Error del servidor
 */
app.get('/pokemon/:nombre', async (req, res) => {
  const nombreRaw = req.params.nombre.trim();

  try {
    const poke = await buscarPokemonEnSupabase(nombreRaw);

    if (!poke) {
      return res.status(404).json({
        error: `Pokémon "${nombreRaw.toLowerCase()}" no encontrado`
      });
    }

    // Parsear poderes (puede venir como string JSON o como array)
    let poderes = [];
    if (Array.isArray(poke.poderes)) {
      poderes = poke.poderes;
    } else {
      try   { poderes = JSON.parse(poke.poderes); }
      catch (_) { poderes = [poke.poderes]; }
    }

    // Mapear columnas Supabase (minúsculas) a camelCase para el frontend
    res.json({
      id             : poke.id,
      nombre         : poke.nombre,
      peso           : poke.peso,
      altura         : poke.altura,
      imagenFrontal  : poke.imagenfrontal,
      imagenPosterior: poke.imagenposterior,
      poderes        : poderes
    });

  } catch (err) {
    console.error('❌ Error consultando Supabase:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health-check
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Servidor activo
 */
app.get('/', (_req, res) => {
  res.json({
    message: '🚀 PokeService API en línea',
    docs   : '/api-docs',
    version: '5.0.0 – Publishable key + RLS policy'
  });
});

// ── Arranque ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 PokeService en puerto ${PORT}`);
  console.log(`🗄️  Supabase → tabla "${TABLE_NAME}"`);
});
