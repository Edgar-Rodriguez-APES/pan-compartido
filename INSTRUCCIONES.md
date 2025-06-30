# Pan Compartido - Instrucciones de Producción

## 1. Instalar dependencias
```bash
cd "C:\Disco local\MisProyectos\Iglesia\pan-compartido"
npm install
```

## 2. Probar localmente
```bash
npm start
```
Se abre en: http://localhost:3000

## 3. Crear versión de producción
```bash
npm run build
```

## 4. Opciones de despliegue GRATUITAS:

### OPCIÓN A: Netlify (Más fácil)
1. Ve a https://netlify.com
2. Crea cuenta gratuita
3. Arrastra la carpeta `build` a Netlify
4. ¡Listo! Tu sitio estará online

### OPCIÓN B: Vercel
1. Ve a https://vercel.com
2. Crea cuenta con GitHub
3. Conecta tu repositorio
4. Deploy automático

### OPCIÓN C: GitHub Pages
1. Sube código a GitHub
2. Ejecuta: `npm install --save-dev gh-pages`
3. Agrega a package.json:
```json
"homepage": "https://tu-usuario.github.io/pan-compartido",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d build"
}
```
4. Ejecuta: `npm run deploy`

## 5. Comandos útiles
- `npm start` - Servidor desarrollo
- `npm run build` - Crear versión producción
- `npm test` - Ejecutar pruebas