const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');

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

const server = app.listen(port, () => {
  console.log(`Server running on port ${port} (${SERVER_BUILD})`);
  console.log(`Health check: http://localhost:${port}/api/health`);
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
