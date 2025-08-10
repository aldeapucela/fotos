/**
 * DatabaseManager - Singleton para manejar la base de datos SQLite
 * Garantiza que fotos.db se descargue una sola vez por sesión
 */
class DatabaseManager {
  constructor() {
    this.db = null;
    this.loadingPromise = null;
    this.SQL = null;
    
    // Cache para resultados de Bluesky
    this.blueskyCache = new Map();
  }

  /**
   * Inicializa y retorna la base de datos
   * Si ya está cargada, la retorna inmediatamente
   * Si está cargando, espera a que termine
   */
  async getDatabase() {
    // Si ya tenemos la BD, la retornamos
    if (this.db) {
      return this.db;
    }

    // Si ya está cargando, esperamos a que termine
    if (this.loadingPromise) {
      return await this.loadingPromise;
    }

    // Iniciamos la carga
    this.loadingPromise = this._loadDatabase();
    
    try {
      this.db = await this.loadingPromise;
      console.log('Base de datos cargada exitosamente (una sola vez)');
      return this.db;
    } catch (error) {
      // Si falla, limpiamos para poder reintentar
      this.loadingPromise = null;
      throw error;
    }
  }

  /**
   * Carga la base de datos desde el servidor
   * @private
   */
  async _loadDatabase() {
    try {
      // Inicializar SQL.js si no está cargado
      if (!this.SQL) {
        this.SQL = await initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`
        });
      }

      // Descargar la base de datos
      console.log('Descargando fotos.db...');
      const response = await fetch('/fotos.db');
      
      if (!response.ok) {
        throw new Error(`Error descargando BD: ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      console.log(`Base de datos descargada: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
      
      // Crear instancia de la BD
      return new this.SQL.Database(new Uint8Array(buffer));
    } catch (error) {
      console.error('Error cargando la base de datos:', error);
      throw error;
    }
  }

  /**
   * Obtiene el post_id de Bluesky para una imagen
   * Intenta múltiples variantes del path
   */
  async getBlueskyPostId(imagePath) {
    // Revisar cache primero
    if (this.blueskyCache.has(imagePath)) {
      return this.blueskyCache.get(imagePath);
    }

    const db = await this.getDatabase();
    
    // Limpiar el path de /files/ si lo tiene
    let cleanPath = imagePath.replace(/^\/files\//, '');
    
    // Si no tiene extensión, probamos con las comunes
    const possiblePaths = [];
    
    if (!cleanPath.includes('.')) {
      // Es solo el ID, probamos con diferentes extensiones
      possiblePaths.push(cleanPath + '.jpg');
      possiblePaths.push(cleanPath + '.jpeg');
      possiblePaths.push(cleanPath + '.png');
    } else {
      // Ya tiene extensión
      possiblePaths.push(cleanPath);
    }

    // Intentar con cada posible path
    for (const tryPath of possiblePaths) {
      try {
        const stmt = db.prepare(
          `SELECT bp.post_id 
           FROM bluesky_posts bp 
           JOIN imagenes i ON bp.image_id = i.id 
           WHERE i.path = ?`
        );
        stmt.bind([tryPath]);
        
        if (stmt.step()) {
          const postId = stmt.getAsObject().post_id;
          stmt.free();
          
          // Guardar en cache
          this.blueskyCache.set(imagePath, postId);
          this.blueskyCache.set(cleanPath, postId);
          return postId;
        }
        stmt.free();
      } catch (error) {
        console.error(`Error buscando post_id para ${tryPath}:`, error);
      }
    }
    
    // No se encontró, guardamos null en cache
    this.blueskyCache.set(imagePath, null);
    return null;
  }

  /**
   * Ejecuta todas las consultas iniciales de fotos
   */
  async getPhotosData() {
    const db = await this.getDatabase();
    
    return db.exec(`
      SELECT i.*, date(i.date) as fecha_grupo, 
             ia.is_appropriate, 
             ia.description as ai_description,
             ia.tags as ai_tags 
      FROM imagenes i 
      LEFT JOIN image_analysis ia ON i.id = ia.image_id 
      ORDER BY i.date DESC
    `);
  }
}

// Crear instancia singleton
window.databaseManager = new DatabaseManager();
