const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000; // Render asigna el puerto automáticamente

app.use(express.json());
app.use(cors());

// Configuración de Swagger
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Pokédex Online API',
      version: '1.0.0',
      description: 'Microservicio corriendo en Render y conectado a Supabase.',
    },
    servers: [{ url: `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` || `http://localhost:${PORT}` }],
  },
  apis: ['./index.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /pokemon/{nombre}:
 *   get:
 *     summary: Busca un Pokémon por nombre.
 */
app.get('/PokeService/:nombre', async (req, res) => {
  const { nombre } = req.params;
  const query = 'SELECT * FROM "PokeService" WHERE nombre = $1';

  try {
    const results = await db.query(query, [nombre.toLowerCase()]);

    if (results.rows.length > 0) {
      const poke = results.rows[0];
      
      // En Postgres, si guardaste el JSON como texto, lo parseamos
      let poderes = poke.poderes;
      if (typeof poderes === 'string') {
        try { poderes = JSON.parse(poke.poderes); } catch (e) { poderes = [poke.poderes]; }
      }

      res.json({
        nombre: poke.nombre,
        peso: poke.peso,
        altura: poke.altura,
        imagenfrontal: poke.imagenfrontal, // Postgres suele poner nombres en minúscula
        imagenposterior: poke.imagenposterior,
        poderes: poderes
      });
    } else {
      res.status(404).json({ error: 'Pokémon no registrado en el herbario.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor de base de datos.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor listo en el puerto ${PORT}`);
});