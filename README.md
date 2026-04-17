# DataSnap AI ⚡

> Extrae datos de imágenes y PDFs directamente a Excel usando **Gemini 1.5 Flash**.

## 🚀 Demo en vivo
_Pendiente – agrega tu URL de Netlify aquí_

---

## ✨ ¿Qué hace?
1. Sube una imagen (JPG, PNG, WEBP) o PDF
2. La IA extrae **todos** los datos en formato compatible con Excel (columnas separadas por TAB)
3. Previsualiza la tabla en pantalla
4. Descarga el archivo `.xlsx` con un clic

## 🔑 API Key de Gemini (gratuita)
1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Crea una API key gratuita
3. Pégala en el campo de configuración de la app

La clave **solo se guarda en tu navegador** (localStorage). Nunca se envía a ningún servidor externo.

---

## 🛠 Stack
| Tecnología | Rol |
|---|---|
| HTML / CSS / JS puro | Frontend (sin frameworks) |
| Gemini 1.5 Flash API | Extracción de datos con IA |
| SheetJS (xlsx) | Generación de archivos Excel |
| Netlify | Hosting gratuito |

## 📂 Estructura
```
datasnap-ai/
├── index.html      # Estructura de la app
├── index.css       # Estilos (dark mode)
├── app.js          # Lógica y llamadas a Gemini API
├── netlify.toml    # Configuración de despliegue
└── README.md
```

## 🌐 Despliegue en Netlify
1. Haz fork/push del repo a GitHub
2. Ve a [netlify.com](https://netlify.com) → "Add new site" → "Import an existing project"
3. Conecta tu repositorio de GitHub
4. Deja la configuración por defecto _(sin build command, publish directory = `.`)_
5. Haz clic en **Deploy site**

---

## 📄 Licencia
MIT
