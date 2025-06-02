const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// JSON Body Parser hinzufügen
app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Uploads Ordner erstellen falls nicht vorhanden
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Konfiguration für Datei-Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.body.category || 'Allgemein';
    const categoryDir = path.join(uploadsDir, category);
    
    // Kategorie-Ordner erstellen falls nicht vorhanden
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }
    
    cb(null, categoryDir);
  },
  filename: (req, file, cb) => {
    // Eindeutigen Dateinamen generieren
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB Limit
    files: 10 // Maximal 10 Dateien gleichzeitig
  },
  fileFilter: (req, file, cb) => {
    // Nur Bilder erlauben
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien sind erlaubt!'), false);
    }
  }
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

// In-Memory Storage für Bild-Metadaten
let imageMetadata = {
  "Mathe": [],
  "Englisch": [],
  "Deutsch": []
};

// Hilfsfunktion: Bilder aus Ordner laden
function loadImagesFromDisk(category) {
  const categoryDir = path.join(uploadsDir, category);
  
  if (!fs.existsSync(categoryDir)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(categoryDir);
    return files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      })
      .map(file => ({
        filename: file,
        originalName: file,
        category: category,
        uploadDate: fs.statSync(path.join(categoryDir, file)).mtime,
        size: fs.statSync(path.join(categoryDir, file)).size
      }));
  } catch (error) {
    console.error(`Fehler beim Laden der Bilder aus ${category}:`, error);
    return [];
  }
}

// Beim Start alle existierenden Bilder laden
function initializeImageMetadata() {
  Object.keys(imageMetadata).forEach(category => {
    imageMetadata[category] = loadImagesFromDisk(category);
  });
}

// Hauptroute
app.get("/", (req, res) => {
  res.json({ 
    message: "Hausaufgaben API läuft!",
    version: hausaufgabenData.Version,
    wartungsarbeiten: hausaufgabenData.Wartungsarbeiten,
    features: ["Hausaufgaben-Verwaltung", "Bilder-Upload", "System-Einstellungen"]
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

// ===== BILDER API ROUTES =====

// Bilder für eine Kategorie abrufen
app.get("/api/images/:category", (req, res) => {
  const category = req.params.category;
  
  if (!imageMetadata.hasOwnProperty(category)) {
    return res.status(400).json({
      success: false,
      error: `Unbekannte Kategorie: ${category}`
    });
  }
  
  // Aktuelle Bilder vom Disk laden
  const images = loadImagesFromDisk(category);
  imageMetadata[category] = images;
  
  res.json({
    success: true,
    category: category,
    images: images,
    count: images.length
  });
});

// Bilder hochladen
app.post("/api/images/upload", upload.array('images', 10), (req, res) => {
  try {
    const category = req.body.category || 'Allgemein';
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Keine Dateien hochgeladen"
      });
    }
    
    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      category: category,
      uploadDate: new Date(),
      size: file.size,
      mimetype: file.mimetype
    }));
    
    // Metadaten aktualisieren
    if (!imageMetadata[category]) {
      imageMetadata[category] = [];
    }
    
    imageMetadata[category].push(...uploadedFiles);
    
    console.log(`📸 ${uploadedFiles.length} Bilder in ${category} hochgeladen`);
    
    res.json({
      success: true,
      message: `${uploadedFiles.length} Bilder erfolgreich hochgeladen!`,
      uploadedCount: uploadedFiles.length,
      category: category,
      files: uploadedFiles
    });
    
  } catch (error) {
    console.error('Upload-Fehler:', error);
    res.status(500).json({
      success: false,
      error: error.message || "Upload fehlgeschlagen"
    });
  }
});

// Einzelnes Bild abrufen
app.get("/api/images/file/:filename", (req, res) => {
  const filename = req.params.filename;
  
  // In allen Kategorien nach der Datei suchen
  let foundFile = null;
  let foundCategory = null;
  
  for (const [category, images] of Object.entries(imageMetadata)) {
    const image = images.find(img => img.filename === filename);
    if (image) {
      foundFile = image;
      foundCategory = category;
      break;
    }
  }
  
  if (!foundFile) {
    return res.status(404).json({
      success: false,
      error: "Bild nicht gefunden"
    });
  }
  
  const filePath = path.join(uploadsDir, foundCategory, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: "Datei auf Festplatte nicht gefunden"
    });
  }
  
  // Bild senden
  res.sendFile(filePath);
});

// Einzelnes Bild löschen
app.delete("/api/images/:filename", (req, res) => {
  const filename = req.params.filename;
  
  // In allen Kategorien nach der Datei suchen
  let foundCategory = null;
  let fileIndex = -1;
  
  for (const [category, images] of Object.entries(imageMetadata)) {
    const index = images.findIndex(img => img.filename === filename);
    if (index !== -1) {
      foundCategory = category;
      fileIndex = index;
      break;
    }
  }
  
  if (!foundCategory) {
    return res.status(404).json({
      success: false,
      error: "Bild nicht gefunden"
    });
  }
  
  const filePath = path.join(uploadsDir, foundCategory, filename);
  
  try {
    // Datei von Festplatte löschen
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Aus Metadaten entfernen
    imageMetadata[foundCategory].splice(fileIndex, 1);
    
    console.log(`🗑️ Bild ${filename} aus ${foundCategory} gelöscht`);
    
    res.json({
      success: true,
      message: "Bild erfolgreich gelöscht!",
      filename: filename,
      category: foundCategory
    });
    
  } catch (error) {
    console.error('Lösch-Fehler:', error);
    res.status(500).json({
      success: false,
      error: "Fehler beim Löschen der Datei"
    });
  }
});

// Alle Bilder einer Kategorie löschen
app.delete("/api/images/category/:category", (req, res) => {
  const category = req.params.category;
  
  if (!imageMetadata.hasOwnProperty(category)) {
    return res.status(400).json({
      success: false,
      error: `Unbekannte Kategorie: ${category}`
    });
  }
  
  const categoryDir = path.join(uploadsDir, category);
  let deletedCount = 0;
  
  try {
    if (fs.existsSync(categoryDir)) {
      const files = fs.readdirSync(categoryDir);
      
      files.forEach(file => {
        const filePath = path.join(categoryDir, file);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
        } catch (error) {
          console.error(`Fehler beim Löschen von ${file}:`, error);
        }
      });
      
      // Versuche den Ordner zu löschen (falls leer)
      try {
        fs.rmdirSync(categoryDir);
      } catch (error) {
        // Ignorieren falls Ordner nicht leer
      }
    }
    
    // Metadaten zurücksetzen
    const previousCount = imageMetadata[category].length;
    imageMetadata[category] = [];
    
    console.log(`🗑️ Alle ${previousCount} Bilder aus ${category} gelöscht`);
    
    res.json({
      success: true,
      message: `Alle Bilder in ${category} gelöscht!`,
      category: category,
      deletedCount: deletedCount
    });
    
  } catch (error) {
    console.error('Lösch-Fehler:', error);
    res.status(500).json({
      success: false,
      error: "Fehler beim Löschen der Bilder"
    });
  }
});

// Wartungsmodus Toggle
app.post("/api/wartung", (req, res) => {
  hausaufgabenData.Wartungsarbeiten = !hausaufgabenData.Wartungsarbeiten;
  
  console.log(`🔧 Wartungsmodus ${hausaufgabenData.Wartungsarbeiten ? 'aktiviert' : 'deaktiviert'}`);
  
  res.json({
    success: true,
    message: hausaufgabenData.Wartungsarbeiten ? "Wartungsmodus aktiviert" : "Wartungsmodus deaktiviert",
    wartungsarbeiten: hausaufgabenData.Wartungsarbeiten,
    zeit: hausaufgabenData.WartungsarbeitenZeit
  });
});

// Status/Info Route
app.get("/api/status", (req, res) => {
  // Gesamtanzahl aller Bilder berechnen
  const totalImages = Object.values(imageMetadata).reduce((sum, images) => sum + images.length, 0);
  
  res.json({
    success: true,
    status: {
      version: hausaufgabenData.Version,
      wartungsarbeiten: hausaufgabenData.Wartungsarbeiten,
      wartungszeit: hausaufgabenData.WartungsarbeitenZeit,
      lateinStunden: hausaufgabenData.latein,
      totalFields: Object.keys(hausaufgabenData).length,
      totalImages: totalImages,
      imagesByCategory: Object.fromEntries(
        Object.entries(imageMetadata).map(([cat, imgs]) => [cat, imgs.length])
      ),
      uptime: process.uptime(),
      lastUpdated: new Date().toLocaleString('de-DE')
    }
  });
});

// Alle verfügbaren Kategorien abrufen
app.get("/api/categories", (req, res) => {
  res.json({
    success: true,
    categories: Object.keys(imageMetadata),
    totalImages: Object.values(imageMetadata).reduce((sum, images) => sum + images.length, 0)
  });
});

// Error Handler für Multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Datei zu groß! Maximum: 10MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Zu viele Dateien! Maximum: 10 Dateien'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: error.message || 'Unerwarteter Server-Fehler'
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint nicht gefunden',
    availableEndpoints: [
      'GET /',
      'GET /api/hausaufgaben',
      'POST /api/hausaufgaben',
      'GET /api/status',
      'GET /api/images/:category',
      'POST /api/images/upload',
      'GET /api/images/file/:filename',
      'DELETE /api/images/:filename',
      'DELETE /api/images/category/:category'
    ]
  });
});

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server läuft auf Port", PORT);
  console.log("📚 Erweiterte Hausaufgaben-API bereit!");
  console.log("🔧 Verfügbare Felder:", Object.keys(hausaufgabenData));
  console.log("📸 Bild-Kategorien:", Object.keys(imageMetadata));
  
  // Bilder-Metadaten beim Start initialisieren
  initializeImageMetadata();
  
  const totalImages = Object.values(imageMetadata).reduce((sum, images) => sum + images.length, 0);
  console.log(`🖼️ ${totalImages} Bilder geladen`);
});