// File: server.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();

// ──────────────────────────────────────────────────────────────────────────────
// 0) Servir dinámicamente form-sender.js con la API key embebida y escape seguro
app.get('/form-sender.js', (req, res) => {
  const apiKey = process.env.API_KEY;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
(function(){
  // La clave se inyecta con JSON.stringify para escapar comillas automáticamente
  var API_KEY = ${JSON.stringify(apiKey)};
  window.initHubspotForm = function(portalId, formId, targetSelector){
    function renderForm(){
      hbspt.forms.create({
        region:   'na1',
        portalId: portalId,
        formId:   formId,
        target:   targetSelector,
        onFormSubmit: function($form){
          var data = {};
          $form.serializeArray().forEach(function(f){
            data[f.name] = f.value;
          });
          // Si quieres incluir visitorId del fingerprint:
          data.visitorId = localStorage.getItem('visitorId') || '';
          fetch('https://backend-b2b-a3up.onrender.com/api/responses/contact', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key':    API_KEY
            },
            body: JSON.stringify(data)
          })
          .then(function(res){ console.log('✅ B2B saved:', res.status); })
          .catch(function(err){ console.error('❌ B2B error:', err); });
        }
      });
    }
    // Si la librería de HS Forms no está cargada, la inyectamos
    if (!window.hbspt) {
      var s = document.createElement('script');
      s.src = 'https://js.hsforms.net/forms/v2.js';
      s.onload = renderForm;
      document.head.appendChild(s);
    } else {
      renderForm();
    }
  };
})();
  `);
});
// ──────────────────────────────────────────────────────────────────────────────

// 1) CORS: permite sólo tus dominios de frontend
app.use(cors({
  origin: [
    'https://b2b.occ.com.mx',
    'https://reclutamiento.occ.com.mx'
  ]
}));

// 2) Parse JSON bodies
app.use(express.json());

// 3) Middleware de API Key para /api/responses/*
function checkApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
  }
  next();
}

// 4) Conexión a MongoDB
if (!process.env.MONGO_URI) {
  console.error('❌ Falta la variable MONGO_URI');
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB conectado'))
.catch(err => {
  console.error('❌ Error MongoDB:', err);
  process.exit(1);
});

// 5) Montar rutas protegidas por API Key
app.use('/api/responses', checkApiKey, responsesRouter);

// 6) Health-check
app.get('/', (_req, res) => res.send('API OCC B2B viva ✔️'));

// 7) Levantar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor escuchando en puerto ${PORT}`));
