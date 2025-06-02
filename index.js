const express = require('express');
const app = express();

// JSON Body Parser hinzufügen
app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// In-Memory Storage für alle Hausaufgaben und Einstellungen
let hausaufgabenData = {
  "EnglischHausaufgabe": "SA Mediation Text Verbesserung fertig machen",
  "EnglischHausaufgabeDatum": "30.5.25",
  "DeutschHausaufgabe": "S.118/8 Mündlich, 9",
  "DeutschHausaufgabeDatum": "30.5.25",
  "MatheHausaufgabe": "S.176/8",
  "MatheHausaufgabeDatum": "30.5.25",
  "AlteMatheHausaufgabe": "NICHTS!",
  "AlteMatheHausaufgabeDatum": "28.5.25",
  "WartungsarbeitenZeit": "08:50",
  "Wartungsarbeiten": false,
  "Version": "6.3.2",
  "latein": 16
};

// Hauptroute
app.get("/", (req, res) => {
  res.json({
    message: "Hausaufgaben API läuft!",
    version: hausaufgabenData.Version,
    wartungsarbeiten: hausaufgabenData.Wartungsarbeiten
  });
});

// Alle Hausaufgaben abrufen
app.get("/api/hausaufgaben", (req, res) => {
  res.json({
    success: true,
    data: hausaufgabenData,
    lastUpdated: new Date().toLocaleString('de-DE')
  });
});

// Einzelnes Feld abrufen
app.get("/api/hausaufgaben/:field", (req, res) => {
  const field = req.params.field;

  if (hausaufgabenData.hasOwnProperty(field)) {
    res.json({
      success: true,
      field: field,
      value: hausaufgabenData[field],
      lastUpdated: new Date().toLocaleString('de-DE')
    });
  } else {
    res.status(404).json({
      success: false,
      error: `Feld '${field}' nicht gefunden`
    });
  }
});

// Einzelnes Feld aktualisieren
app.put("/api/hausaufgaben/:field", (req, res) => {
  const field = req.params.field;
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({
      success: false,
      error: "Wert (value) ist erforderlich"
    });
  }

  // Spezielle Validierung für bestimmte Felder
  if (field === "Wartungsarbeiten" && typeof value !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: "Wartungsarbeiten muss true oder false sein"
    });
  }

  if (field === "latein" && (typeof value !== 'number' || value < 0)) {
    return res.status(400).json({
      success: false,
      error: "Latein muss eine positive Zahl sein"
    });
  }

  hausaufgabenData[field] = value;

  console.log(`📝 ${field} aktualisiert: "${value}"`);

  res.json({
    success: true,
    message: `${field} erfolgreich aktualisiert!`,
    field: field,
    value: value,
    lastUpdated: new Date().toLocaleString('de-DE')
  });
});

// Mehrere Felder gleichzeitig aktualisieren
app.post("/api/hausaufgaben", (req, res) => {
  const updates = req.body;

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({
      success: false,
      error: "Ungültiges Update-Format"
    });
  }

  const updatedFields = [];
  const errors = [];

  for (const [field, value] of Object.entries(updates)) {
    try {
      // Spezielle Validierung
      if (field === "Wartungsarbeiten" && typeof value !== 'boolean') {
        errors.push(`${field}: Muss true oder false sein`);
        continue;
      }

      if (field === "latein" && (typeof value !== 'number' || value < 0)) {
        errors.push(`${field}: Muss eine positive Zahl sein`);
        continue;
      }

      hausaufgabenData[field] = value;
      updatedFields.push(field);
      console.log(`📝 ${field} aktualisiert: "${value}"`);
    } catch (error) {
      errors.push(`${field}: ${error.message}`);
    }
  }

  if (errors.length > 0 && updatedFields.length === 0) {
    return res.status(400).json({
      success: false,
      errors: errors
    });
  }

  res.json({
    success: true,
    message: `${updatedFields.length} Felder erfolgreich aktualisiert!`,
    updatedFields: updatedFields,
    errors: errors.length > 0 ? errors : undefined,
    lastUpdated: new Date().toLocaleString('de-DE')
  });
});

// Alles zurücksetzen
app.delete("/api/hausaufgaben", (req, res) => {
  hausaufgabenData = {
    "EnglischHausaufgabe": "",
    "EnglischHausaufgabeDatum": "",
    "DeutschHausaufgabe": "",
    "DeutschHausaufgabeDatum": "",
    "MatheHausaufgabe": "",
    "MatheHausaufgabeDatum": "",
    "AlteMatheHausaufgabe": "",
    "AlteMatheHausaufgabeDatum": "",
    "WartungsarbeitenZeit": "08:50",
    "Wartungsarbeiten": false,
    "Version": "6.3.2",
    "latein": 0
  };

  console.log("🗑️ Alle Hausaufgaben zurückgesetzt");

  res.json({
    success: true,
    message: "Alle Hausaufgaben zurückgesetzt!",
    data: hausaufgabenData,
    lastUpdated: new Date().toLocaleString('de-DE')
  });
});

// Wartungsmodus Toggle
app.post("/api/wartung", (req, res) => {
  hausaufgabenData.Wartungsarbeiten = !hausaufgabenData.Wartungsarbeiten;

  res.json({
    success: true,
    message: hausaufgabenData.Wartungsarbeiten ? "Wartungsmodus aktiviert" : "Wartungsmodus deaktiviert",
    wartungsarbeiten: hausaufgabenData.Wartungsarbeiten,
    zeit: hausaufgabenData.WartungsarbeitenZeit
  });
});

// Status/Info Route
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: {
      version: hausaufgabenData.Version,
      wartungsarbeiten: hausaufgabenData.Wartungsarbeiten,
      wartungszeit: hausaufgabenData.WartungsarbeitenZeit,
      lateinStunden: hausaufgabenData.latein,
      totalFields: Object.keys(hausaufgabenData).length,
      uptime: process.uptime(),
      lastUpdated: new Date().toLocaleString('de-DE')
    }
  });
});

// Alle Bilder einer Kategorie abrufen
app.get('/api/images/:category', (req, res) => {
  const category = req.params.category;
  fs.readdir(IMAGE_DIR, (err, files) => {
    if (err) return res.json({ success: false, error: 'Fehler beim Lesen des Bildverzeichnisses' });
    const images = files
      .filter(f => f.startsWith(category + '__'))
      .map(filename => ({
        filename,
        originalName: filename.split('__').slice(2).join('__')
      }));
    res.json({ success: true, images });
  });
});

// Einzelbild abrufen (für <img src=...>)
app.get('/api/images/file/:filename', (req, res) => {
  const file = path.join(IMAGE_DIR, req.params.filename);
  if (fs.existsSync(file)) res.sendFile(file);
  else res.status(404).json({ success: false, error: 'Bild nicht gefunden' });
});

// Bilder hochladen
app.post('/api/images/upload', upload.array('images'), (req, res) => {
  if (!req.files || req.files.length === 0) return res.json({ success: false, error: 'Keine Bilder hochgeladen' });
  res.json({ success: true, uploadedCount: req.files.length });
});

// Einzelbild löschen
app.delete('/api/images/:filename', (req, res) => {
  const file = path.join(IMAGE_DIR, req.params.filename);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'Bild nicht gefunden' });
  }
});

// Alle Bilder einer Kategorie löschen
app.delete('/api/images/category/:category', (req, res) => {
  const category = req.params.category;
  fs.readdir(IMAGE_DIR, (err, files) => {
    if (err) return res.json({ success: false, error: 'Fehler beim Lesen des Bildverzeichnisses' });
    const toDelete = files.filter(f => f.startsWith(category + '__'));
    toDelete.forEach(f => fs.unlinkSync(path.join(IMAGE_DIR, f)));
    res.json({ success: true, deleted: toDelete.length });
  });
});


app.listen(process.env.PORT || 3000, () => {
  console.log("Server läuft auf Port", process.env.PORT || 3000);
  console.log("📚 Erweiterte Hausaufgaben-API bereit!");
  console.log("🔧 Verfügbare Felder:", Object.keys(hausaufgabenData));
});