const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

if (!process.env.GEMINI_API_KEY?.trim()) {
  console.error(
    'Missing GEMINI_API_KEY in backend/.env — get one at https://aistudio.google.com/apikey'
  );
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3001;
const SERVER_BUILD = '2026-03-24-debug-v3';
const GEMINI_MODELS = (process.env.GEMINI_MODELS || 'gemini-3.5-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const GEMINI_MAX_RETRIES = 3;
const RETRYABLE_GEMINI_STATUS = new Set([429, 500, 503]);
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

app.use(cors());
app.use(express.json());

// Set up multer for file upload (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
});

// Initialize Google Gen AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Schema for Gemini JSON output
const foodAnalysisSchema = {
  type: 'OBJECT',
  properties: {
    isFood: { type: 'BOOLEAN' },
    isRealPhoto: { type: 'BOOLEAN' },  // false for drawings, cartoons, AI art, illustrations
    dishName: { type: 'STRING' },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          weightGrams: { type: 'NUMBER' },
          minGrams: { type: 'NUMBER' },
          maxGrams: { type: 'NUMBER' }
        },
        required: ['name', 'weightGrams', 'minGrams', 'maxGrams']
      }
    },
    calories: { type: 'NUMBER' },
    macros: {
      type: 'OBJECT',
      properties: {
        protein: { type: 'NUMBER' },
        carbs: { type: 'NUMBER' },
        fat: { type: 'NUMBER' },
        fiber: { type: 'NUMBER' }
      },
      required: ['protein', 'carbs', 'fat', 'fiber']
    },
    micronutrients: {
      type: 'OBJECT',
      properties: {
        sodium: { type: 'NUMBER' }, // in mg
        sugar: { type: 'NUMBER' }, // in g
        satFat: { type: 'NUMBER' }, // in g
        vitaminC: { type: 'NUMBER' }, // in mg
        iron: { type: 'NUMBER' }, // in mg
        calcium: { type: 'NUMBER' } // in mg
      },
      required: ['sodium', 'sugar', 'satFat', 'vitaminC', 'iron', 'calcium']
    },
    healthScore: { type: 'NUMBER' },
    risks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          riskName: { type: 'STRING' },
          severity: { type: 'STRING' }, // "low", "medium", "high"
          description: { type: 'STRING' }
        },
        required: ['riskName', 'severity', 'description']
      }
    }
  },
  required: ['isFood', 'isRealPhoto', 'dishName', 'ingredients', 'calories', 'macros', 'micronutrients', 'healthScore', 'risks']
};

function formatAnalyzeError(error, step = 'unknown') {
  let message = error?.message || String(error);
  let status = error?.status ?? error?.statusCode;

  if (typeof message === 'string' && message.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(message);
      const apiErr = parsed.error || parsed;
      message = apiErr.message || message;
      status = status ?? apiErr.code ?? apiErr.status;
    } catch {
      // keep original message
    }
  }

  if (error?.error?.message) {
    message = error.error.message;
    status = status ?? error.error.code;
  }

  return {
    step,
    message,
    status: status ?? null,
    name: error?.name ?? null,
    stack: error?.stack ?? null,
    geminiAttempts: error?.geminiAttempts ?? null,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateFoodAnalysis(contents, config) {
  const attempts = [];

  for (const model of GEMINI_MODELS) {
    for (let tryNum = 1; tryNum <= GEMINI_MAX_RETRIES; tryNum += 1) {
      try {
        console.log(`Gemini: ${model} (attempt ${tryNum}/${GEMINI_MAX_RETRIES})`);
        const response = await ai.models.generateContent({ model, contents, config });
        console.log(`Gemini: success with ${model}`);
        return { response, model, attempts };
      } catch (error) {
        const debug = formatAnalyzeError(error, 'gemini_request');
        attempts.push({ model, tryNum, status: debug.status, message: debug.message });
        console.warn(`Gemini: ${model} failed — ${debug.message}`);

        if (debug.status === 401 || debug.status === 403) {
          error.geminiAttempts = attempts;
          throw error;
        }

        if (debug.status === 404) {
          break;
        }

        if (RETRYABLE_GEMINI_STATUS.has(debug.status) && tryNum < GEMINI_MAX_RETRIES) {
          await sleep(750 * tryNum);
          continue;
        }

        break;
      }
    }
  }

  const last = attempts[attempts.length - 1];
  const err = new Error(
    last?.message ||
    'All configured Gemini models are unavailable. Please try again in a minute.'
  );
  err.status = last?.status ?? 503;
  err.geminiAttempts = attempts;
  throw err;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    build: SERVER_BUILD,
    debugResponses: true,
    port,
    geminiModels: GEMINI_MODELS,
  });
});

app.post('/api/analyze', (req, res) => {
  upload.single('image')(req, res, async (multerErr) => {
    if (multerErr) {
      const debug = formatAnalyzeError(multerErr, 'file_upload');
      const message =
        multerErr.code === 'LIMIT_FILE_SIZE'
          ? `Image is too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)} MB).`
          : multerErr.message || 'File upload failed';
      console.error('Error analyzing image:', debug);
      return res.status(400).json({ error: message, details: debug.message, debug });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No image provided',
          details: 'Form field "image" is missing or empty.',
          debug: { step: 'validate_file', message: 'No file in multipart request' },
        });
      }

      if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
        return res.status(400).json({
          error: `Unsupported image type: ${req.file.mimetype}`,
          details:
            'Use JPG or PNG. iPhone HEIC photos often fail — change Camera settings to “Most Compatible” or convert before upload.',
          debug: {
            step: 'validate_file',
            mimetype: req.file.mimetype,
            size: req.file.size,
          },
        });
      }

      const { userProfile } = req.body;
      let profileData = {};
      if (userProfile) {
        try {
          profileData = JSON.parse(userProfile);
        } catch (e) {
          console.error('Invalid user profile JSON', e);
        }
      }

      // Compute age from birthDate (yyyy-mm-dd); fallback to stored age field
      let age = profileData.age || 'unknown';
      if (profileData.birthDate) {
        const parts = profileData.birthDate.split('-').map(Number);
        if (parts.length === 3) {
          const [y, m, d] = parts;
          const today = new Date();
          let a = today.getFullYear() - y;
          if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) a--;
          if (a >= 0) age = a;
        }
      }
      const gender = profileData.gender || 'unknown';
      const chronicDiseases = profileData.chronicDiseases && profileData.chronicDiseases.length > 0
        ? profileData.chronicDiseases.join(', ')
        : 'ไม่มี';
      const drugAllergies = profileData.drugAllergies || 'ไม่มี';
      const foodAllergies = profileData.foodAllergies || 'ไม่มี';
      const medications = profileData.medications || 'ไม่มี';

      const prompt = `Analyze this image.
First, determine TWO things:
1. isRealPhoto: Is this a real photograph taken of actual physical food/objects? Set to FALSE if the image is a drawing, cartoon, anime, illustration, clipart, AI-generated art, painting, sketch, or any non-photographic image. Set to TRUE only for genuine camera/phone photos of real scenes.
2. isFood: Does the image contain food (real or depicted)?
If isRealPhoto is false OR isFood is false, set both flags accordingly and provide dummy/empty data for the rest — do NOT perform nutritional analysis.
If both isRealPhoto and isFood are true, provide a detailed nutritional breakdown.
User health profile:
- Gender: ${gender}
- Age: ${age} years old
- Chronic diseases: ${chronicDiseases}
- Drug allergies: ${drugAllergies}
- Food allergies: ${foodAllergies}
- Regular medications: ${medications}
Evaluate personalized health risks based on this meal and their complete health profile, paying special attention to any food allergies or potential drug-food interactions with their medications.
Severity rules — follow these strictly:
  "high"   : The food DIRECTLY worsens or seriously aggravates a diagnosed chronic disease (e.g. high sugar for diabetics, high sodium/saturated fat for hypertensives, allergen present for someone with that allergy, dangerous drug-food interaction). This is a clear clinical risk.
  "medium" : The food is worth monitoring for this user but is not an immediate danger (e.g. moderately elevated nutrient that is borderline for their condition).
  "low"    : Minor concern or general population advisory unrelated to their specific conditions.
If the user has NO chronic diseases, allergies, or medications, and the food is generally healthy, return an empty risks array [].
Return the result exactly matching the required JSON schema.
IMPORTANT: All text and string values in the JSON output (such as dishName, ingredient names, riskName, and description) MUST be in Thai language.`;

      const contents = [
        prompt,
        {
          inlineData: {
            data: req.file.buffer.toString('base64'),
            mimeType: req.file.mimetype,
          },
        },
      ];
      const config = {
        responseMimeType: 'application/json',
        responseSchema: foodAnalysisSchema,
        temperature: 0.2,
      };

      const { response, model: modelUsed } = await generateFoodAnalysis(contents, config);
      console.log(`Analysis used model: ${modelUsed}`);

      const resultText = response.text;
      if (!resultText?.trim()) {
        const debug = {
          step: 'empty_model_response',
          message: 'Gemini returned an empty response body.',
          status: null,
          name: null,
          stack: null,
        };
        console.error('Error analyzing image:', debug);
        return res.status(500).json({
          error: 'Failed to analyze image',
          details: debug.message,
          debug,
        });
      }

      let parsed;
      try {
        parsed = JSON.parse(resultText);
      } catch (parseError) {
        const debug = formatAnalyzeError(parseError, 'json_parse');
        debug.rawPreview = resultText.slice(0, 500);
        console.error('Error analyzing image:', debug);
        return res.status(500).json({
          error: 'Failed to analyze image',
          details: `Invalid JSON from model: ${debug.message}`,
          debug,
        });
      }

      res.json(parsed);

    } catch (error) {
      const debug = formatAnalyzeError(error, 'gemini_request');
      if (error.geminiAttempts) {
        debug.geminiAttempts = error.geminiAttempts;
      }
      console.error('Error analyzing image:', debug);

      let message = 'Failed to analyze image';
      if (debug.status === 401 || debug.status === 403) {
        message =
          'Invalid Gemini API key. Update GEMINI_API_KEY in backend/.env and restart the server.';
      } else if (debug.status === 503 || debug.status === 429) {
        message =
          'Google AI is busy right now. We retried and used a backup model — please tap upload again in a few seconds.';
      } else if (debug.message) {
        message = debug.message;
      }

      res.status(500).json({
        error: message,
        details: debug.message,
        debug,
      });
    }
  });
});

// Text-only analysis: re-analyse by dish name (no image required)
app.post('/api/analyze-by-name', async (req, res) => {
  try {
    const { dishName, userProfile } = req.body;

    if (!dishName || !dishName.trim()) {
      return res.status(400).json({ error: 'dishName is required.' });
    }

    let profileData = {};
    if (userProfile) {
      try {
        profileData = typeof userProfile === 'string' ? JSON.parse(userProfile) : userProfile;
      } catch (e) {
        console.error('Invalid user profile JSON', e);
      }
    }

    let age = profileData.age || 'unknown';
    if (profileData.birthDate) {
      const parts = profileData.birthDate.split('-').map(Number);
      if (parts.length === 3) {
        const [y, m, d] = parts;
        const today = new Date();
        let a = today.getFullYear() - y;
        if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) a--;
        if (a >= 0) age = a;
      }
    }
    const gender = profileData.gender || 'unknown';
    const chronicDiseases =
      profileData.chronicDiseases && profileData.chronicDiseases.length > 0
        ? profileData.chronicDiseases.join(', ')
        : 'ไม่มี';
    const drugAllergies = profileData.drugAllergies || 'ไม่มี';
    const foodAllergies = profileData.foodAllergies || 'ไม่มี';
    const medications = profileData.medications || 'ไม่มี';

    const prompt = `Analyze the nutritional content of the following Thai dish by name: "${dishName.trim()}".
Set isRealPhoto to true (this is a text-based query, not an image).
Assume a standard single-serving portion for a Thai adult.
User health profile:
- Gender: ${gender}
- Age: ${age} years old
- Chronic diseases: ${chronicDiseases}
- Drug allergies: ${drugAllergies}
- Food allergies: ${foodAllergies}
- Regular medications: ${medications}
Provide a detailed nutritional breakdown and evaluate personalized health risks.
Severity rules — follow these strictly:
  "high"   : The food DIRECTLY worsens or seriously aggravates a diagnosed chronic disease (e.g. high sugar for diabetics, high sodium/saturated fat for hypertensives, allergen present for someone with that allergy, dangerous drug-food interaction). This is a clear clinical risk.
  "medium" : The food is worth monitoring for this user but is not an immediate danger (e.g. moderately elevated nutrient that is borderline for their condition).
  "low"    : Minor concern or general population advisory unrelated to their specific conditions.
If the user has NO chronic diseases, allergies, or medications, and the food is generally healthy, return an empty risks array [].
Set isFood to true.
Return the result exactly matching the required JSON schema.
IMPORTANT: All text and string values in the JSON output (such as dishName, ingredient names, riskName, and description) MUST be in Thai language.`;

    const contents = [prompt];
    const config = {
      responseMimeType: 'application/json',
      responseSchema: foodAnalysisSchema,
      temperature: 0.2,
    };

    const { response, model: modelUsed } = await generateFoodAnalysis(contents, config);
    console.log(`analyze-by-name used model: ${modelUsed}`);

    const resultText = response.text;
    if (!resultText?.trim()) {
      return res.status(500).json({ error: 'Failed to analyze dish name', details: 'Empty model response.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(resultText);
    } catch (parseError) {
      return res.status(500).json({ error: 'Failed to analyze dish name', details: `Invalid JSON: ${parseError.message}` });
    }

    res.json(parsed);
  } catch (error) {
    const debug = formatAnalyzeError(error, 'analyze_by_name');
    console.error('Error in analyze-by-name:', debug);
    res.status(500).json({ error: debug.message || 'Failed to analyze dish name', details: debug.message, debug });
  }
});

// ─── /api/places  (SerpApi → Google Maps) ────────────────────────────────────
// Maps radius (metres) → Google Maps zoom level.
// Zoom is approximate; we always post-filter by actual haversine distance.
function radiusToZoom(metres) {
  if (metres <=  500) return 16;
  if (metres <= 1000) return 15;
  if (metres <= 2000) return 14;
  if (metres <= 3500) return 13;
  return 12; // 5 000 m+
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R    = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function serpSearch(query, ll, apiKey) {
  const url =
    `https://serpapi.com/search.json` +
    `?engine=google_maps` +
    `&q=${encodeURIComponent(query)}` +
    `&ll=${encodeURIComponent(ll)}` +
    `&type=search` +
    `&hl=th` +
    `&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`SerpApi ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

app.get('/api/places', async (req, res) => {
  const serpKey = process.env.SERPAPI_KEY?.trim();
  if (!serpKey) {
    return res.status(500).json({
      error: 'SERPAPI_KEY is not configured.',
      hint: 'Add SERPAPI_KEY=<your key> to backend/.env and restart the server.',
    });
  }

  const lat    = parseFloat(req.query.lat);
  const lng    = parseFloat(req.query.lng);
  const radius = parseInt(req.query.radius, 10) || 2000;
  const type   = req.query.type || 'all'; // 'all' | 'restaurant' | 'gym'

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers.' });
  }

  const zoom = radiusToZoom(radius);
  const ll   = `@${lat},${lng},${zoom}z`;

  // Define which SerpApi queries to fire depending on the requested type
  const queries = [];
  if (type === 'all' || type === 'restaurant') {
    queries.push({ q: 'restaurant cafe', category: 'restaurant' });
  }
  if (type === 'all' || type === 'gym') {
    queries.push({ q: 'gym fitness center', category: 'gym' });
  }

  try {
    // Fan out requests in parallel
    const searchResults = await Promise.all(
      queries.map(({ q, category }) =>
        serpSearch(q, ll, serpKey)
          .then((data) => ({ data, category }))
          .catch((err) => {
            console.warn(`SerpApi query "${q}" failed: ${err.message}`);
            return { data: { local_results: [] }, category };
          })
      )
    );

    const seenIds = new Set();
    const places  = [];

    for (const { data, category } of searchResults) {
      for (const p of data.local_results || []) {
        const placeId = p.place_id || p.data_id || p.title;
        if (seenIds.has(placeId)) continue; // deduplicate across queries
        seenIds.add(placeId);

        const placeLat = p.gps_coordinates?.latitude;
        const placeLng = p.gps_coordinates?.longitude;
        if (!placeLat || !placeLng) continue; // skip entries without coords

        const distM = haversineM(lat, lng, placeLat, placeLng);
        if (distM > radius) continue; // post-filter to enforce radius strictly

        places.push({
          id:           placeId || String(Math.random()),
          type:         category,
          name:         p.title       || 'ไม่ระบุชื่อ',
          address:      p.address     || '',
          lat:          placeLat,
          lng:          placeLng,
          distM,
          rating:       p.rating      ?? null,
          reviews:      p.reviews     ?? null,
          phone:        p.phone       || null,
          // SerpApi returns hours as an object keyed by day name — not a renderable string.
          // Safely extract a single human-readable string from known string-typed fields.
          openingHours: (() => {
            const h = p.hours;
            if (!h) return null;
            if (typeof h.currently_open === 'string') return h.currently_open; // "Open ⋅ Closes 10 PM"
            if (typeof h.open_now === 'boolean') return h.open_now ? 'เปิดอยู่' : 'ปิดแล้ว';
            return null; // skip objects entirely
          })(),
          thumbnail:    p.thumbnail   || null,
          category:     p.type        || null,
          description:  typeof p.description === 'string' ? p.description : null,
          website:      p.website     || null,
          // Google Maps deep-link: prefer SerpApi's own link, fall back to coords search
          mapsUrl:      p.link        ||
                        (placeId && placeId.startsWith('0x')
                          ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
                          : `https://www.google.com/maps/search/?api=1&query=${placeLat},${placeLng}`),
        });
      }
    }

    // Sort by distance ascending
    places.sort((a, b) => a.distM - b.distM);

    res.json({ places, total: places.length, radius, lat, lng });
  } catch (err) {
    console.error('Error in /api/places:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch places.' });
  }
});

// ─── Serve React frontend (production) ───────────────────────────────────────
const fs = require('fs');
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
const FRONTEND_INDEX = path.join(FRONTEND_DIST, 'index.html');

if (fs.existsSync(FRONTEND_INDEX)) {
  app.use(express.static(FRONTEND_DIST));
  // SPA fallback — all non-/api routes go to index.html
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(FRONTEND_INDEX);
  });
  console.log(`Serving frontend from ${FRONTEND_DIST}`);
} else {
  console.warn(`[WARN] Frontend dist not found at ${FRONTEND_DIST} — only API routes will work`);
}

const server = app.listen(port, () => {
  console.log(`Server running on port ${port} (${SERVER_BUILD})`);
  console.log(`api run at: http://localhost:${port}/api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Stop the old backend (Task Manager → Node.js, or: netstat -ano | findstr :${port}) then run npm start again.`
    );
  } else {
    console.error('Server failed to start:', err);
  }
  process.exit(1);
});
