// ============================================================
//  POKESERVICE – Backend para producción
//  Stack: Node.js · Express · node-fetch · cors · swagger
//  Base de datos: Supabase (PostgreSQL via REST API)
//  Deploy: Render
// ============================================================
//
//  Variables de entorno que debes configurar en Render:
//    SUPABASE_URL   = https://cazxvbycmisoljeuonct.supabase.co
//    SUPABASE_KEY   = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (la apikey anon)
//
//  Instalación de dependencias (package.json):
//    npm install express cors swagger-ui-express swagger-jsdoc node-fetch
// ============================================================

const express      = require('express');
const cors         = require('cors');
const swaggerUi    = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Credenciales Supabase (desde variables de entorno en Render) ──
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cazxvbycmisoljeuonct.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhenh2YnljbWlzb2xqZXVvbmN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTEwMzUsImV4cCI6MjA5MzQ4NzAzNX0.dvNlPXVieeaQ8louQrNMP7MTxPOpUUQCIrxfh4gkXjM';

// Nombre exacto de la tabla en Supabase (respeta mayúsculas)
const TABLE_NAME   = 'PokeService';

// ────────────────────────────────────────────────────────────
//  Middlewares
// ────────────────────────────────────────────────────────────
app.use(express.json());

// CORS abierto para permitir peticiones desde GitHub Pages
app.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));

// ────────────────────────────────────────────────────────────
//  Helper: consulta a Supabase REST API
//  Supabase expone cada tabla en: /rest/v1/<tabla>
//  Usamos el filtro ?nombre=eq.<valor> para buscar por nombre
// ────────────────────────────────────────────────────────────
async function buscarPokemonEnSupabase(nombre) {
  // Importar fetch (compatible con Node 18+ nativo o node-fetch)
  const fetch = (await import('node-fetch')).default;

  // Capitalizar primera letra para coincidir con cómo están guardados en Supabase
  const nombreCapitalizado = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?nombre=eq.${encodeURIComponent(nombreCapitalizado)}&limit=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey'        : SUPABASE_KEY,
      'Authorization' : `Bearer ${SUPABASE_KEY}`,
      'Content-Type'  : 'application/json',
      // Pedir que Supabase devuelva un solo objeto en lugar de array
      'Accept'        : 'application/json'
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Supabase error ${response.status}: ${errText}`);
  }

  // Supabase siempre devuelve un array; tomamos el primer elemento
  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}

// ────────────────────────────────────────────────────────────
//  Swagger / OpenAPI
// ────────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title       : 'PokeService API',
      version     : '1.0.0',
      description : 'Microservicio REST para consultar Pokémon desde Supabase.'
    },
    servers: [
      { url: 'https://pokeserviceonline.onrender.com', description: 'Producción (Render)' },
      { url: `http://localhost:${PORT}`,               description: 'Local' }
    ]
  },
  apis: ['./index.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ────────────────────────────────────────────────────────────
//  ENDPOINTS
// ────────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Pokemon:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 6
 *         nombre:
 *           type: string
 *           example: charizard
 *         peso:
 *           type: string
 *           example: "90.5 kg"
 *         altura:
 *           type: string
 *           example: "1.7 m"
 *         imagenFrontal:
 *           type: string
 *         imagenPosterior:
 *           type: string
 *         poderes:
 *           type: array
 *           items:
 *             type: string
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 */

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
 *         example: charizard
 *     responses:
 *       200:
 *         description: Pokémon encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pokemon'
 *       404:
 *         description: No encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error del servidor
 */
app.get('/pokemon/:nombre', async (req, res) => {
  const nombre = req.params.nombre.trim().toLowerCase();

  try {
    const poke = await buscarPokemonEnSupabase(nombre);

    if (!poke) {
      return res.status(404).json({ error: `Pokémon "${nombre}" no encontrado` });
    }

    // El campo poderes puede llegar como string JSON o como array (Supabase lo guarda como JSONB o TEXT)
    let poderes = [];
    if (Array.isArray(poke.poderes)) {
      poderes = poke.poderes;
    } else {
      try { poderes = JSON.parse(poke.poderes); } catch (_) { poderes = [poke.poderes]; }
    }

    res.json({
      id              : poke.id,
      nombre          : poke.nombre,
      peso            : poke.peso,
      altura          : poke.altura,
      imagenFrontal   : poke.imagenFrontal,
      imagenPosterior : poke.imagenPosterior,
      poderes         : poderes
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
    message : '🚀 PokeService API en línea',
    docs    : '/api-docs',
    version : '2.0.0 – Supabase'
  });
});

// ────────────────────────────────────────────────────────────
//  Arranque
// ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 PokeService escuchando en puerto ${PORT}`);
  console.log(`📖 Swagger UI: /api-docs`);
  console.log(`🗄️  Base de datos: Supabase → tabla "${TABLE_NAME}"`);
});